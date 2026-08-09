import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session) return new NextResponse("Unauthorized", { status: 401 });

    const party = await prisma.billingParty.findUnique({
      where: {
        id: id,
        userId: (session.user as any).id,
      }
    });

    if (!party) {
      return new NextResponse("Not Found", { status: 404 });
    }

    return NextResponse.json({ success: true, data: party });
  } catch (error) {
    console.error("[BILLING_PARTY_GET]", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session) return new NextResponse("Unauthorized", { status: 401 });

    const body = await req.json();
    const userId = (session.user as any).id;

    // Verify ownership
    const existing = await prisma.billingParty.findUnique({
      where: { id: id }
    });

    if (!existing || existing.userId !== userId) {
      return new NextResponse("Not Found or Unauthorized", { status: 404 });
    }

    const {
      officialInvoiceName,
      aliases,
      addressLine1,
      addressLine2,
      city,
      state,
      pincode,
      contactNumber,
      gstNumber,
    } = body;

    const updated = await prisma.billingParty.update({
      where: { id: id },
      data: {
        officialInvoiceName,
        aliases,
        addressLine1,
        addressLine2,
        city,
        state,
        pincode,
        contactNumber,
        gstNumber,
      }
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("[BILLING_PARTY_PUT]", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session) return new NextResponse("Unauthorized", { status: 401 });

    const userId = (session.user as any).id;

    // Verify ownership
    const existing = await prisma.billingParty.findUnique({
      where: { id: id }
    });

    if (!existing || existing.userId !== userId) {
      return new NextResponse("Not Found or Unauthorized", { status: 404 });
    }

    // Check if there are associated invoices. Soft delete if there are.
    const invoicesCount = await prisma.invoice.count({
      where: { partyId: id }
    });

    if (invoicesCount > 0) {
      await prisma.billingParty.update({
        where: { id: id },
        data: { isArchived: true }
      });
      return NextResponse.json({ success: true, message: "Party archived since it is associated with existing invoices." });
    } else {
      await prisma.billingParty.delete({
        where: { id: id }
      });
      return NextResponse.json({ success: true, message: "Party deleted." });
    }
  } catch (error) {
    console.error("[BILLING_PARTY_DELETE]", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
