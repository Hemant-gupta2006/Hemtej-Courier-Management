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
    const userId = (session.user as any).id;

    const body = await req.json();
    const { field, oldVal, newVal } = body;

    const allowedFields = ["fromParty", "toParty", "destination"];
    if (!allowedFields.includes(field)) {
      return NextResponse.json({ success: false, error: "Invalid field specified" }, { status: 400 });
    }

    const trimmedOld = (oldVal || "").trim();
    const trimmedNew = (newVal || "").trim();

    if (!trimmedOld || !trimmedNew) {
      return NextResponse.json(
        { success: false, error: "Both current value and new value are required" },
        { status: 400 }
      );
    }

    if (trimmedOld.toLowerCase() === trimmedNew.toLowerCase() && trimmedOld === trimmedNew) {
      return NextResponse.json(
        { success: false, error: "The new value is identical to the current value" },
        { status: 400 }
      );
    }

    // Update all matching CourierEntry records for this user
    const result = await prisma.courierEntry.updateMany({
      where: {
        userId,
        [field]: { equals: trimmedOld, mode: "insensitive" },
      },
      data: {
        [field]: trimmedNew,
      },
    });

    // If the new name was previously in the exclusions list, unexclude it
    await prisma.auditLog.deleteMany({
      where: {
        action: "EXCLUDED_SUGGESTION",
        oldValue: userId,
        entityId: trimmedNew.toLowerCase(),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        field,
        oldValue: trimmedOld,
        newValue: trimmedNew,
        updatedEntriesCount: result.count,
        message: `Successfully updated ${result.count} entry/entries from "${trimmedOld}" to "${trimmedNew}".`,
      },
    });
  } catch (error) {
    console.error("[AUTOCOMPLETE_RENAME_ERROR]", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
