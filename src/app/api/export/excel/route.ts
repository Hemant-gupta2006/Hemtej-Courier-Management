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
    const registerIdParam = searchParams.get("registerId");

    const where: any = { userId: (session.user as any).id };
    if (registerIdParam) {
      where.registerId = registerIdParam;
    }

    // Fetch all entries securely for the logged-in user, sorted by creation date
    const couriers = await prisma.courierEntry.findMany({
      where,
      orderBy: { srNo: 'asc' },
    });

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
    XLSX.utils.book_append_sheet(workbook, worksheet, "Couriers");

    // Generate buffer
    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });

    // Return as downloadable file
    const sessionUser = session.user as any;
    await recordActivity({
      userId: sessionUser.id,
      userName: sessionUser.name || sessionUser.email || "Staff",
      role: sessionUser.role || "Staff",
      action: "REPORT_EXPORT",
      entity: "Report",
      entityId: registerIdParam || "All",
      newValue: JSON.stringify({ registerId: registerIdParam, entriesCount: couriers.length }),
      req
    });

    return new NextResponse(excelBuffer, {
      headers: {
        "Content-Disposition": `attachment; filename="Couriers_Export_${new Date().toISOString().split('T')[0]}.xlsx"`,
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }
    });
  } catch (error) {
    console.log("[EXCEL_EXPORT_GET]", error);
    return new NextResponse("Internal server error", { status: 500 });
  }
}
