import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminSession, unauthorizedResponse } from "@/lib/adminAuth";

export async function GET(req: Request) {
  try {
    const session = await checkAdminSession();
    if (!session) return unauthorizedResponse();

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    // 15 minutes limit for active users presence
    const activeTimeLimit = new Date();
    activeTimeLimit.setMinutes(activeTimeLimit.getMinutes() - 15);

    // Run database queries in two focused batches to prevent connection pool exhaustion
    const [
      totalCouriers,
      todayBookings,
      monthlyBookings,
      totalRegisters,
      cashResult,
      accountResult,
      totalRevenueResult,
    ] = await Promise.all([
      prisma.courierEntry.count(),
      prisma.courierEntry.count({
        where: { date: { gte: startOfToday } }
      }),
      prisma.courierEntry.count({
        where: { date: { gte: startOfMonth } }
      }),
      prisma.courierRegister.count(),
      prisma.courierEntry.aggregate({
        _sum: { amount: true },
        where: { status: { equals: "Cash", mode: "insensitive" } }
      }),
      prisma.courierEntry.aggregate({
        _sum: { amount: true },
        where: { status: { equals: "Account", mode: "insensitive" } }
      }),
      prisma.courierEntry.aggregate({
        _sum: { amount: true },
        where: { NOT: { status: { equals: "Cancelled", mode: "insensitive" } } }
      }),
    ]);

    const [
      totalInvoices,
      totalManifests,
      recentAuditLogs,
      recentActiveLogs,
      customerCountResult
    ] = await Promise.all([
      prisma.auditLog.count({
        where: { action: "INVOICE_DOWNLOAD" }
      }),
      prisma.auditLog.count({
        where: { action: "MANIFEST_DOWNLOAD" }
      }),
      prisma.auditLog.findMany({
        orderBy: { timestamp: "desc" },
        take: 10
      }),
      prisma.auditLog.findMany({
        where: { timestamp: { gte: activeTimeLimit } },
        orderBy: { timestamp: "desc" }
      }),
      // High-performance distinct count via raw SQL instead of scanning all entries in memory
      prisma.$queryRaw<{ count: number }[]>`
        SELECT COUNT(DISTINCT lower(trim(party)))::int as count FROM (
          SELECT "fromParty" as party FROM "CourierEntry" WHERE "fromParty" IS NOT NULL AND TRIM("fromParty") != ''
          UNION ALL
          SELECT "toParty" as party FROM "CourierEntry" WHERE "toParty" IS NOT NULL AND TRIM("toParty") != ''
        ) as combined_parties
      `.catch(() => [{ count: 0 }])
    ]);

    const totalCustomers = customerCountResult[0]?.count || 0;

    // Active Users Presense
    const activeUsersMap: Record<string, { id: string; name: string; lastActive: Date; lastAction: string; isOnline: boolean }> = {};
    recentActiveLogs.forEach((log) => {
      if (!activeUsersMap[log.adminId]) {
        activeUsersMap[log.adminId] = {
          id: log.adminId,
          name: log.adminName,
          lastActive: log.timestamp,
          lastAction: log.action.replace(/_/g, " "),
          isOnline: true
        };
      }
    });
    const activeUsersList = Object.values(activeUsersMap);

    return NextResponse.json({
      success: true,
      data: {
        metrics: {
          totalCouriers,
          todayBookings,
          monthlyBookings,
          totalRegisters,
          totalCustomers,
          cashAmount: cashResult._sum.amount || 0,
          accountAmount: accountResult._sum.amount || 0,
          totalRevenue: totalRevenueResult._sum.amount || 0,
          totalInvoices,
          totalManifests
        },
        recentAuditLogs,
        activeUsers: activeUsersList
      }
    });
  } catch (error: any) {
    console.error("[ADMIN_OVERVIEW_GET]", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load dashboard statistics" },
      { status: 500 }
    );
  }
}
