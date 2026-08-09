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
    const { registerId, updates, insertions, fileName, totalRows, notFoundCount, duplicatesCount } = body;

    if (!registerId) {
      return NextResponse.json({ success: false, error: "registerId is required" }, { status: 400 });
    }

    if (!Array.isArray(updates)) {
      return NextResponse.json({ success: false, error: "Updates must be an array" }, { status: 400 });
    }

    if (updates.length === 0 && (!Array.isArray(insertions) || insertions.length === 0)) {
      return NextResponse.json({ success: true, message: "No changes to process" });
    }

    // Process all updates in a single transaction
    const transaction = await prisma.$transaction(async (tx) => {
      let updatedCount = 0;
      let conflictCount = 0;
      const fieldChangesLog: any[] = [];

      for (const update of updates) {
        // Authoritative lookup by challanNo + userId + registerId
        const record = await tx.courierEntry.findFirst({
          where: {
            challanNo: Number(update.challanNo),
            userId,
            registerId
          }
        });

        if (!record) continue;

        // Zero-Trust Concurrency Validation:
        // Ensure the record's current state exactly matches the state observed during preview.
        const dbDateStr = record.date ? new Date(record.date).toISOString().split("T")[0] : "";
        const snapshot = update.dbSnapshot;
        if (!snapshot) continue; // Invalid payload

        const isConflict =
          dbDateStr !== snapshot.date ||
          (record.fromParty || "") !== snapshot.fromParty ||
          (record.toParty || "") !== snapshot.toParty ||
          (record.destination || "") !== snapshot.destination ||
          (record.weightValue || 0) !== snapshot.weightValue ||
          (record.weightUnit || "gm") !== snapshot.weightUnit ||
          (Number(record.amount) || 0) !== snapshot.amount ||
          (record.status || "") !== snapshot.status ||
          (record.mode || "") !== snapshot.mode;

        if (isConflict) {
          conflictCount++;
          continue; // Skip this record, do not overwrite newer DB changes
        }

        // Build the update payload based strictly on the verified changes
        const dataToUpdate: any = {};
        const logChanges: any = { challanNo: record.challanNo, changes: {} };

        for (const change of update.changes) {
          if (change.internalKey === "date") {
            dataToUpdate.date = change.newValue ? new Date(change.newValue) : null;
          } else if (change.internalKey === "weight") {
            dataToUpdate.weightValue = change.internalVal.value;
            dataToUpdate.weightUnit = change.internalVal.unit;
          } else if (["fromParty", "toParty", "destination", "status", "mode"].includes(change.internalKey)) {
            dataToUpdate[change.internalKey] = change.newValue;
          } else if (change.internalKey === "amount") {
            dataToUpdate.amount = Number(change.newValue);
          }
          logChanges.changes[change.field] = { old: change.oldValue, new: change.newValue };
        }

        if (Object.keys(dataToUpdate).length > 0) {
          await tx.courierEntry.update({
            where: { id: record.id },
            data: dataToUpdate
          });
          updatedCount++;
          fieldChangesLog.push(logChanges);
        }
      }

      // Process insertions (NEW_IN_EXCEL rows)
      let insertedCount = 0;
      const insertedRecords: any[] = [];
      const insertionLog: any[] = [];

      if (Array.isArray(insertions) && insertions.length > 0) {
        // Pre-fetch the max srNo once before the loop
        const maxSrNoResult = await tx.courierEntry.aggregate({
          where: { userId },
          _max: { srNo: true }
        });
        let currentMaxSrNo = maxSrNoResult._max.srNo || 0;

        for (const item of insertions) {
          const cNo = Number(item.challanNo);
          if (!cNo || isNaN(cNo)) continue;

          // 1. Duplicate check (prevent overwriting or double insertion)
          const exists = await tx.courierEntry.findFirst({
            where: { challanNo: cNo, userId, registerId }
          });
          if (exists) continue; // Skip if it somehow exists now

          // 2. Parse weight robustly (reusing the same logic)
          let weightVal = 0;
          let weightUnit = "gm";
          if (item.weight) {
            const str = String(item.weight).trim().toLowerCase();
            const match = str.match(/^([\d\.]+)\s*(.*)$/);
            if (match) {
              weightVal = parseFloat(match[1]) || 0;
              weightUnit = match[2].trim() || "gm";
              if (weightUnit === "gm" || weightUnit === "g" || weightUnit === "grams") {
                weightUnit = "gm";
                if (str.includes(".") && weightVal < 100) {
                  weightVal = Math.round(weightVal * 1000);
                }
              } else if (weightUnit === "kg" || weightUnit === "kilograms") {
                weightUnit = "kg";
              }
            } else {
              weightVal = parseFloat(str) || 0;
            }
          }

          currentMaxSrNo++;

          // 3. Create the record
          const newRecord = await tx.courierEntry.create({
            data: {
              srNo: currentMaxSrNo,
              userId,
              registerId,
              challanNo: cNo,
              date: item.date ? new Date(item.date) : new Date(),
              fromParty: String(item.fromParty || "").trim(),
              toParty: String(item.toParty || "").trim(),
              destination: String(item.destination || "").trim(),
              weightValue: weightVal,
              weightUnit: weightUnit,
              amount: Number(item.amount) || 0,
              status: String(item.status || "").trim(),
              mode: String(item.mode || "Surface").trim()
            }
          });

          insertedCount++;
          insertedRecords.push(newRecord);
          insertionLog.push(cNo);
        }
      }

      // Record an audit log for the import operation
      await tx.auditLog.create({
        data: {
          adminId: userId,
          adminName: session.user.name || session.user.email || "Unknown User",
          action: "EXCEL_IMPORT",
          entity: "CourierRegister",
          entityId: registerId,
          oldValue: JSON.stringify({
            file: fileName,
            total: totalRows,
            duplicates: duplicatesCount,
            notFound: notFoundCount,
            conflicts: conflictCount
          }),
          newValue: JSON.stringify({
            updated: updatedCount,
            inserted: insertedCount,
            fieldChanges: fieldChangesLog,
            insertions: insertionLog
          })
        }
      });

      return { updatedCount, conflictCount, insertedCount, insertedRecords };
    }, {
      maxWait: 5000, // 5 seconds max wait to acquire the transaction
      timeout: 60000 // 60 seconds transaction timeout
    });

    return NextResponse.json({
      success: true,
      data: {
        updatedCount: transaction.updatedCount,
        conflictCount: transaction.conflictCount,
        insertedCount: transaction.insertedCount,
        insertedRecords: transaction.insertedRecords
      }
    });
  } catch (error) {
    console.error("[IMPORT_POST]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
