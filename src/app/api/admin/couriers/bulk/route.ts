import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminSession, unauthorizedResponse } from "@/lib/adminAuth";

export async function POST(req: Request) {
  try {
    const session = await checkAdminSession();
    if (!session) return unauthorizedResponse();

    const body = await req.json().catch(() => ({}));
    const { ids, action, status } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ success: false, error: "No courier IDs provided" }, { status: 400 });
    }

    if (!action || !["delete", "updateStatus"].includes(action)) {
      return NextResponse.json({ success: false, error: "Invalid action. Supported: delete, updateStatus" }, { status: 400 });
    }

    const existingCouriers = await prisma.courierEntry.findMany({
      where: { id: { in: ids } }
    });

    if (existingCouriers.length === 0) {
      return NextResponse.json({ success: false, error: "No matching couriers found" }, { status: 404 });
    }

    const adminId = String((session.user as any).id);
    const adminName = session.user.name || session.user.email || "Admin";

    if (action === "delete") {
      // Execute deletion
      await prisma.courierEntry.deleteMany({
        where: { id: { in: ids } }
      });

      // Create Audit logs
      const auditLogData = existingCouriers.map((courier) => ({
        adminId,
        adminName,
        action: "BULK_DELETE",
        entity: "CourierEntry",
        entityId: courier.id,
        oldValue: JSON.stringify(courier),
        newValue: null
      }));

      await prisma.auditLog.createMany({
        data: auditLogData
      });

      return NextResponse.json({
        success: true,
        data: { count: existingCouriers.length }
      });
    }

    if (action === "updateStatus") {
      if (!status) {
        return NextResponse.json({ success: false, error: "Status must be provided for status updates" }, { status: 400 });
      }

      // Execute update
      await prisma.courierEntry.updateMany({
        where: { id: { in: ids } },
        data: { status }
      });

      const updatedCouriers = await prisma.courierEntry.findMany({
        where: { id: { in: ids } }
      });

      // Create Audit logs
      const auditLogData = existingCouriers.map((oldCourier) => {
        const newCourier = updatedCouriers.find((c) => c.id === oldCourier.id) || oldCourier;
        return {
          adminId,
          adminName,
          action: "BULK_STATUS_UPDATE",
          entity: "CourierEntry",
          entityId: oldCourier.id,
          oldValue: JSON.stringify(oldCourier),
          newValue: JSON.stringify(newCourier)
        };
      });

      await prisma.auditLog.createMany({
        data: auditLogData
      });

      return NextResponse.json({
        success: true,
        data: { count: existingCouriers.length }
      });
    }

    return NextResponse.json({ success: false, error: "Unhandled action" }, { status: 400 });
  } catch (error: any) {
    console.error("[ADMIN_COURIER_BULK_POST]", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to perform bulk action" },
      { status: 500 }
    );
  }
}
