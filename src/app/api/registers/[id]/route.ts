import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { recordActivity } from "@/lib/activityLog";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let userId = "unknown";
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !(session.user as any).id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    userId = String((session.user as any).id);

    if (!checkRateLimit(userId)) {
      return NextResponse.json({ success: false, error: "Too Many Requests" }, { status: 429 });
    }

    const resolvedParams = await params;
    if (!resolvedParams?.id) {
      return NextResponse.json({ success: false, error: "Missing register ID" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const { name, status } = body;

    const register = await prisma.courierRegister.findUnique({
      where: { id: resolvedParams.id }
    });

    if (!register) {
      return NextResponse.json({ success: false, error: "Register not found" }, { status: 404 });
    }

    if (register.userId !== userId) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = String(name).trim();
    if (status !== undefined) {
      const validStatuses = ["Active", "Locked", "Archived"];
      if (!validStatuses.includes(status)) {
        return NextResponse.json({ success: false, error: "Invalid status" }, { status: 400 });
      }
      updateData.status = status;
    }

    const updated = await prisma.courierRegister.update({
      where: { id: resolvedParams.id },
      data: updateData
    });

    await recordActivity({
      userId: String((session.user as any).id),
      userName: session.user.name || session.user.email || "Staff",
      role: (session.user as any).role || "Staff",
      action: "REGISTER_EDIT",
      entity: "CourierRegister",
      entityId: updated.id,
      oldValue: JSON.stringify(register),
      newValue: JSON.stringify(updated),
      req
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    console.error("[REGISTER_PATCH]", userId, error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let userId = "unknown";
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !(session.user as any).id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    userId = String((session.user as any).id);

    if (!checkRateLimit(userId)) {
      return NextResponse.json({ success: false, error: "Too Many Requests" }, { status: 429 });
    }

    const resolvedParams = await params;
    if (!resolvedParams?.id) {
      return NextResponse.json({ success: false, error: "Missing register ID" }, { status: 400 });
    }

    const register = await prisma.courierRegister.findUnique({
      where: { id: resolvedParams.id },
      include: {
        _count: {
          select: { courierEntries: true }
        }
      }
    });

    if (!register) {
      return NextResponse.json({ success: false, error: "Register not found" }, { status: 404 });
    }

    if (register.userId !== userId) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    if (register._count.courierEntries > 0) {
      return NextResponse.json({
        success: false,
        error: `Cannot delete register "${register.name}" because it contains ${register._count.courierEntries} entries. Lock or archive it instead.`
      }, { status: 400 });
    }

    await prisma.courierRegister.delete({
      where: { id: resolvedParams.id }
    });

    await recordActivity({
      userId: String((session.user as any).id),
      userName: session.user.name || session.user.email || "Staff",
      role: (session.user as any).role || "Staff",
      action: "REGISTER_DELETE",
      entity: "CourierRegister",
      entityId: resolvedParams.id,
      oldValue: JSON.stringify(register),
      newValue: null,
      req
    });

    return NextResponse.json({ success: true, message: "Register deleted successfully" });
  } catch (error: any) {
    console.error("[REGISTER_DELETE]", userId, error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
