import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminSession, unauthorizedResponse } from "@/lib/adminAuth";

export async function GET(req: Request) {
  try {
    const session = await checkAdminSession();
    if (!session) return unauthorizedResponse();

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    // Run parallel queries for analytics data
    const [recentEntries, monthlyEntriesRaw, destinationsGroup, cashSum, accountSum] = await Promise.all([
      // Fetch recent 30 days entries
      prisma.courierEntry.findMany({
        where: { date: { gte: thirtyDaysAgo } },
        select: { date: true, amount: true }
      }),

      // Fetch recent 6 months entries
      prisma.courierEntry.findMany({
        where: { date: { gte: sixMonthsAgo } },
        select: { date: true, amount: true }
      }),

      // Group by destination
      prisma.courierEntry.groupBy({
        by: ["destination"],
        _count: { id: true },
        _sum: { amount: true },
        orderBy: {
          _count: { id: "desc" }
        },
        take: 10
      }),

      // Cash amount
      prisma.courierEntry.aggregate({
        _sum: { amount: true },
        where: { status: { equals: "Cash", mode: "insensitive" } }
      }),

      // Account amount
      prisma.courierEntry.aggregate({
        _sum: { amount: true },
        where: { status: { equals: "Account", mode: "insensitive" } }
      })
    ]);

    // 1. Process Entries Per Day (last 15 days pre-populated)
    const dayMap: Record<string, { date: string; count: number; amount: number }> = {};
    for (let i = 14; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const isoStr = d.toISOString().split("T")[0];
      dayMap[isoStr] = { date: dateStr, count: 0, amount: 0 };
    }

    recentEntries.forEach((entry) => {
      const isoStr = entry.date.toISOString().split("T")[0];
      if (dayMap[isoStr]) {
        dayMap[isoStr].count += 1;
        dayMap[isoStr].amount += entry.amount || 0;
      }
    });

    const entriesPerDay = Object.keys(dayMap)
      .sort()
      .map((k) => dayMap[k]);

    // 2. Process Entries Per Month (last 6 months pre-populated)
    const monthMap: Record<string, { month: string; count: number; amount: number }> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const monthLabel = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthMap[key] = { month: monthLabel, count: 0, amount: 0 };
    }

    monthlyEntriesRaw.forEach((entry) => {
      const key = `${entry.date.getFullYear()}-${String(entry.date.getMonth() + 1).padStart(2, "0")}`;
      if (monthMap[key]) {
        monthMap[key].count += 1;
        monthMap[key].amount += entry.amount || 0;
      }
    });

    const entriesPerMonth = Object.keys(monthMap)
      .sort()
      .map((k) => monthMap[k]);

    // 3. Process Top Destinations
    const topDestinations = destinationsGroup.map((item) => ({
      destination: item.destination || "Unknown",
      count: item._count.id,
      amount: item._sum.amount || 0
    }));

    return NextResponse.json({
      success: true,
      data: {
        entriesPerDay,
        entriesPerMonth,
        revenueBreakdown: [
          { name: "Cash Collection", value: cashSum._sum.amount || 0 },
          { name: "Ledger Account", value: accountSum._sum.amount || 0 }
        ],
        topDestinations
      }
    });
  } catch (error: any) {
    console.error("[ADMIN_ANALYTICS_GET]", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to calculate analytics metrics" },
      { status: 500 }
    );
  }
}
