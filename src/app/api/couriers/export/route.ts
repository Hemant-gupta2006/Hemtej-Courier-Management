import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import * as XLSX from "xlsx";
import { formatWeight } from "@/lib/utils";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !(session.user as any).id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
    const userId = String((session.user as any).id);

    const { searchParams } = new URL(req.url);
    const searchParam = searchParams.get("search");
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");
    const statusParam = searchParams.get("status");
    const registerIdParam = searchParams.get("registerId");

    // Build unique where clause
    const where: any = { userId };

    if (registerIdParam) {
      where.registerId = registerIdParam;
    }

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

    if (statusParam && statusParam !== "all" && statusParam !== "") {
      where.status = statusParam;
    }

    if (searchParam) {
      const searchNum = parseInt(searchParam, 10);
      where.OR = [
        { fromParty: { contains: searchParam, mode: "insensitive" } },
        { toParty: { contains: searchParam, mode: "insensitive" } },
        { destination: { contains: searchParam, mode: "insensitive" } },
      ];
      if (!isNaN(searchNum)) {
        where.OR.push({ challanNo: searchNum });
      }
    }

    // Fetch all entries securely for the logged-in user, filtered
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

    if (tableData.length === 0) {
      tableData.push({
        "Sr.No": 0,
        "Date": new Date(),
        "Challan No": 0,
        "From Party": "No data",
        "To Party": "No data",
        "Destination": "No data",
        "Weight": "0",
        "Amount": 0,
        "Status": "No data",
        "Mode": "No data"
      });
    }

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
    return new NextResponse(excelBuffer, {
      headers: {
        "Content-Disposition": `attachment; filename="Couriers_Filtered_Export_${new Date().toISOString().split('T')[0]}.xlsx"`,
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }
    });
  } catch (error) {
    console.log("[EXCEL_EXPORT_GET]", error);
    return new NextResponse("Internal server error", { status: 500 });
  }
}
