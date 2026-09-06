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
    const modeParam = searchParams.get("mode");
    const fromPartyParam = searchParams.get("fromParty");
    const toPartyParam = searchParams.get("toParty");
    const destinationParam = searchParams.get("destination");
    const registerIdParam = searchParams.get("registerId");
    const sortByParam = searchParams.get("sortBy");
    const sortOrderParam = searchParams.get("sortOrder");

    // Build unique where clause
    const where: any = { userId };

    let registerName = "Couriers";
    if (registerIdParam) {
      where.registerId = registerIdParam;
      const reg = await prisma.courierRegister.findUnique({
        where: { id: registerIdParam },
        select: { name: true }
      });
      if (reg?.name) {
        registerName = reg.name.replace(/[^a-zA-Z0-9_-]/g, "_");
      }
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
      const statuses = statusParam.split(",").map(s => s.trim()).filter(Boolean);
      if (statuses.length === 1) {
        where.status = statuses[0];
      } else if (statuses.length > 1) {
        where.status = { in: statuses };
      }
    }

    if (modeParam && modeParam !== "all" && modeParam !== "") {
      const modes = modeParam.split(",").map(m => m.trim()).filter(Boolean);
      if (modes.length === 1) {
        where.mode = modes[0];
      } else if (modes.length > 1) {
        where.mode = { in: modes };
      }
    }

    if (fromPartyParam && fromPartyParam !== "all" && fromPartyParam !== "") {
      const parties = fromPartyParam.split(",").map(p => p.trim()).filter(Boolean);
      if (parties.length === 1) {
        where.fromParty = { equals: parties[0], mode: "insensitive" };
      } else if (parties.length > 1) {
        where.fromParty = { in: parties, mode: "insensitive" };
      }
    }

    if (toPartyParam && toPartyParam !== "all" && toPartyParam !== "") {
      const parties = toPartyParam.split(",").map(p => p.trim()).filter(Boolean);
      if (parties.length === 1) {
        where.toParty = { equals: parties[0], mode: "insensitive" };
      } else if (parties.length > 1) {
        where.toParty = { in: parties, mode: "insensitive" };
      }
    }

    if (destinationParam && destinationParam !== "all" && destinationParam !== "") {
      const dests = destinationParam.split(",").map(d => d.trim()).filter(Boolean);
      if (dests.length === 1) {
        where.destination = { equals: dests[0], mode: "insensitive" };
      } else if (dests.length > 1) {
        where.destination = { in: dests, mode: "insensitive" };
      }
    }

    if (searchParam) {
      const trimmedSearch = searchParam.trim();
      const searchNum = parseInt(trimmedSearch, 10);
      where.OR = [
        { fromParty: { contains: trimmedSearch, mode: "insensitive" } },
        { toParty: { contains: trimmedSearch, mode: "insensitive" } },
        { destination: { contains: trimmedSearch, mode: "insensitive" } },
        { status: { contains: trimmedSearch, mode: "insensitive" } },
        { mode: { contains: trimmedSearch, mode: "insensitive" } },
      ];
      if (!isNaN(searchNum)) {
        where.OR.push({ challanNo: searchNum });
        where.OR.push({ amount: searchNum });
      }
    }

    // Safe sorting allowlist
    const allowedSortFields = ["srNo", "date", "challanNo", "fromParty", "toParty", "weightValue", "destination", "amount", "status", "mode"];
    let orderBy: any = [{ srNo: "asc" }];
    if (sortByParam && allowedSortFields.includes(sortByParam)) {
      orderBy = [{ [sortByParam]: sortOrderParam === "asc" ? "asc" : "desc" }, { srNo: "asc" }];
    }

    // Fetch all entries securely for the logged-in user, filtered
    const couriers = await prisma.courierEntry.findMany({
      where,
      orderBy,
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
        "Content-Disposition": `attachment; filename="${registerName}_Filtered_Export_${new Date().toISOString().split('T')[0]}.xlsx"`,
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }
    });
  } catch (error) {
    console.log("[EXCEL_EXPORT_GET]", error);
    return new NextResponse("Internal server error", { status: 500 });
  }
}
