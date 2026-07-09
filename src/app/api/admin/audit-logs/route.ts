import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminSession, unauthorizedResponse } from "@/lib/adminAuth";

export async function GET(req: Request) {
  try {
    const session = await checkAdminSession();
    if (!session) return unauthorizedResponse();

    const { searchParams } = new URL(req.url);
    const pageParam = searchParams.get("page") || "1";
    const limitParam = searchParams.get("limit") || "20";
    const searchParam = searchParams.get("search") || "";
    const actionFilter = searchParams.get("action") || "";
    const adminIdFilter = searchParams.get("adminId") || "";
    const startDateParam = searchParams.get("startDate") || "";
    const endDateParam = searchParams.get("endDate") || "";

    const page = parseInt(pageParam, 10);
    const limit = parseInt(limitParam, 10);
    const skip = (page - 1) * limit;

    const where: any = {};

    if (searchParam) {
      where.OR = [
        { adminName: { contains: searchParam, mode: "insensitive" } },
        { action: { contains: searchParam, mode: "insensitive" } },
        { entity: { contains: searchParam, mode: "insensitive" } },
        { entityId: { contains: searchParam, mode: "insensitive" } },
        { oldValue: { contains: searchParam, mode: "insensitive" } },
        { newValue: { contains: searchParam, mode: "insensitive" } }
      ];
    }

    if (actionFilter) {
      where.action = { equals: actionFilter };
    }

    if (adminIdFilter) {
      where.adminId = { equals: adminIdFilter };
    }

    if (startDateParam || endDateParam) {
      where.timestamp = {};
      if (startDateParam) {
        where.timestamp.gte = new Date(startDateParam);
      }
      if (endDateParam) {
        const nextDay = new Date(endDateParam);
        nextDay.setDate(nextDay.getDate() + 1);
        where.timestamp.lt = nextDay;
      }
    }

    const [logs, total, filterUsers, filterActions] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: "desc" },
        skip,
        take: limit
      }),
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        distinct: ["adminId"],
        select: { adminId: true, adminName: true }
      }),
      prisma.auditLog.findMany({
        distinct: ["action"],
        select: { action: true }
      })
    ]);

    return NextResponse.json({
      success: true,
      data: {
        logs,
        filterUsers,
        filterActions: filterActions.map(a => a.action),
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error: any) {
    console.error("[ADMIN_AUDIT_LOGS_GET]", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load audit logs" },
      { status: 500 }
    );
  }
}
