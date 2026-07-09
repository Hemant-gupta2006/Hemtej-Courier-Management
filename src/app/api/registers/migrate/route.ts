import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";

const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export async function POST(req: Request) {
  let userId = "unknown";
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !(session.user as any).id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    userId = String((session.user as any).id);

    if (!checkRateLimit(userId)) {
      return NextResponse.json({ success: false, error: "Too Many Requests" }, { status: 429 });
    }

    // Find all orphan entries in the system for this user (or all users if run as admin, but scoping to current user is safest)
    const orphanEntries = await prisma.courierEntry.findMany({
      where: { userId, registerId: null },
      select: { id: true, date: true }
    });

    if (orphanEntries.length === 0) {
      return NextResponse.json({ success: true, message: "No orphan entries to migrate." });
    }

    // Group orphans by month/year
    const groups: Record<string, { month: number; year: number; ids: string[] }> = {};
    for (const entry of orphanEntries) {
      const d = new Date(entry.date);
      const month = d.getMonth() + 1;
      const year = d.getFullYear();
      const key = `${month}-${year}`;

      if (!groups[key]) {
        groups[key] = { month, year, ids: [] };
      }
      groups[key].ids.push(entry.id);
    }

    let migratedCount = 0;
    for (const key of Object.keys(groups)) {
      const { month, year, ids } = groups[key];
      
      let register = await prisma.courierRegister.findFirst({
        where: { userId, month, year }
      });

      if (!register) {
        const name = `${monthNames[month - 1]} ${year}`;
        register = await prisma.courierRegister.create({
          data: {
            userId,
            month,
            year,
            name,
            status: "Active"
          }
        });
      }

      await prisma.courierEntry.updateMany({
        where: { id: { in: ids } },
        data: { registerId: register.id }
      });
      migratedCount += ids.length;
    }

    return NextResponse.json({
      success: true,
      message: `Successfully migrated ${migratedCount} orphan entries into monthly registers.`
    });
  } catch (error: any) {
    console.error("[REGISTERS_MIGRATE]", userId, error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
