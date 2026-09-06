import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !(session.user as any).id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const body = await req.json();
    const { field, value, partyId } = body;

    const trimmedVal = (value || "").trim();
    if (!trimmedVal && !partyId) {
      return NextResponse.json({ success: false, error: "Suggestion value or partyId is required" }, { status: 400 });
    }

    // Case 1: Billing Master Deletion
    if (field === "billingMaster" || partyId) {
      const party = await prisma.billingParty.findFirst({
        where: {
          id: partyId || undefined,
          officialInvoiceName: !partyId ? trimmedVal : undefined,
          userId,
        },
        include: {
          _count: { select: { invoices: true } },
        },
      });

      if (!party) {
        return NextResponse.json({ success: false, error: "Billing party not found" }, { status: 404 });
      }

      const invoiceCount = party._count.invoices;

      if (invoiceCount > 0) {
        // Safe Archival to preserve historical invoices
        await prisma.billingParty.update({
          where: { id: party.id },
          data: { isArchived: true },
        });

        await prisma.auditLog.create({
          data: {
            adminId: userId,
            adminName: session.user.name || "User",
            action: "ARCHIVE_PARTY_SUGGESTION",
            entity: "BillingParty",
            entityId: party.id,
            oldValue: party.officialInvoiceName,
            newValue: "Archived",
          },
        });

        return NextResponse.json({
          success: true,
          data: {
            message: `Party "${party.officialInvoiceName}" is linked to ${invoiceCount} invoice(s). It has been safely archived and removed from active suggestions.`,
            archived: true,
          },
        });
      } else {
        // Complete Deletion
        await prisma.billingParty.delete({
          where: { id: party.id },
        });

        await prisma.auditLog.create({
          data: {
            adminId: userId,
            adminName: session.user.name || "User",
            action: "DELETE_PARTY_SUGGESTION",
            entity: "BillingParty",
            entityId: party.id,
            oldValue: party.officialInvoiceName,
            newValue: "Deleted",
          },
        });

        return NextResponse.json({
          success: true,
          data: {
            message: `Billing party "${party.officialInvoiceName}" was permanently deleted.`,
            deleted: true,
          },
        });
      }
    }

    // Case 2: Register/Convention Suggestion Deletion (fromParty, toParty, destination, etc.)
    // We permanently exclude this suggestion from appearing anywhere in autocomplete
    // WITHOUT deleting historical courier/register booking entries.
    const lowerVal = trimmedVal.toLowerCase();

    // Check if an exclusion already exists
    const existingExclusion = await prisma.auditLog.findFirst({
      where: {
        action: "EXCLUDED_SUGGESTION",
        oldValue: userId,
        entity: field || "any",
        entityId: lowerVal,
      },
    });

    if (!existingExclusion) {
      await prisma.auditLog.create({
        data: {
          adminId: userId,
          adminName: session.user.name || "User",
          action: "EXCLUDED_SUGGESTION",
          entity: field || "any",
          entityId: lowerVal,
          oldValue: userId,
          newValue: trimmedVal,
        },
      });
    }

    // If this value is also registered as an alias in any BillingParty, unbind it
    const partiesWithAlias = await prisma.billingParty.findMany({
      where: {
        userId,
        aliases: { hasSome: [trimmedVal] },
      },
    });

    for (const p of partiesWithAlias) {
      const updatedAliases = p.aliases.filter(
        (a) => a.toLowerCase().trim() !== lowerVal
      );
      await prisma.billingParty.update({
        where: { id: p.id },
        data: { aliases: updatedAliases },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        message: `Suggestion "${trimmedVal}" has been permanently removed from autocomplete suggestions. Historical courier entries remain intact.`,
        value: trimmedVal,
        field,
      },
    });
  } catch (error) {
    console.error("[AUTOCOMPLETE_SUGGESTION_DELETE]", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
