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
    if (!resolvedParams?.id || typeof resolvedParams.id !== "string" || resolvedParams.id.startsWith("new-")) {
      return NextResponse.json({ success: false, error: "Invalid ID" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    if (!body || Object.keys(body).length === 0) {
      return NextResponse.json({ success: false, error: "Empty payload" }, { status: 400 });
    }

    const dbEntry = await prisma.courierEntry.findUnique({
      where: { id: resolvedParams.id }
    });
    if (!dbEntry) {
      return NextResponse.json({ success: false, error: "Not Found" }, { status: 404 });
    }
    if (dbEntry.userId !== userId) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    // Check if the current register is locked/archived
    if (dbEntry.registerId) {
      const register = await prisma.courierRegister.findUnique({
        where: { id: dbEntry.registerId }
      });
      if (register && (register.status === "Locked" || register.status === "Archived")) {
        return NextResponse.json({ success: false, error: `This register is ${register.status.toLowerCase()} and cannot be modified.` }, { status: 400 });
      }
    }

    if (body.challanNo !== undefined) {
      const parsedChallan = parseInt(body.challanNo, 10);
      if (!isNaN(parsedChallan)) {
        const existing = await prisma.courierEntry.findFirst({
          where: { challanNo: parsedChallan, userId }
        });
        if (existing && existing.id !== resolvedParams.id) {
          return NextResponse.json({ success: false, error: "Challan Number already exists" }, { status: 400 });
        }
      }
    }

    const data: any = {};
    if (body.date !== undefined) {
      const newDate = isNaN(Date.parse(body.date)) ? new Date() : new Date(body.date);

      // If register exists, validate date matches register month/year
      if (dbEntry.registerId) {
        const register = await prisma.courierRegister.findUnique({
          where: { id: dbEntry.registerId }
        });
        if (register) {
          const newMonth = newDate.getMonth() + 1;
          const newYear = newDate.getFullYear();
          if (newMonth !== register.month || newYear !== register.year) {
            const monthNames = [
              "January", "February", "March", "April", "May", "June",
              "July", "August", "September", "October", "November", "December"
            ];
            return NextResponse.json({
              success: false,
              error: `Entry date must match the register's month and year (${monthNames[register.month - 1]} ${register.year}).`
            }, { status: 400 });
          }
        }
      }
      data.date = newDate;
    }

    if (body.fromParty !== undefined) data.fromParty = String(body.fromParty).trim();
    if (body.toParty !== undefined) data.toParty = String(body.toParty).trim();
    if (body.weightValue !== undefined) data.weightValue = Number(body.weightValue) || 0;
    if (body.weightUnit !== undefined) data.weightUnit = String(body.weightUnit).trim();
    if (body.weight !== undefined) {
      // Fallback for old clients sending 'weight' string
      const w = String(body.weight).toLowerCase().trim();
      if (w.includes("kg")) {
        data.weightValue = parseFloat(w) || 0;
        data.weightUnit = "kg";
      } else {
        data.weightValue = parseFloat(w) || 0;
        data.weightUnit = "gm";
      }
    }
    if (body.destination !== undefined) data.destination = String(body.destination).trim();
    if (body.amount !== undefined) data.amount = Number(body.amount) || 0;
    if (body.status !== undefined) data.status = String(body.status).trim();
    if (body.mode !== undefined) data.mode = String(body.mode).trim();
    if (body.challanNo !== undefined) {
      const parsedChallan = parseInt(body.challanNo, 10);
      if (!isNaN(parsedChallan)) data.challanNo = parsedChallan;
    }

    const courier = await prisma.courierEntry.update({
      where: { id: resolvedParams.id },
      data
    });

    await recordActivity({
      userId: String((session.user as any).id),
      userName: session.user.name || session.user.email || "Staff",
      role: (session.user as any).role || "Staff",
      action: "COURIER_EDIT",
      entity: "CourierEntry",
      entityId: courier.id,
      oldValue: JSON.stringify(dbEntry),
      newValue: JSON.stringify(courier),
      req
    });

    return NextResponse.json({ success: true, data: courier });
  } catch (error) {
    console.error("[COURIERS_PATCH]", userId, error);
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
    if (!resolvedParams?.id || typeof resolvedParams.id !== "string") {
      return NextResponse.json({ success: false, error: "Invalid ID" }, { status: 400 });
    }

    const dbEntry = await prisma.courierEntry.findUnique({
      where: { id: resolvedParams.id }
    });
    if (!dbEntry) {
      return NextResponse.json({ success: false, error: "Not Found" }, { status: 404 });
    }
    if (dbEntry.userId !== userId) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    // Check if the current register is locked/archived
    if (dbEntry.registerId) {
      const register = await prisma.courierRegister.findUnique({
        where: { id: dbEntry.registerId }
      });
      if (register && (register.status === "Locked" || register.status === "Archived")) {
        return NextResponse.json({ success: false, error: `This register is ${register.status.toLowerCase()} and cannot be modified.` }, { status: 400 });
      }
    }

    const courier = await prisma.courierEntry.delete({
      where: { id: resolvedParams.id }
    });

    await recordActivity({
      userId: String((session.user as any).id),
      userName: session.user.name || session.user.email || "Staff",
      role: (session.user as any).role || "Staff",
      action: "COURIER_DELETE",
      entity: "CourierEntry",
      entityId: courier.id,
      oldValue: JSON.stringify(dbEntry),
      newValue: null,
      req
    });

    return NextResponse.json({ success: true, data: courier });
  } catch (error) {
    console.error("[COURIERS_DELETE]", userId, error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export const PUT = PATCH;

