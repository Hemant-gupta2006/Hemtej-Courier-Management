import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminSession, unauthorizedResponse } from "@/lib/adminAuth";

export async function GET(req: Request) {
  try {
    const session = await checkAdminSession();
    if (!session) return unauthorizedResponse();

    const { searchParams } = new URL(req.url);
    const searchParam = searchParams.get("search") || "";

    // Query unique senders and their aggregations
    const fromPartyGroups = await prisma.courierEntry.groupBy({
      by: ["fromParty"],
      _count: { id: true },
      _max: { date: true }
    });

    // Query unique receivers and their aggregations
    const toPartyGroups = await prisma.courierEntry.groupBy({
      by: ["toParty"],
      _count: { id: true },
      _max: { date: true }
    });

    // Merge groups to build a unified customer dictionary
    const customersMap = new Map<string, {
      name: string;
      shipmentCount: number;
      lastBooking: Date;
      role: string;
    }>();

    // Process fromParty (Senders)
    for (const group of fromPartyGroups) {
      if (!group.fromParty) continue;
      const name = group.fromParty.trim();
      const count = group._count.id;
      const lastDate = group._max.date || new Date(0);

      customersMap.set(name.toLowerCase(), {
        name,
        shipmentCount: count,
        lastBooking: lastDate,
        role: "Sender"
      });
    }

    // Process toParty (Receivers)
    for (const group of toPartyGroups) {
      if (!group.toParty) continue;
      const name = group.toParty.trim();
      const count = group._count.id;
      const lastDate = group._max.date || new Date(0);

      const key = name.toLowerCase();
      const existing = customersMap.get(key);

      if (existing) {
        existing.shipmentCount += count;
        if (lastDate > existing.lastBooking) {
          existing.lastBooking = lastDate;
        }
      } else {
        customersMap.set(key, {
          name,
          shipmentCount: count,
          lastBooking: lastDate,
          role: "Receiver"
        });
      }
    }

    // Convert map to list and filter by search
    let customersList = Array.from(customersMap.values());

    if (searchParam) {
      const q = searchParam.toLowerCase();
      customersList = customersList.filter(c => c.name.toLowerCase().includes(q));
    }

    // Sort by shipment count desc
    customersList.sort((a, b) => b.shipmentCount - a.shipmentCount);

    return NextResponse.json({
      success: true,
      data: customersList
    });
  } catch (error: any) {
    console.error("[ADMIN_CUSTOMERS_GET]", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load customers" },
      { status: 500 }
    );
  }
}
