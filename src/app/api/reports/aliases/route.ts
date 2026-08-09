import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return new NextResponse("Unauthorized", { status: 401 });

    const { searchParams } = new URL(req.url);
    const billingPartyName = searchParams.get("billingPartyName");

    if (!billingPartyName) {
      return new NextResponse("Missing billingPartyName", { status: 400 });
    }

    const party = await prisma.billingParty.findFirst({
      where: {
        userId: (session.user as any).id,
        officialInvoiceName: { equals: billingPartyName, mode: 'insensitive' },
      }
    });

    if (!party) {
      return NextResponse.json({ success: true, data: { aliases: [] } });
    }

    return NextResponse.json({
      success: true,
      data: { aliases: party.aliases }
    });
  } catch (error) {
    console.error("[ALIASES_GET_ERROR]", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return new NextResponse("Unauthorized", { status: 401 });

    const body = await req.json();
    const { billingPartyName, aliases } = body;

    if (!billingPartyName || !aliases || !Array.isArray(aliases)) {
      return new NextResponse("Invalid request body", { status: 400 });
    }

    const userId = (session.user as any).id;

    // Use a transaction to upsert the group and recreate the aliases
    await prisma.$transaction(async (tx) => {
      let party = await tx.billingParty.findFirst({
        where: {
          userId,
          officialInvoiceName: { equals: billingPartyName, mode: 'insensitive' },
        }
      });
      
      const distinctAliases = Array.from(new Set(aliases)) as string[];
      
      if (party) {
        await tx.billingParty.update({
          where: { id: party.id },
          data: {
            aliases: { set: distinctAliases }
          }
        });
      } else {
        await tx.billingParty.create({
          data: {
            userId,
            officialInvoiceName: billingPartyName,
            aliases: distinctAliases,
          }
        });
      }
    });

    return NextResponse.json({ success: true, data: { saved: true } });
  } catch (error) {
    console.error("[ALIASES_POST_ERROR]", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
