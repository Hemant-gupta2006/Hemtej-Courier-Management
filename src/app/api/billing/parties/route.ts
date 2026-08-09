import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return new NextResponse("Unauthorized", { status: 401 });

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";

    const where: any = {
      userId: (session.user as any).id,
      isArchived: false,
    };

    if (search) {
      where.OR = [
        { officialInvoiceName: { contains: search, mode: "insensitive" } },
        { aliases: { hasSome: [search] } },
        { gstNumber: { contains: search, mode: "insensitive" } },
      ];
    }

    const parties = await prisma.billingParty.findMany({
      where,
      orderBy: { officialInvoiceName: "asc" },
      take: 50, // Limit results
    });

    return NextResponse.json({ success: true, data: parties });
  } catch (error) {
    console.error("[BILLING_PARTIES_GET]", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return new NextResponse("Unauthorized", { status: 401 });

    const userId = (session.user as any).id;
    const body = await req.json();

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

    if (!officialInvoiceName) {
      return new NextResponse("Official Invoice Name is required", { status: 400 });
    }

    // Check for duplicates
    const existing = await prisma.billingParty.findFirst({
      where: {
        userId,
        officialInvoiceName: { equals: officialInvoiceName, mode: 'insensitive' },
      }
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: "A party with this Official Invoice Name already exists." },
        { status: 400 }
      );
    }

    if (gstNumber) {
      const existingGst = await prisma.billingParty.findFirst({
        where: {
          userId,
          gstNumber: { equals: gstNumber, mode: 'insensitive' }
        }
      });
      if (existingGst) {
        return NextResponse.json(
          { success: false, error: "A party with this GST Number already exists." },
          { status: 400 }
        );
      }
    }

    const newParty = await prisma.billingParty.create({
      data: {
        userId,
        officialInvoiceName,
        aliases: aliases || [officialInvoiceName],
        addressLine1,
        addressLine2,
        city,
        state,
        pincode,
        contactNumber,
        gstNumber,
      }
    });

    return NextResponse.json({ success: true, data: newParty });
  } catch (error) {
    console.error("[BILLING_PARTIES_POST]", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
