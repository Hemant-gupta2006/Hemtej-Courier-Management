import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminSession, unauthorizedResponse } from "@/lib/adminAuth";

export async function GET(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await checkAdminSession();
    if (!session) return unauthorizedResponse();

    const courier = await prisma.courierEntry.findUnique({
      where: { id: params.id },
      include: {
        user: { select: { name: true, email: true } }
      }
    });

    if (!courier) {
      return NextResponse.json({ success: false, error: "Courier not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: courier });
  } catch (error: any) {
    console.error("[ADMIN_COURIER_DETAIL_GET]", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load courier details" },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await checkAdminSession();
    if (!session) return unauthorizedResponse();

    const body = await req.json().catch(() => ({}));
    const existingCourier = await prisma.courierEntry.findUnique({
      where: { id: params.id }
    });

    if (!existingCourier) {
      return NextResponse.json({ success: false, error: "Courier not found" }, { status: 404 });
    }

    const {
      date,
      challanNo,
      fromParty,
      toParty,
      weightValue,
      weightUnit,
      destination,
      amount,
      status,
      mode
    } = body;

    // Build update object
    const updateData: any = {};
    if (date) updateData.date = new Date(date);
    if (challanNo !== undefined) updateData.challanNo = Number(challanNo);
    if (fromParty !== undefined) updateData.fromParty = String(fromParty);
    if (toParty !== undefined) updateData.toParty = String(toParty);
    if (weightValue !== undefined) updateData.weightValue = Number(weightValue);
    if (weightUnit !== undefined) updateData.weightUnit = String(weightUnit);
    if (destination !== undefined) updateData.destination = String(destination);
    if (amount !== undefined) updateData.amount = Number(amount);
    if (status !== undefined) updateData.status = String(status);
    if (mode !== undefined) updateData.mode = String(mode);

    // Save changes
    const updatedCourier = await prisma.courierEntry.update({
      where: { id: params.id },
      data: updateData
    });

    // Detect changes and log action type
    let action = "EDIT_ENTRY";
    if (status !== undefined && status !== existingCourier.status && Object.keys(updateData).length === 1) {
      action = "UPDATE_STATUS";
    }

    // Write Audit Log
    await prisma.auditLog.create({
      data: {
        adminId: String((session.user as any).id),
        adminName: session.user.name || session.user.email || "Admin",
        action,
        entity: "CourierEntry",
        entityId: params.id,
        oldValue: JSON.stringify(existingCourier),
        newValue: JSON.stringify(updatedCourier)
      }
    });

    return NextResponse.json({ success: true, data: updatedCourier });
  } catch (error: any) {
    console.error("[ADMIN_COURIER_DETAIL_PUT]", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update courier entry" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await checkAdminSession();
    if (!session) return unauthorizedResponse();

    const existingCourier = await prisma.courierEntry.findUnique({
      where: { id: params.id }
    });

    if (!existingCourier) {
      return NextResponse.json({ success: false, error: "Courier not found" }, { status: 404 });
    }

    // Delete
    await prisma.courierEntry.delete({
      where: { id: params.id }
    });

    // Write Audit Log
    await prisma.auditLog.create({
      data: {
        adminId: String((session.user as any).id),
        adminName: session.user.name || session.user.email || "Admin",
        action: "DELETE_ENTRY",
        entity: "CourierEntry",
        entityId: params.id,
        oldValue: JSON.stringify(existingCourier),
        newValue: null
      }
    });

    return NextResponse.json({ success: true, data: { id: params.id } });
  } catch (error: any) {
    console.error("[ADMIN_COURIER_DETAIL_DELETE]", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete courier entry" },
      { status: 500 }
    );
  }
}
