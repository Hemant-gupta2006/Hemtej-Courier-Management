import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { formatWeight } from "@/lib/utils";

function processSuggestions(items: (string | null | undefined)[]): string[] {
  const map = new Map<string, { original: string; count: number; firstSeenIndex: number }>();
  let index = 0;
  for (const item of items) {
    if (!item) continue;
    const trimmed = item.trim();
    if (!trimmed) continue;
    const lower = trimmed.toLowerCase();
    const existing = map.get(lower);
    if (existing) {
      existing.count += 1;
    } else {
      map.set(lower, { original: trimmed, count: 1, firstSeenIndex: index });
    }
    index++;
  }
  return Array.from(map.values())
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.firstSeenIndex - b.firstSeenIndex;
    })
    .map((x) => x.original);
}

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
        weightValue: true,
        weightUnit: true,
        status: true,
      },
      take: 2000,
      orderBy: { createdAt: 'desc' }
    });

    const destinations = processSuggestions(couriers.map(c => c.destination));
    const fromParties = processSuggestions(couriers.map(c => c.fromParty));
    const toParties = processSuggestions(couriers.map(c => c.toParty));
    const weights = processSuggestions(couriers.map(c => formatWeight(c.weightValue, c.weightUnit)));
    const statuses = processSuggestions(couriers.map(c => c.status));

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

