import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !(session.user as any).id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() || "";
    const all = searchParams.get("all") === "true";
    const includeArchived = searchParams.get("includeArchived") === "true";
    const hasPage = searchParams.has("page");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const pageSize = Math.max(1, Math.min(100, parseInt(searchParams.get("pageSize") || "10", 10) || 10));

    const where: any = {
      userId,
    };

    if (!includeArchived) {
      where.isArchived = false;
    }

    if (search) {
      where.OR = [
        { officialInvoiceName: { contains: search, mode: "insensitive" } },
        { aliases: { hasSome: [search] } },
        { gstNumber: { contains: search, mode: "insensitive" } },
        { contactNumber: { contains: search, mode: "insensitive" } },
        { city: { contains: search, mode: "insensitive" } },
      ];
    }

    // Unpaginated request (e.g. from dropdowns, autocompletion or all=true)
    if (!hasPage || all) {
      const parties = await prisma.billingParty.findMany({
        where,
        orderBy: { officialInvoiceName: "asc" },
        include: {
          _count: {
            select: { invoices: true },
          },
        },
      });

      return NextResponse.json({
        success: true,
        data: parties,
      });
    }

    // Paginated request (e.g. from /dashboard/parties)
    const total = await prisma.billingParty.count({ where });

    const parties = await prisma.billingParty.findMany({
      where,
      orderBy: { officialInvoiceName: "asc" },
      include: {
        _count: {
          select: { invoices: true },
        },
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return NextResponse.json({
      success: true,
      data: {
        parties,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize) || 1,
        },
      },
    });
  } catch (error) {
    console.error("[BILLING_PARTIES_GET]", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !(session.user as any).id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

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

    const trimmedName = (officialInvoiceName || "").trim();
    if (!trimmedName) {
      return NextResponse.json({ success: false, error: "Official Invoice Name is required" }, { status: 400 });
    }

    // Check for duplicate official invoice name for this user
    const existing = await prisma.billingParty.findFirst({
      where: {
        userId,
        officialInvoiceName: { equals: trimmedName, mode: "insensitive" },
      },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: "A party with this Official Invoice Name already exists." },
        { status: 400 }
      );
    }

    // Check for duplicate GST number if provided
    const trimmedGst = (gstNumber || "").trim().toUpperCase();
    if (trimmedGst) {
      const existingGst = await prisma.billingParty.findFirst({
        where: {
          userId,
          gstNumber: { equals: trimmedGst, mode: "insensitive" },
        },
      });
      if (existingGst) {
        return NextResponse.json(
          { success: false, error: "A party with this GST Number already exists." },
          { status: 400 }
        );
      }
    }

    // Prepare aliases
    let cleanAliases: string[] = [];
    if (Array.isArray(aliases)) {
      cleanAliases = Array.from(new Set(aliases.map((a: string) => a.trim()).filter(Boolean)));
    } else if (typeof aliases === "string" && aliases.trim()) {
      cleanAliases = Array.from(new Set(aliases.split(",").map((a: string) => a.trim()).filter(Boolean)));
    }
    if (cleanAliases.length === 0) {
      cleanAliases = [trimmedName];
    }

    const newParty = await prisma.billingParty.create({
      data: {
        userId,
        officialInvoiceName: trimmedName,
        aliases: cleanAliases,
        addressLine1: addressLine1?.trim() || null,
        addressLine2: addressLine2?.trim() || null,
        city: city?.trim() || null,
        state: state?.trim() || null,
        pincode: pincode?.trim() || null,
        contactNumber: contactNumber?.trim() || null,
        gstNumber: trimmedGst || null,
      },
      include: {
        _count: {
          select: { invoices: true },
        },
      },
    });

    return NextResponse.json({ success: true, data: newParty });
  } catch (error) {
    console.error("[BILLING_PARTIES_POST]", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
