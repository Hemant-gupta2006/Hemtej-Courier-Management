import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import * as XLSX from "xlsx";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return new NextResponse("Unauthorized", { status: 401 });

    // Fetch all entries securely for the logged-in user, sorted by creation date
    const couriers = await prisma.courierEntry.findMany({
      where: { userId: (session.user as any).id },
      orderBy: { srNo: 'asc' },
    });

    const formatExportWeight = (weightStr: string | null) => {
      if (!weightStr) return "";
      const lower = String(weightStr).toLowerCase().trim();
      
      if (lower.includes("kg")) {
        const num = parseFloat(lower);
        return !isNaN(num) ? `${num} kg` : lower.replace(/\s+/g, "");
      }
      
      const g = parseFloat(lower);
      if (isNaN(g)) return lower;
      
      if (g >= 1000) {
        return `${Number((g / 1000).toFixed(3))} kg`;
      }
      
      // Reverted logic for grams to original format
      return `${(g / 1000).toFixed(3)}gm`;
    };

    const tableData = couriers.map(row => ({
      "Sr.No": Number(row.srNo) || 0,
      "Date": new Date(row.date),
      "Challan No": row.challanNo,
      "From Party": row.fromParty,
      "To Party": row.toParty,
      "Weight": formatExportWeight(row.weight),
      "Destination": row.destination,
      "Amount": Number(row.amount) || 0,
      "Status": row.status
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
