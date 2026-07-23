import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any)?.role !== "Admin") {
      return NextResponse.json(
        { success: false, error: "Unauthorized access" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const { action, role, disabled, newPassword, mustChangePassword } = body;
    const updateData: any = {};
    let auditAction = "UPDATE_USER";
    let auditDetails = "";

    if (action === "TOGGLE_DISABLE") {
      updateData.disabled = Boolean(disabled);
      auditAction = disabled ? "DISABLE_USER" : "ENABLE_USER";
      auditDetails = `${disabled ? "Disabled" : "Enabled"} user ${targetUser.email}`;
    } else if (action === "RESET_PASSWORD" && newPassword) {
      updateData.password = await bcrypt.hash(newPassword, 10);
      updateData.mustChangePassword = mustChangePassword ?? true;
      updateData.failedLoginAttempts = 0;
      updateData.lockedUntil = null;
      updateData.passwordChangedAt = new Date();
      auditAction = "RESET_PASSWORD";
      auditDetails = `Reset password for user ${targetUser.email}`;
    } else if (action === "CHANGE_ROLE" && role) {
      updateData.role = role;
      auditAction = "CHANGE_ROLE";
      auditDetails = `Changed role of user ${targetUser.email} from ${targetUser.role} to ${role}`;
    } else if (action === "UNLOCK") {
      updateData.failedLoginAttempts = 0;
      updateData.lockedUntil = null;
      auditAction = "UNLOCK_USER";
      auditDetails = `Unlocked user account ${targetUser.email}`;
    } else {
      if (typeof disabled === "boolean") updateData.disabled = disabled;
      if (role) updateData.role = role;
      if (typeof mustChangePassword === "boolean") updateData.mustChangePassword = mustChangePassword;
      auditDetails = `Updated user settings for ${targetUser.email}`;
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        disabled: true,
        mustChangePassword: true,
        failedLoginAttempts: true,
        lockedUntil: true,
        updatedAt: true,
      },
    });

    // Record Audit Log
    try {
      const { recordActivity } = await import("@/lib/activityLog");
      await recordActivity({
        userId: session.user.id,
        userName: session.user.name || session.user.email || "Admin",
        role: "Admin",
        action: auditAction,
        entity: "User",
        entityId: updatedUser.id,
        oldValue: JSON.stringify({ role: targetUser.role, disabled: targetUser.disabled }),
        newValue: auditDetails,
      });
    } catch (e) {
      console.error("Failed to log audit activity", e);
    }

    return NextResponse.json({
      success: true,
      data: updatedUser,
    });
  } catch (error: any) {
    console.error("PATCH /api/admin/users/[id] error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update user" },
      { status: 500 }
    );
  }
}
