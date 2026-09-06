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

    // Track max srNo per register
    const registerSrNoMap = new Map<string, number>();

    const createdItems = [];
    for (const item of items) {
      if (!item || typeof item !== "object") continue;
      
      const parsedChallan = parseInt(item.challanNo, 10);
      if (isNaN(parsedChallan)) continue;

      const existing = await prisma.courierEntry.findFirst({
        where: { challanNo: parsedChallan, userId }
      });
      if (existing) continue;

      const date = item.date && !isNaN(Date.parse(item.date)) ? new Date(item.date) : new Date();
      
      // Resolve register for item date
      const entryMonth = date.getMonth() + 1;
      const entryYear = date.getFullYear();
      let register = await prisma.courierRegister.findFirst({
        where: { userId, month: entryMonth, year: entryYear }
      });
      
      if (!register) {
        const monthNames = [
          "January", "February", "March", "April", "May", "June",
          "July", "August", "September", "October", "November", "December"
        ];
        const name = `${monthNames[entryMonth - 1]} ${entryYear}`;
        register = await prisma.courierRegister.create({
          data: {
            userId,
            month: entryMonth,
            year: entryYear,
            name,
            status: "Active"
          }
        });
      }
      
      if (register.status === "Locked" || register.status === "Archived") {
        // Skip entry if target register is locked or archived
        continue;
      }

      if (!registerSrNoMap.has(register.id)) {
        const maxSrNoResult = await prisma.courierEntry.aggregate({
          where: { userId, registerId: register.id },
          _max: { srNo: true }
        });
        registerSrNoMap.set(register.id, maxSrNoResult._max.srNo || 0);
      }
      const itemSrNo = (registerSrNoMap.get(register.id) || 0) + 1;
      registerSrNoMap.set(register.id, itemSrNo);
      const amount = Number(item.amount) || 0;

      const created = await prisma.courierEntry.create({
        data: {
          userId,
          srNo: itemSrNo,
          date,
          challanNo: parsedChallan,
          fromParty: String(item.fromParty || "").trim(),
          toParty: String(item.toParty || "").trim(),
          weightValue: (() => {
            const w = String(item.weight || "100gm").toLowerCase().trim();
            return parseFloat(w) || 0;
          })(),
          weightUnit: (() => {
            const w = String(item.weight || "100gm").toLowerCase().trim();
            return w.includes("kg") ? "kg" : "gm";
          })(),
          destination: String(item.destination || "").trim(),
          amount,
          status: String(item.status || "Cash").trim(),
          registerId: register.id,
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
