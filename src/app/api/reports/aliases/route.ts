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

    const group = await prisma.billingAliasGroup.findUnique({
      where: {
        userId_billingPartyName: {
          userId: (session.user as any).id,
          billingPartyName,
        }
      },
      include: {
        aliases: true,
      }
    });

    if (!group) {
      return NextResponse.json({ success: true, data: { aliases: [] } });
    }

    return NextResponse.json({
      success: true,
      data: { aliases: group.aliases.map(a => a.aliasName) }
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

    // We use a transaction to upsert the group and recreate the aliases
    await prisma.$transaction(async (tx) => {
      const group = await tx.billingAliasGroup.upsert({
        where: {
          userId_billingPartyName: {
            userId,
            billingPartyName,
          }
        },
        update: {},
        create: {
          userId,
          billingPartyName,
        }
      });

      // Delete existing aliases for this group
      await tx.billingAlias.deleteMany({
        where: { groupId: group.id }
      });

      // Insert new aliases
      if (aliases.length > 0) {
        await tx.billingAlias.createMany({
          data: aliases.map((aliasName: string) => ({
            groupId: group.id,
            aliasName,
          }))
        });
      }
    });

    return NextResponse.json({ success: true, data: { saved: true } });
  } catch (error) {
    console.error("[ALIASES_POST_ERROR]", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
