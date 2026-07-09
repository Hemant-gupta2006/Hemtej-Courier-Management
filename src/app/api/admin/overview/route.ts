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

    // Run parallel database queries for business metrics
    const [
      totalCouriers,
      todayBookings,
      monthlyBookings,
      totalRegisters,
      cashResult,
      accountResult,
      totalRevenueResult,
      totalInvoices,
      totalManifests,
      recentAuditLogs,
      recentActiveLogs,
      fromParties,
      toParties
    ] = await Promise.all([
      // Total Courier Entries
      prisma.courierEntry.count(),

      // Today's Entries
      prisma.courierEntry.count({
        where: { date: { gte: startOfToday } }
      }),

      // This Month Entries
      prisma.courierEntry.count({
        where: { date: { gte: startOfMonth } }
      }),

      // Total Registers
      prisma.courierRegister.count(),

      // Cash Amount sum
      prisma.courierEntry.aggregate({
        _sum: { amount: true },
        where: { status: { equals: "Cash", mode: "insensitive" } }
      }),

      // Account Amount sum
      prisma.courierEntry.aggregate({
        _sum: { amount: true },
        where: { status: { equals: "Account", mode: "insensitive" } }
      }),

      // Total Revenue sum (all except cancelled if status === Cancelled)
      prisma.courierEntry.aggregate({
        _sum: { amount: true },
        where: { NOT: { status: { equals: "Cancelled", mode: "insensitive" } } }
      }),

      // Total Invoices Generated
      prisma.auditLog.count({
        where: { action: "INVOICE_DOWNLOAD" }
      }),

      // Total Manifests Generated
      prisma.auditLog.count({
        where: { action: "MANIFEST_DOWNLOAD" }
      }),

      // Chronological Audit Logs (Latest Activity)
      prisma.auditLog.findMany({
        orderBy: { timestamp: "desc" },
        take: 10
      }),

      // Audit logs for active presence in the last 15 minutes
      prisma.auditLog.findMany({
        where: { timestamp: { gte: activeTimeLimit } },
        orderBy: { timestamp: "desc" }
      }),

      // Unique senders
      prisma.courierEntry.findMany({
        distinct: ["fromParty"],
        select: { fromParty: true }
      }),

      // Unique receivers
      prisma.courierEntry.findMany({
        distinct: ["toParty"],
        select: { toParty: true }
      })
    ]);

    // Calculate unique customers count
    const uniqueCustomers = new Set([
      ...fromParties.map((p) => p.fromParty.trim().toLowerCase()),
      ...toParties.map((p) => p.toParty.trim().toLowerCase())
    ]);
    const totalCustomers = uniqueCustomers.size;

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
