import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminSession, unauthorizedResponse } from "@/lib/adminAuth";
import { recordActivity } from "@/lib/activityLog";
import bcrypt from "bcrypt";

export async function PUT(req: Request) {
  try {
    const session = await checkAdminSession();
    if (!session) return unauthorizedResponse();

    const adminId = String((session.user as any).id);
    const body = await req.json().catch(() => ({}));
    const { name, email, currentPassword, newPassword } = body;

    const user = await prisma.user.findUnique({
      where: { id: adminId }
    });

    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = String(name);
    if (email !== undefined) {
      // Check if email is already taken by someone else
      if (email.toLowerCase() !== user.email?.toLowerCase()) {
        const emailExists = await prisma.user.findUnique({
          where: { email: email.toLowerCase() }
        });
        if (emailExists) {
          return NextResponse.json({ success: false, error: "Email is already taken by another account" }, { status: 400 });
        }
      }
      updateData.email = email.toLowerCase();
    }

    if (newPassword) {
      if (!currentPassword) {
        return NextResponse.json({ success: false, error: "Current password is required to set a new password" }, { status: 400 });
      }

      if (!user.password) {
        return NextResponse.json({ success: false, error: "Existing password hash is missing. Please contact system administrator." }, { status: 400 });
      }

      // Check current password correctness
      const isCorrectPassword = await bcrypt.compare(currentPassword, user.password);
      if (!isCorrectPassword) {
        return NextResponse.json({ success: false, error: "Incorrect current password" }, { status: 400 });
      }

      // Hash the new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      updateData.password = hashedPassword;
    }

    const updatedUser = await prisma.user.update({
      where: { id: adminId },
      data: updateData
    });

    // Write Audit Log
    await recordActivity({
      userId: adminId,
      userName: updatedUser.name || updatedUser.email || "Admin",
      role: (session.user as any).role || "Admin",
      action: newPassword ? "PASSWORD_CHANGE" : "PROFILE_UPDATE",
      entity: "User",
      entityId: adminId,
      oldValue: JSON.stringify({ name: user.name, email: user.email }),
      newValue: JSON.stringify({ name: updatedUser.name, email: updatedUser.email, passwordChanged: !!newPassword }),
      req
    });

    return NextResponse.json({
      success: true,
      data: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email
      }
    });
  } catch (error: any) {
    console.error("[ADMIN_PROFILE_PUT]", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update profile" },
      { status: 500 }
    );
  }
}
