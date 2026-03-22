import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !(session.user as any).id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const userId = String((session.user as any).id);

    if (!checkRateLimit(userId)) {
      return NextResponse.json({ success: false, error: "Too Many Requests" }, { status: 429 });
    }

    const lastEntry = await prisma.courierEntry.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { challanNo: true }
    });

    const nextChallanNo = lastEntry ? lastEntry.challanNo + 1 : 1001;

    return NextResponse.json({ success: true, data: { nextChallanNo } });
  } catch (error) {
    console.error("[COURIERS_NEXT_CHALLAN_GET]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
