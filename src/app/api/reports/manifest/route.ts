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
    const dateStr = searchParams.get("date") || new Date().toISOString().split('T')[0];

    const registerIdParam = searchParams.get("registerId");

    const targetDate = new Date(dateStr);
    const nextDate = new Date(targetDate);
    nextDate.setDate(targetDate.getDate() + 1);

    // Fetch entries for the specific day
    const where: any = {
      userId: (session.user as any).id,
      date: {
        gte: targetDate,
        lt: nextDate,
      },
    };

    if (registerIdParam) {
      where.registerId = registerIdParam;
    }

    const entries = await prisma.courierEntry.findMany({
      where,
      orderBy: [
        { destination: "asc" },
        { srNo: "asc" },
      ],
    });

    if (entries.length === 0) {
      return new NextResponse("No entries found for this date", { status: 404 });
    }


    // Prepare data for Excel
    const data = entries.map((e, index) => ({
      "Sr.No": index + 1,
      "Challan No": e.challanNo,
      "From Party": e.fromParty,
      "To Party": e.toParty,
      "Destination": e.destination,
      "Weight": formatWeight(e.weightValue, e.weightUnit),
      "Mode": e.mode || "Surface",
      "Status": e.status,
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);

    // Set column widths
    const colWidths = [
      { wch: 8 },  // Sr.No
      { wch: 12 }, // Challan
      { wch: 25 }, // From
      { wch: 25 }, // To
      { wch: 20 }, // Destination
      { wch: 12 }, // Weight
      { wch: 10 }, // Mode
      { wch: 12 }, // Status
    ];
    worksheet["!cols"] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Daily Manifest");

    const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });

    const sessionUser = session.user as any;
    await recordActivity({
      userId: sessionUser.id,
      userName: sessionUser.name || sessionUser.email || "Staff",
      role: sessionUser.role || "Staff",
      action: "MANIFEST_DOWNLOAD",
      entity: "Manifest",
      entityId: dateStr,
      newValue: JSON.stringify({ dateStr, entriesCount: entries.length }),
      req
    });

    return new NextResponse(buffer, {
      headers: {
        "Content-Disposition": `attachment; filename="Manifest_${dateStr}.xlsx"`,
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    });
  } catch (error) {
    console.error("[MANIFEST_REPORT_ERROR]", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
