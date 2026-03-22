import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";

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

    const body = await req.json().catch(() => ({}));
    const { items } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, error: "Invalid data: items must be a non-empty array" }, { status: 400 });
    }

    let maxSrNoResult = await prisma.courierEntry.aggregate({
      where: { userId },
      _max: { srNo: true }
    });
    
    let currentSrNo = (maxSrNoResult._max.srNo || 0);

    const createdItems = [];
    for (const item of items) {
      if (!item || typeof item !== "object") continue;
      
      const parsedChallan = parseInt(item.challanNo, 10);
      if (isNaN(parsedChallan)) continue;

      const existing = await prisma.courierEntry.findFirst({
        where: { challanNo: parsedChallan, userId }
      });
      if (existing) continue;

      currentSrNo++;
      
      const date = item.date && !isNaN(Date.parse(item.date)) ? new Date(item.date) : new Date();
      const amount = Number(item.amount) || 0;

      const created = await prisma.courierEntry.create({
        data: {
          userId,
          srNo: currentSrNo,
          date,
          challanNo: parsedChallan,
          fromParty: String(item.fromParty || "").trim(),
          toParty: String(item.toParty || "").trim(),
          weight: String(item.weight || "100g").trim(),
          destination: String(item.destination || "").trim(),
          amount,
          status: String(item.status || "Cash").trim(),
        }
      });
      createdItems.push(created);
    }

    return NextResponse.json({ success: true, data: createdItems });
  } catch (error) {
    console.error("[COURIERS_BULK_POST]", userId, error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
