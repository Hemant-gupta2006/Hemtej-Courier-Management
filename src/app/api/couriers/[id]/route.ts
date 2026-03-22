import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const resolvedParams = await params;
    if (!resolvedParams?.id || typeof resolvedParams.id !== "string" || resolvedParams.id.startsWith("new-")) {
      return NextResponse.json({ success: false, error: "Invalid ID" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    if (!body || Object.keys(body).length === 0) {
      return NextResponse.json({ success: false, error: "Empty payload" }, { status: 400 });
    }

    const dbEntry = await prisma.courierEntry.findUnique({
      where: { id: resolvedParams.id }
    });
    if (!dbEntry) {
      return NextResponse.json({ success: false, error: "Not Found" }, { status: 404 });
    }
    if (dbEntry.userId !== userId) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    if (body.challanNo !== undefined) {
      const parsedChallan = parseInt(body.challanNo, 10);
      if (!isNaN(parsedChallan)) {
        const existing = await prisma.courierEntry.findFirst({
          where: { challanNo: parsedChallan, userId }
        });
        if (existing && existing.id !== resolvedParams.id) {
          return NextResponse.json({ success: false, error: "Challan Number already exists" }, { status: 400 });
        }
      }
    }

    const data: any = {};
    if (body.date !== undefined) data.date = isNaN(Date.parse(body.date)) ? new Date() : new Date(body.date);
    if (body.fromParty !== undefined) data.fromParty = String(body.fromParty).trim();
    if (body.toParty !== undefined) data.toParty = String(body.toParty).trim();
    if (body.weight !== undefined) data.weight = String(body.weight).trim();
    if (body.destination !== undefined) data.destination = String(body.destination).trim();
    if (body.amount !== undefined) data.amount = Number(body.amount) || 0;
    if (body.status !== undefined) data.status = String(body.status).trim();
    if (body.mode !== undefined) data.mode = String(body.mode).trim();
    if (body.challanNo !== undefined) {
       const parsedChallan = parseInt(body.challanNo, 10);
       if (!isNaN(parsedChallan)) data.challanNo = parsedChallan;
    }

    const courier = await prisma.courierEntry.update({
      where: { id: resolvedParams.id },
      data
    });

    return NextResponse.json({ success: true, data: courier });
  } catch (error) {
    console.error("[COURIERS_PATCH]", userId, error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const resolvedParams = await params;
    if (!resolvedParams?.id || typeof resolvedParams.id !== "string") {
      return NextResponse.json({ success: false, error: "Invalid ID" }, { status: 400 });
    }

    const dbEntry = await prisma.courierEntry.findUnique({
      where: { id: resolvedParams.id }
    });
    if (!dbEntry) {
      return NextResponse.json({ success: false, error: "Not Found" }, { status: 404 });
    }
    if (dbEntry.userId !== userId) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const courier = await prisma.courierEntry.delete({
      where: { id: resolvedParams.id }
    });

    return NextResponse.json({ success: true, data: courier });
  } catch (error) {
    console.error("[COURIERS_DELETE]", userId, error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
