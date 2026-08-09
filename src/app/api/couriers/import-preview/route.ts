import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { formatWeight } from "@/lib/utils";

// Helper to parse weight strings from Excel (e.g., "2 KG", "1.5 gm", "2.5")
function parseWeight(weightStr: string | number | undefined): { value: number; unit: string } {
  if (weightStr === undefined || weightStr === null || weightStr === "") {
    return { value: 0, unit: "gm" };
  }
  const str = String(weightStr).trim().toLowerCase();
  const match = str.match(/^([\d\.]+)\s*(.*)$/);
  
  if (match) {
    let value = parseFloat(match[1]) || 0;
    let unit = match[2].trim() || "gm";
    if (unit === "gm" || unit === "g" || unit === "grams") {
      unit = "gm";
      // Reverse the kg-like display format applied to grams (e.g., 100g -> "0.100 gm")
      if (str.includes(".") && value < 100) {
        value = Math.round(value * 1000);
      }
    } else if (unit === "kg" || unit === "kilograms") {
      unit = "kg";
    }
    return { value, unit };
  }
  return { value: parseFloat(str) || 0, unit: "gm" };
}

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

    // 3. Diff Engine - Compare fields
    const updates = [];
    const unchanged = [];
    const notFound = []; // New in Excel (skipped)

    // Aggregate statistics
    const fieldStats = {
      amount: 0,
      destination: 0,
      weight: 0,
      status: 0,
      mode: 0,
      date: 0,
      party: 0
    };

    for (const item of uniqueItems) {
      const cStr = String(item.challanNo);
      const dbRecord = existingMap.get(cStr);

      if (!dbRecord) {
        notFound.push(item);
        continue;
      }

      const rowChanges = [];

      // Field: Date
      const dbDateStr = dbRecord.date ? new Date(dbRecord.date).toISOString().split("T")[0] : "";
      const excelDateStr = item.date ? String(item.date).trim() : "";
      if (dbDateStr !== excelDateStr) {
        rowChanges.push({ field: "Date", oldValue: dbDateStr, newValue: excelDateStr, internalKey: "date" });
        fieldStats.date++;
      }

      // Field: From Party
      const dbFromParty = dbRecord.fromParty || "";
      const excelFromParty = item.fromParty ? String(item.fromParty).trim() : "";
      if (dbFromParty.toLowerCase() !== excelFromParty.toLowerCase()) {
        rowChanges.push({ field: "From Party", oldValue: dbFromParty, newValue: excelFromParty, internalKey: "fromParty" });
        fieldStats.party++;
      }

      // Field: To Party
      const dbToParty = dbRecord.toParty || "";
      const excelToParty = item.toParty ? String(item.toParty).trim() : "";
      if (dbToParty.toLowerCase() !== excelToParty.toLowerCase()) {
        rowChanges.push({ field: "To Party", oldValue: dbToParty, newValue: excelToParty, internalKey: "toParty" });
        if (dbFromParty.toLowerCase() === excelFromParty.toLowerCase()) fieldStats.party++; // avoid double counting if both changed
      }

      // Field: Destination
      const dbDest = dbRecord.destination || "";
      const excelDest = item.destination ? String(item.destination).trim() : "";
      if (dbDest.toLowerCase() !== excelDest.toLowerCase()) {
        rowChanges.push({ field: "Destination", oldValue: dbDest, newValue: excelDest, internalKey: "destination" });
        fieldStats.destination++;
      }

      // Field: Weight (Compare exported string representation first)
      const dbWeightStr = formatWeight(dbRecord.weightValue, dbRecord.weightUnit);
      const excelWeightRaw = item.weight !== undefined && item.weight !== null ? String(item.weight).trim() : "";
      
      // If the Excel string exactly matches what our system exported (e.g. "0.100 gm" for 100 gm),
      // then we consider it completely unchanged!
      if (dbWeightStr.toLowerCase() !== excelWeightRaw.toLowerCase() && excelWeightRaw !== "") {
        // Since it differs, the user typed something manually or changed the value.
        // We parse what they typed into physical values (e.g. "200 gm" -> 200 gm).
        const { value: excelWeightVal, unit: excelWeightUnit } = parseWeight(excelWeightRaw);
        
        // We double check if the physical numeric value is actually different 
        // to prevent false positives when format changes but physical value is same.
        if (dbRecord.weightValue !== excelWeightVal || dbRecord.weightUnit !== excelWeightUnit) {
          rowChanges.push({
            field: "Weight",
            oldValue: dbWeightStr,
            newValue: excelWeightRaw,
            internalKey: "weight",
            internalVal: { value: excelWeightVal, unit: excelWeightUnit }
          });
          fieldStats.weight++;
        }
      }

      // Field: Amount
      const dbAmount = Number(dbRecord.amount) || 0;
      const excelAmount = Number(item.amount) || 0;
      if (dbAmount !== excelAmount) {
        rowChanges.push({ field: "Amount", oldValue: dbAmount, newValue: excelAmount, internalKey: "amount" });
        fieldStats.amount++;
      }

      // Field: Status
      const dbStatus = dbRecord.status || "";
      const excelStatus = item.status ? String(item.status).trim() : "";
      if (dbStatus.toLowerCase() !== excelStatus.toLowerCase()) {
        rowChanges.push({ field: "Status", oldValue: dbStatus, newValue: excelStatus, internalKey: "status" });
        fieldStats.status++;
      }

      // Field: Mode
      const dbMode = dbRecord.mode || "";
      const excelMode = item.mode ? String(item.mode).trim() : "";
      if (dbMode.toLowerCase() !== excelMode.toLowerCase()) {
        rowChanges.push({ field: "Mode", oldValue: dbMode, newValue: excelMode, internalKey: "mode" });
        fieldStats.mode++;
      }

      if (rowChanges.length > 0) {
        updates.push({
          id: dbRecord.id,
          challanNo: dbRecord.challanNo,
          changes: rowChanges,
          // Sending down DB record state at the time of preview for zero-trust concurrency check
          dbSnapshot: {
            date: dbDateStr,
            fromParty: dbFromParty,
            toParty: dbToParty,
            destination: dbDest,
            weightValue: dbRecord.weightValue || 0,
            weightUnit: dbRecord.weightUnit || "gm",
            amount: dbAmount,
            status: dbStatus,
            mode: dbMode
          }
        });
      } else {
        unchanged.push({
          id: dbRecord.id,
          challanNo: dbRecord.challanNo
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        totalRows: items.length,
        updates,
        unchanged,
        notFound,
        duplicates: duplicatesInExcel,
        fieldStats
      }
    });
  } catch (error) {
    console.error("[IMPORT_PREVIEW_POST]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
