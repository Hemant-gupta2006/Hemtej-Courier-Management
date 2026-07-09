import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminSession, unauthorizedResponse } from "@/lib/adminAuth";

export async function GET(req: Request) {
  try {
    const session = await checkAdminSession();
    if (!session) return unauthorizedResponse();

    const { searchParams } = new URL(req.url);
    const pageParam = searchParams.get("page") || "1";
    const limitParam = searchParams.get("limit") || "10";
    const searchParam = searchParams.get("search") || "";
    const statusParam = searchParams.get("status") || "";
    const startDateParam = searchParams.get("startDate") || "";
    const endDateParam = searchParams.get("endDate") || "";
    const customerParam = searchParams.get("customer") || "";
    const sortByParam = searchParams.get("sortBy") || "createdAt";
    const sortOrderParam = searchParams.get("sortOrder") || "desc";

    const page = parseInt(pageParam, 10);
    const limit = parseInt(limitParam, 10);
    const skip = (page - 1) * limit;

    const where: any = {};

    // 1. Search Query
    if (searchParam) {
      const searchNum = parseInt(searchParam, 10);
      const orConditions: any[] = [
        { id: { contains: searchParam, mode: "insensitive" } },
        { fromParty: { contains: searchParam, mode: "insensitive" } },
        { toParty: { contains: searchParam, mode: "insensitive" } },
        { destination: { contains: searchParam, mode: "insensitive" } },
      ];

      if (!isNaN(searchNum)) {
        orConditions.push({ challanNo: searchNum });
      }

      where.OR = orConditions;
    }

    // 2. Status Filter
    if (statusParam && statusParam !== "all") {
      where.status = { equals: statusParam, mode: "insensitive" };
    }

    // 3. Customer Filter
    if (customerParam) {
      where.OR = [
        { fromParty: { equals: customerParam, mode: "insensitive" } },
        { toParty: { equals: customerParam, mode: "insensitive" } }
      ];
    }

    // 4. Date Filter
    if (startDateParam && endDateParam) {
      where.date = {
        gte: new Date(startDateParam),
        lte: new Date(endDateParam + "T23:59:59.999Z")
      };
    } else if (startDateParam) {
      where.date = { gte: new Date(startDateParam) };
    } else if (endDateParam) {
      where.date = { lte: new Date(endDateParam + "T23:59:59.999Z") };
    }

    // Determine orderBy key
    const allowedSortFields = ["date", "challanNo", "amount", "status", "createdAt", "weightValue", "fromParty", "toParty"];
    const orderByField = allowedSortFields.includes(sortByParam) ? sortByParam : "createdAt";
    const orderByOrder = sortOrderParam === "asc" ? "asc" : "desc";

    const [couriers, total] = await Promise.all([
      prisma.courierEntry.findMany({
        where,
        orderBy: { [orderByField]: orderByOrder },
        skip,
        take: limit,
        include: {
          user: {
            select: { name: true, email: true }
          }
        }
      }),
      prisma.courierEntry.count({ where })
    ]);

    return NextResponse.json({
      success: true,
      data: {
        couriers,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error: any) {
    console.error("[ADMIN_COURIERS_GET]", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to query courier entries" },
      { status: 500 }
    );
  }
}
