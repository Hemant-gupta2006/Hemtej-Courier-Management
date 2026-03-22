import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET() {
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

    const couriers = await prisma.courierEntry.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: couriers });
  } catch (error) {
    console.error("[COURIERS_GET]", userId, error);
    return NextResponse.json({ success: false, data: [], error: "Internal server error" }, { status: 500 });
  }
}

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
    if (!body || Object.keys(body).length === 0) {
      return NextResponse.json({ success: false, error: "Empty payload" }, { status: 400 });
    }

    const date = body.date && !isNaN(Date.parse(body.date)) ? new Date(body.date) : new Date();
    const fromParty = String(body.fromParty || "").trim();
    const toParty = String(body.toParty || "").trim();
    const weight = String(body.weight || "100g").trim();
    const destination = String(body.destination || "").trim();
    const amount = Number(body.amount) || 0;
    const status = String(body.status || "Cash").trim();
    const mode = String(body.mode || "Surface").trim();

    if (!fromParty || !toParty || !destination) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    const MAX_RETRIES = 5;
    let attempts = 0;
    let courier;

    while (attempts < MAX_RETRIES) {
      try {
        courier = await prisma.$transaction(async (tx) => {
          const lastEntry = await tx.courierEntry.findFirst({
            where: { userId },
            orderBy: { createdAt: "desc" },
            select: { challanNo: true }
          });
          let nextChallanNo;
          if (body.challanNo) {
            nextChallanNo = Number(body.challanNo);
          } else {
            nextChallanNo = lastEntry ? lastEntry.challanNo + 1 : 1001;
          }

          const maxSrNoResult = await tx.courierEntry.aggregate({
            where: { userId },
            _max: { srNo: true }
          });
          const newSrNo = (maxSrNoResult._max.srNo || 0) + 1;

          return await tx.courierEntry.create({
            data: {
              srNo: newSrNo,
              userId,
              date,
              challanNo: nextChallanNo,
              fromParty,
              toParty,
              weight,
              destination,
              amount,
              status,
              mode,
            }
          });
        });
        break;
      } catch (error: any) {
        if (error.code === 'P2002') {
          if (body.challanNo) {
             throw new Error("DUPLICATE_CHALLAN_USER_PROVIDED");
          }
          attempts++;
          if (attempts === MAX_RETRIES) throw error;
          await new Promise(res => setTimeout(res, 50));
          continue;
        }
        throw error;
      }
    }

    return NextResponse.json({ success: true, data: courier });
  } catch (error: any) {
    if (error.message === "DUPLICATE_CHALLAN_USER_PROVIDED") {
      return NextResponse.json({ success: false, error: "This challan number already exists." }, { status: 400 });
    }
    console.error("[COURIERS_POST]", userId, error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
