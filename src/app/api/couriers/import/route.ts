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
    const { registerId, updates, fileName, totalRows, notFoundCount, duplicatesCount } = body;

    if (!registerId) {
      return NextResponse.json({ success: false, error: "registerId is required" }, { status: 400 });
    }

    if (!Array.isArray(updates)) {
      return NextResponse.json({ success: false, error: "Updates must be an array" }, { status: 400 });
    }

    if (updates.length === 0) {
      return NextResponse.json({ success: true, message: "No updates to process" });
    }

    // Process all updates in a single transaction
    const transaction = await prisma.$transaction(async (tx) => {
      let updatedCount = 0;
      for (const update of updates) {
        // Authoritative lookup by challanNo + userId + registerId
        const record = await tx.courierEntry.findFirst({
          where: {
            challanNo: Number(update.challanNo),
            userId,
            registerId
          }
        });

        if (record) {
          await tx.courierEntry.update({
            where: { id: record.id },
            data: { amount: Number(update.newAmount) }
          });
          updatedCount++;
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
          oldValue: JSON.stringify({ file: fileName, total: totalRows, duplicates: duplicatesCount, notFound: notFoundCount }),
          newValue: JSON.stringify({ updated: updatedCount })
        }
      });

      return { updatedCount };
    });

    return NextResponse.json({
      success: true,
      data: {
        updatedCount: transaction.updatedCount
      }
    });
  } catch (error) {
    console.error("[IMPORT_POST]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
