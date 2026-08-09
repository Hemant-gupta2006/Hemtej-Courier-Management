import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const userName = session.user?.name || "Unknown User";

    const body = await req.json();
    const { sourceRegisterIds, newRegisterName } = body;

    // Basic body validation
    if (!Array.isArray(sourceRegisterIds) || sourceRegisterIds.length < 2) {
      return NextResponse.json({ error: "At least 2 source registers are required." }, { status: 400 });
    }
    if (!newRegisterName || typeof newRegisterName !== "string" || newRegisterName.trim() === "") {
      return NextResponse.json({ error: "A valid new register name is required." }, { status: 400 });
    }

    const uniqueSourceIds = Array.from(new Set(sourceRegisterIds));
    if (uniqueSourceIds.length !== sourceRegisterIds.length) {
      return NextResponse.json({ error: "Duplicate source registers provided." }, { status: 400 });
    }

    const finalRegisterName = newRegisterName.trim();

    // The interactive transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Re-validate source registers inside the transaction
      const sourceRegisters = await tx.courierRegister.findMany({
        where: {
          id: { in: uniqueSourceIds },
          userId: userId
        },
        include: {
          _count: {
            select: { courierEntries: true }
          }
        }
      });

      if (sourceRegisters.length !== uniqueSourceIds.length) {
        throw new Error("One or more source registers were not found or do not belong to you.");
      }

      // Check Active status, month, and year
      const firstReg = sourceRegisters[0];
      let expectedEntryCount = 0;
      const sourceRegisterDetails = [];

      for (const reg of sourceRegisters) {
        if (reg.status !== "Active") {
          throw new Error(`Register "${reg.name}" is not Active. Only Active registers can be combined.`);
        }
        if (reg.month !== firstReg.month || reg.year !== firstReg.year) {
          throw new Error("All source registers must have the same month and year.");
        }
        expectedEntryCount += reg._count.courierEntries;
        sourceRegisterDetails.push({ id: reg.id, name: reg.name, entryCount: reg._count.courierEntries });
      }

      // 2. Create the new combined register
      // Catch unique constraint violation to handle race conditions gracefully
      let newRegister;
      try {
        newRegister = await tx.courierRegister.create({
          data: {
            userId: userId,
            name: finalRegisterName,
            month: firstReg.month,
            year: firstReg.year,
            status: "Active"
          }
        });
      } catch (err: any) {
        if (err.code === "P2002") {
          throw new Error(`A register named "${finalRegisterName}" already exists.`);
        }
        throw err;
      }

      // 3. Move ALL entries securely
      const updateResult = await tx.courierEntry.updateMany({
        where: {
          userId: userId,
          registerId: { in: uniqueSourceIds }
        },
        data: {
          registerId: newRegister.id
        }
      });

      // 4. Verify exact count moved
      if (updateResult.count !== expectedEntryCount) {
        throw new Error(`Integrity Error: Expected to move ${expectedEntryCount} entries, but moved ${updateResult.count}. Rolling back.`);
      }

      // 5. Archive source registers
      await tx.courierRegister.updateMany({
        where: {
          userId: userId,
          id: { in: uniqueSourceIds }
        },
        data: {
          status: "Archived"
        }
      });

      // 6. Create Audit Log inside transaction
      await tx.auditLog.create({
        data: {
          adminId: userId,
          adminName: userName,
          action: "REGISTER_MERGED",
          entity: "CourierRegister",
          entityId: newRegister.id,
          newValue: JSON.stringify({
            sourceRegisters: sourceRegisterDetails,
            newRegisterName: finalRegisterName,
            totalEntriesMoved: expectedEntryCount
          })
        }
      });

      return {
        newRegister,
        totalMoved: expectedEntryCount
      };
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error("[COMBINE_REGISTERS_ERROR]", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to combine registers." },
      { status: 500 }
    );
  }
}
