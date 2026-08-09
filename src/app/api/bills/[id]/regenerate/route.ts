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

    // 1. Rebuild query using saved parameters
    const where: any = { userId };
    const pNames = invoice.billingPartyNames || [];
    if (pNames.length > 0) {
      where.OR = pNames.map((name: string) => ({
        fromParty: { equals: name, mode: "insensitive" }
      }));
    }

    if (invoice.billingFromDate || invoice.billingToDate) {
      where.date = {};
      if (invoice.billingFromDate) where.date.gte = invoice.billingFromDate;
      if (invoice.billingToDate) {
        const end = new Date(invoice.billingToDate);
        end.setHours(23, 59, 59, 999);
        where.date.lte = end;
      }
    }

    // 2. Fetch current entries
    const entries = await prisma.courierEntry.findMany({
      where,
      orderBy: { date: "asc" },
    });

    if (entries.length === 0) {
      return NextResponse.json({ success: false, error: "No billing entries found for regeneration" }, { status: 404 });
    }

    // 3. Recalculate amounts
    const rawGrossAmount = entries.reduce((sum: number, entry: any) => sum + (entry.amount || 0), 0);
    const grossAmount = Number(rawGrossAmount.toFixed(2));
    const cgst = Number((grossAmount * 0.09).toFixed(2));
    const sgst = Number((grossAmount * 0.09).toFixed(2));
    const igst = 0;
    const netAmount = Number((grossAmount + cgst + sgst + igst).toFixed(2));

    // 4. Update the Invoice with recalculated amounts
    const updatedInvoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        entriesCount: entries.length,
        grossAmount,
        cgst,
        sgst,
        igst,
        netAmount,
        // (optional: could also explicitly ensure all these entries point to this invoiceId)
      }
    });

    await prisma.courierEntry.updateMany({
      where: { id: { in: entries.map((e: any) => e.id) } },
      data: { invoiceId }
    });

    // 5. Generate Excel
    const partySnapshot = updatedInvoice.partySnapshot as any;
    const businessSnapshot = updatedInvoice.businessSnapshot as any || {
      businessName: "SEETARAM ENTERPRISE",
      businessAddress: "Shop no.04, Dave Chawl, Near Kamu, Baba, SV Road, Opp. Patker College, Goregaon West, Mumbai 400104",
      businessContact: "+91 9892796228",
      businessGst: "27AYDPG0955B1ZV"
    };

    let billingPartyName = "";
    if (pNames.length > 0) {
      billingPartyName = pNames[0];
    } else if (partySnapshot?.officialInvoiceName) {
      billingPartyName = partySnapshot.officialInvoiceName;
    }

    const buffer = await generateBillingExcel({
      entries,
      billNo: updatedInvoice.billNo || "",
      invoiceDate: updatedInvoice.invoiceDate,
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
      entityId: updatedInvoice.id,
      newValue: JSON.stringify({ billNo: updatedInvoice.billNo, entriesCount: entries.length, netAmount }),
      req
    });

    return NextResponse.json({
      success: true,
      data: {
        message: "Bill regenerated successfully",
        billNo: updatedInvoice.billNo || "",
        invoiceId: updatedInvoice.id,
        fileBase64: buffer.toString('base64'),
        fileName: `Invoice_${updatedInvoice.billNo || ""}_${billingPartyName || 'Tax_Invoice'}.xlsx`
      }
    });

  } catch (error) {
    console.error("[BILL_REGENERATE_ERROR]", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
