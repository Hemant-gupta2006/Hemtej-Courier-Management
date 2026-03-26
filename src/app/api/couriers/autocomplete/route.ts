import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET() {
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

    const couriers = await prisma.courierEntry.findMany({
      where: { userId },
      select: {
        destination: true,
        fromParty: true,
        toParty: true,
        weight: true,
        status: true,
      },
      distinct: ['destination', 'fromParty', 'toParty', 'weight', 'status'],
      take: 1000, 
      orderBy: { createdAt: 'desc' }
    });

    const destinations = Array.from(new Set(couriers.map(c => c.destination).filter(Boolean)));
    const fromParties = Array.from(new Set(couriers.map(c => c.fromParty).filter(Boolean)));
    const toParties = Array.from(new Set(couriers.map(c => c.toParty).filter(Boolean)));
    const weights = Array.from(new Set(couriers.map(c => c.weight).filter(Boolean)));
    const statuses = Array.from(new Set(couriers.map(c => c.status).filter(Boolean)));

    return NextResponse.json({
      success: true,
      data: {
        destinations,
        fromParties,
        toParties,
        weights,
        statuses
      }
    });
  } catch (error: any) {
    if (error?.code === 'P1001' || error?.code === 'P2024') {
      console.warn(`[AUTOCOMPLETE_GET] Database connection issue (${error.code}) for user ${userId}.`);
    } else {
      console.error("[AUTOCOMPLETE_GET]", userId, error);
    }
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
