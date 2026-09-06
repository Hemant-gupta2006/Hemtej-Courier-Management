import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { generateBillingExcel } from "@/lib/excel-billing";
import { recordActivity } from "@/lib/activityLog";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const userId = (session.user as any).id;

    const resolvedParams = await params;
    const invoiceId = resolvedParams.id;
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId, userId }
    });

    if (!invoice) {
      return NextResponse.json({ success: false, error: "Invoice not found" }, { status: 404 });
    }

    if (!invoice.billNo) {
      return NextResponse.json({ success: false, error: "Cannot regenerate invoice without billNo" }, { status: 400 });
    }

    // Historical Bill Snapshot Resolution:
    // A historical bill must reproduce the exact entries and values used when it was created.
    // We NEVER recalculate across the party's entire historical/current dataset.
    let entries: any[] = [];

    // 1. If entriesSnapshot is preserved, use it directly (frozen historical snapshot)
    if (Array.isArray(invoice.entriesSnapshot) && invoice.entriesSnapshot.length > 0) {
      entries = invoice.entriesSnapshot as any[];
    } 
    // 2. Otherwise, if entryIds are preserved, fetch specifically those entries by ID
    else if (Array.isArray(invoice.entryIds) && invoice.entryIds.length > 0) {
      entries = await prisma.courierEntry.findMany({
        where: { id: { in: invoice.entryIds }, userId },
        orderBy: { date: "asc" },
      });
    } 
    // 3. Fallback for legacy invoices without snapshots or entryIds:
    // Strictly constrain by the invoice's original date range and party names.
    // NEVER allow an unconstrained query that could match all user records.
    else {
      const pNames = invoice.billingPartyNames || [];
      const hasDateFilter = !!(invoice.billingFromDate || invoice.billingToDate);
      const hasPartyFilter = pNames.length > 0;

      if (!hasDateFilter && !hasPartyFilter) {
        // If neither dates nor party names exist, check if entries are explicitly tagged
        // with this invoiceId and match the original count.
        const taggedEntries = await prisma.courierEntry.findMany({
          where: { invoiceId, userId },
          orderBy: { date: "asc" },
        });

        if (taggedEntries.length > 0 && (taggedEntries.length === invoice.entriesCount || invoice.entriesCount === 0)) {
          entries = taggedEntries;
        } else {
          return NextResponse.json({
            success: false,
            error: "Cannot regenerate legacy bill: missing historical snapshot parameters"
          }, { status: 400 });
        }
      } else {
        const where: any = { userId };
        if (hasPartyFilter) {
          where.OR = pNames.map((name: string) => ({
            fromParty: { equals: name, mode: "insensitive" }
          }));
        }
        if (hasDateFilter) {
          where.date = {};
          if (invoice.billingFromDate) where.date.gte = invoice.billingFromDate;
          if (invoice.billingToDate) {
            const end = new Date(invoice.billingToDate);
            end.setHours(23, 59, 59, 999);
            where.date.lte = end;
          }
        }

        entries = await prisma.courierEntry.findMany({
          where,
          orderBy: { date: "asc" },
        });
      }

      // Backfill snapshot on the legacy invoice so future regenerations are protected
      if (entries.length > 0 && (!invoice.entriesSnapshot || invoice.entryIds.length === 0)) {
        await prisma.invoice.update({
          where: { id: invoiceId },
          data: {
            entryIds: entries.map((e: any) => e.id),
            entriesSnapshot: entries.map((e: any) => ({
              id: e.id,
              challanNo: e.challanNo,
              date: e.date,
              fromParty: e.fromParty,
              toParty: e.toParty,
              destination: e.destination,
              amount: e.amount || 0,
              weightValue: e.weightValue || 0,
              weightUnit: e.weightUnit || "gm",
              status: e.status || "Account",
              mode: e.mode || "Surface",
            })),
          }
        });
      }
    }

    if (entries.length === 0) {
      return NextResponse.json({ success: false, error: "No billing entries found for regeneration" }, { status: 404 });
    }

    // Preserve the original invoice header and snapshots
    const partySnapshot = invoice.partySnapshot as any;
    const businessSnapshot = invoice.businessSnapshot as any || {
      businessName: "SEETARAM ENTERPRISE",
      businessAddress: "Shop no.04, Dave Chawl, Near Kamu, Baba, SV Road, Opp. Patker College, Goregaon West, Mumbai 400104",
      businessContact: "+91 9892796228",
      businessGst: "27AYDPG0955B1ZV"
    };

    let billingPartyName = "";
    if (partySnapshot?.officialInvoiceName) {
      billingPartyName = partySnapshot.officialInvoiceName;
    } else if (invoice.billingPartyNames?.length > 0) {
      billingPartyName = invoice.billingPartyNames[0];
    }

    // Generate Excel using the snapshot entries and preserved parameters
    const buffer = await generateBillingExcel({
      entries,
      billNo: invoice.billNo,
      invoiceDate: invoice.invoiceDate,
      businessSnapshot,
      partySnapshot,
      billingPartyName
    });

    const sessionUser = session.user as any;
    await recordActivity({
      userId: sessionUser.id,
      userName: sessionUser.name || sessionUser.email || "Staff",
      role: sessionUser.role || "Staff",
      action: "INVOICE_REGENERATED",
      entity: "Invoice",
      entityId: invoice.id,
      newValue: JSON.stringify({ billNo: invoice.billNo, entriesCount: entries.length, netAmount: invoice.netAmount }),
      req
    });

    // Format fileName as `<party name> <bill no>.xlsx`
    const cleanPartyName = (billingPartyName || "Tax_Invoice").replace(/[/\\?%*:|"<>]/g, "").trim();
    const cleanBillNo = invoice.billNo.toString().replace(/[/\\?%*:|"<>]/g, "").trim();
    const fileName = cleanBillNo ? `${cleanPartyName} ${cleanBillNo}.xlsx` : `${cleanPartyName}.xlsx`;

    return NextResponse.json({
      success: true,
      data: {
        message: "Bill regenerated successfully",
        billNo: invoice.billNo,
        invoiceId: invoice.id,
        fileBase64: buffer.toString('base64'),
        fileName
      }
    });

  } catch (error) {
    console.error("[BILL_REGENERATE_ERROR]", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
