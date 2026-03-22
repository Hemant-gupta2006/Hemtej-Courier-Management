import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";

export async function DELETE() {
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

    const result = await prisma.courierEntry.deleteMany({
      where: { userId },
    });

    return NextResponse.json({ success: true, data: { deleted: result.count } });
  } catch (error) {
    console.error("[COURIERS_DELETE_ALL]", userId, error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
