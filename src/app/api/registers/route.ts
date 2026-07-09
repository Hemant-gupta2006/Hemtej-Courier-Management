import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { recordActivity } from "@/lib/activityLog";

const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export async function GET(req: Request) {
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

    // Fetch and return all registers sorted by year/month desc, with aggregated metrics
    const registers = await prisma.courierRegister.findMany({
      where: { userId },
      orderBy: [
        { year: "desc" },
        { month: "desc" }
      ],
      include: {
        courierEntries: {
          select: {
            amount: true,
            status: true
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      data: registers.map(r => {
        const entryCount = r.courierEntries.length;
        const totalAmount = r.courierEntries.reduce((sum, e) => sum + (e.amount || 0), 0);
        const pendingCount = r.courierEntries.filter(
          e => e.status === "Pending" || e.status?.toLowerCase() === "pending"
        ).length;

        return {
          id: r.id,
          name: r.name,
          month: r.month,
          year: r.year,
          status: r.status,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
          entryCount,
          totalAmount,
          pendingCount
        };
      })
    });
  } catch (error: any) {
    console.error("[REGISTERS_GET]", userId, error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
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

    const body = await req.json().catch(() => ({}));
    const month = parseInt(body.month, 10);
    const year = parseInt(body.year, 10);
    let name = String(body.name || "").trim();

    if (isNaN(month) || month < 1 || month > 12 || isNaN(year) || year < 2000 || year > 2100) {
      return NextResponse.json({ success: false, error: "Invalid month or year" }, { status: 400 });
    }

    if (!name) {
      name = `${monthNames[month - 1]} ${year}`;
    }

    // Check for duplicate register
    const existing = await prisma.courierRegister.findFirst({
      where: { userId, month, year }
    });

    if (existing) {
      return NextResponse.json({ success: false, error: `A register for ${monthNames[month - 1]} ${year} already exists.` }, { status: 400 });
    }

    const register = await prisma.courierRegister.create({
      data: {
        userId,
        month,
        year,
        name,
        status: "Active"
      }
    });

    await recordActivity({
      userId: String((session.user as any).id),
      userName: session.user.name || session.user.email || "Staff",
      role: (session.user as any).role || "Staff",
      action: "REGISTER_CREATE",
      entity: "CourierRegister",
      entityId: register.id,
      newValue: JSON.stringify(register),
      req
    });

    return NextResponse.json({ success: true, data: { ...register, entryCount: 0, totalAmount: 0, pendingCount: 0 } });
  } catch (error: any) {
    console.error("[REGISTERS_POST]", userId, error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
