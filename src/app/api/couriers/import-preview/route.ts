import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !(session.user as any).id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const userId = String((session.user as any).id);

    const body = await req.json();
    const { registerId, items } = body;

    if (!registerId) {
      return NextResponse.json({ success: false, error: "registerId is required" }, { status: 400 });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, error: "No items provided for import preview" }, { status: 400 });
    }

    // 1. Detect duplicates within the Excel file itself
    const challanCounts: Record<string, number> = {};
    for (const item of items) {
      const cStr = String(item.challanNo);
      challanCounts[cStr] = (challanCounts[cStr] || 0) + 1;
    }

    const duplicateChallans = Object.keys(challanCounts).filter(c => challanCounts[c] > 1);
    const duplicatesInExcel = items.filter(item => duplicateChallans.includes(String(item.challanNo)));
    
    // Filter out duplicates from processing updates
    const uniqueItemsMap = new Map();
    for (const item of items) {
      const cStr = String(item.challanNo);
      if (!duplicateChallans.includes(cStr)) {
        uniqueItemsMap.set(cStr, item);
      }
    }
    const uniqueItems = Array.from(uniqueItemsMap.values());
    const challansToLookup = uniqueItems.map(item => Number(item.challanNo));

    // 2. Fetch authoritative database records
    const existingRecords = await prisma.courierEntry.findMany({
      where: {
        userId,
        registerId,
        challanNo: { in: challansToLookup }
      }
    });

    const existingMap = new Map();
    for (const record of existingRecords) {
      existingMap.set(String(record.challanNo), record);
    }

    // 3. Categorize changes
    const updates = [];
    const unchanged = [];
    const notFound = [];

    for (const item of uniqueItems) {
      const cStr = String(item.challanNo);
      const dbRecord = existingMap.get(cStr);

      if (!dbRecord) {
        notFound.push(item);
        continue;
      }

      const excelAmount = Number(item.amount) || 0;
      const dbAmount = Number(dbRecord.amount) || 0;

      if (excelAmount !== dbAmount) {
        updates.push({
          id: dbRecord.id,
          challanNo: dbRecord.challanNo,
          fromParty: dbRecord.fromParty,
          toParty: dbRecord.toParty,
          oldAmount: dbAmount,
          newAmount: excelAmount,
          status: dbRecord.status,
          mode: dbRecord.mode
        });
      } else {
        unchanged.push({
          id: dbRecord.id,
          challanNo: dbRecord.challanNo,
          amount: dbAmount
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        totalRows: items.length,
        matchedRows: updates.length + unchanged.length,
        updates,
        unchanged,
        notFound,
        duplicates: duplicatesInExcel
      }
    });
  } catch (error) {
    console.error("[IMPORT_PREVIEW_POST]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
