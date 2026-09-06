import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import * as XLSX from "xlsx";
import { formatWeight } from "@/lib/utils";
import { recordActivity } from "@/lib/activityLog";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return new NextResponse("Unauthorized", { status: 401 });

    const { searchParams } = new URL(req.url);
    const monthStr = searchParams.get("month");
    const yearStr = searchParams.get("year");

    if (!monthStr || !yearStr) {
      return new NextResponse("Month and Year are required", { status: 400 });
    }

    const month = parseInt(monthStr, 10);
    const year = parseInt(yearStr, 10);

    if (isNaN(month) || isNaN(year) || month < 1 || month > 12) {
      return new NextResponse("Invalid Month or Year", { status: 400 });
    }

    // Determine the start and end of the requested month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999); // last day of the month

    const where: any = {
      userId: (session.user as any).id,
      date: {
        gte: startDate,
        lte: endDate,
      },
    };

    // Fetch all entries for the logged-in user in this date range, ordered by date then createdAt
    const couriers = await prisma.courierEntry.findMany({
      where,
      orderBy: [
        { date: 'asc' },
        { createdAt: 'asc' }
      ],
    });

    if (couriers.length === 0) {
      return new NextResponse("No entries found for the selected month", { status: 404 });
    }

    const tableData = couriers.map((row, index) => ({
      "Sr.No": index + 1,
      "Date": new Date(row.date),
      "Challan No": row.challanNo,
      "From Party": row.fromParty,
      "To Party": row.toParty,
      "Destination": row.destination,
      "Weight": formatWeight(row.weightValue, row.weightUnit),
      "Amount": Number(row.amount) || 0,
      "Status": row.status,
      "Mode": row.mode
    }));

    const worksheet = XLSX.utils.json_to_sheet(tableData, { dateNF: "dd/mm/yyyy" });

    // Auto-size columns logic
    const colWidths = Object.keys(tableData[0] || {}).map((key) => {
      const maxLength = Math.max(
        key.length, // Header length
        ...tableData.map((row) => {
          const val = row[key as keyof typeof row];
          if (val instanceof Date) return 10; // dd/mm/yyyy is 10 chars
          return val ? String(val).length : 0;
        })
      );
      return { wch: maxLength + 2 }; // Add padding
    });

    worksheet["!cols"] = colWidths;

    const workbook = XLSX.utils.book_new();
    const monthName = startDate.toLocaleString('default', { month: 'long' });
    XLSX.utils.book_append_sheet(workbook, worksheet, `${monthName} ${year}`);

    // Generate buffer
    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });

    // Record Activity
    const sessionUser = session.user as any;
    await recordActivity({
      userId: sessionUser.id,
      userName: sessionUser.name || sessionUser.email || "Staff",
      role: sessionUser.role || "Staff",
      action: "REPORT_EXPORT",
      entity: "Report",
      entityId: `Monthly_${monthName}_${year}`,
      newValue: JSON.stringify({ month, year, entriesCount: couriers.length }),
      req
    });

    return new NextResponse(excelBuffer, {
      headers: {
        "Content-Disposition": `attachment; filename="${monthName} ${year}.xlsx"`,
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }
    });
  } catch (error) {
    console.error("[MONTHLY_EXPORT_GET]", error);
    return new NextResponse("Internal server error", { status: 500 });
  }
}
