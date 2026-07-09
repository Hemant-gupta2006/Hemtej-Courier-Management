import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminSession, unauthorizedResponse } from "@/lib/adminAuth";

export async function GET(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await checkAdminSession();
    if (!session) return unauthorizedResponse();

    const name = decodeURIComponent(params.id);

    // Query all entries where this customer is involved
    const courierEntries = await prisma.courierEntry.findMany({
      where: {
        OR: [
          { fromParty: { equals: name, mode: "insensitive" } },
          { toParty: { equals: name, mode: "insensitive" } }
        ]
      },
      orderBy: { date: "desc" },
      include: {
        user: { select: { name: true, email: true } }
      }
    });

    // Calculate detailed aggregates
    const sentCount = courierEntries.filter(
      (c) => c.fromParty.toLowerCase() === name.toLowerCase()
    ).length;

    const receivedCount = courierEntries.filter(
      (c) => c.toParty.toLowerCase() === name.toLowerCase()
    ).length;

    const totalAmount = courierEntries.reduce((sum, c) => sum + (c.amount || 0), 0);

    const destinations = courierEntries.map((c) => c.destination).filter(Boolean);
    const lastDestination = destinations[0] || "N/A";

    const modes = courierEntries.map((c) => c.mode).filter(Boolean);
    const lastMode = modes[0] || "N/A";

    const lastBooking = courierEntries[0]?.date || null;

    const profile = {
      name,
      sentCount,
      receivedCount,
      totalCount: courierEntries.length,
      totalSpent: totalAmount,
      lastDestination,
      lastMode,
      lastBooking
    };

    return NextResponse.json({
      success: true,
      data: {
        profile,
        history: courierEntries
      }
    });
  } catch (error: any) {
    console.error("[ADMIN_CUSTOMER_DETAIL_GET]", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load customer details" },
      { status: 500 }
    );
  }
}
