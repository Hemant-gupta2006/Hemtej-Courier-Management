import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !(session.user as any).id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const party = await prisma.billingParty.findFirst({
      where: {
        id,
        userId,
      },
      include: {
        _count: {
          select: { invoices: true },
        },
      },
    });

    if (!party) {
      return NextResponse.json({ success: false, error: "Party not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: party });
  } catch (error) {
    console.error("[BILLING_PARTY_GET]", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !(session.user as any).id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const body = await req.json();

    // Verify ownership
    const existing = await prisma.billingParty.findUnique({
      where: { id },
    });

    if (!existing || existing.userId !== userId) {
      return NextResponse.json({ success: false, error: "Party not found or unauthorized" }, { status: 404 });
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
      isArchived,
    } = body;

    const trimmedName = (officialInvoiceName || "").trim();
    if (!trimmedName) {
      return NextResponse.json({ success: false, error: "Official Invoice Name is required" }, { status: 400 });
    }

    // Check if another party already has this officialInvoiceName
    const duplicateName = await prisma.billingParty.findFirst({
      where: {
        userId,
        id: { not: id },
        officialInvoiceName: { equals: trimmedName, mode: "insensitive" },
      },
    });

    if (duplicateName) {
      return NextResponse.json(
        { success: false, error: "Another party with this Official Invoice Name already exists." },
        { status: 400 }
      );
    }

    // Check if another party already has this GST Number
    const trimmedGst = (gstNumber || "").trim().toUpperCase();
    if (trimmedGst) {
      const duplicateGst = await prisma.billingParty.findFirst({
        where: {
          userId,
          id: { not: id },
          gstNumber: { equals: trimmedGst, mode: "insensitive" },
        },
      });

      if (duplicateGst) {
        return NextResponse.json(
          { success: false, error: "Another party with this GST Number already exists." },
          { status: 400 }
        );
      }
    }

    // Clean aliases
    let cleanAliases: string[] = [];
    if (Array.isArray(aliases)) {
      cleanAliases = Array.from(new Set(aliases.map((a: string) => a.trim()).filter(Boolean)));
    } else if (typeof aliases === "string" && aliases.trim()) {
      cleanAliases = Array.from(new Set(aliases.split(",").map((a: string) => a.trim()).filter(Boolean)));
    }
    if (cleanAliases.length === 0) {
      cleanAliases = [trimmedName];
    }

    const updated = await prisma.billingParty.update({
      where: { id },
      data: {
        officialInvoiceName: trimmedName,
        aliases: cleanAliases,
        addressLine1: addressLine1 !== undefined ? addressLine1?.trim() || null : existing.addressLine1,
        addressLine2: addressLine2 !== undefined ? addressLine2?.trim() || null : existing.addressLine2,
        city: city !== undefined ? city?.trim() || null : existing.city,
        state: state !== undefined ? state?.trim() || null : existing.state,
        pincode: pincode !== undefined ? pincode?.trim() || null : existing.pincode,
        contactNumber: contactNumber !== undefined ? contactNumber?.trim() || null : existing.contactNumber,
        gstNumber: trimmedGst || null,
        isArchived: typeof isArchived === "boolean" ? isArchived : existing.isArchived,
      },
      include: {
        _count: {
          select: { invoices: true },
        },
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("[BILLING_PARTY_PUT]", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !(session.user as any).id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as any).id;

    // Verify ownership
    const existing = await prisma.billingParty.findUnique({
      where: { id },
    });

    if (!existing || existing.userId !== userId) {
      return NextResponse.json({ success: false, error: "Party not found or unauthorized" }, { status: 404 });
    }

    // Check if there are associated invoices. Safely archive if there are.
    const invoicesCount = await prisma.invoice.count({
      where: { partyId: id },
    });

    if (invoicesCount > 0) {
      const archived = await prisma.billingParty.update({
        where: { id },
        data: { isArchived: true },
      });
      return NextResponse.json({
        success: true,
        data: {
          archived: true,
          party: archived,
          message: `Party archived safely because it is referenced by ${invoicesCount} invoice(s).`,
        },
      });
    } else {
      await prisma.billingParty.delete({
        where: { id },
      });
      return NextResponse.json({
        success: true,
        data: {
          archived: false,
          message: "Party deleted successfully.",
        },
      });
    }
  } catch (error) {
    console.error("[BILLING_PARTY_DELETE]", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
