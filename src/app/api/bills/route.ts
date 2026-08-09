import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { generateBillingExcel } from "@/lib/excel-billing";
import { recordActivity } from "@/lib/activityLog";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return new NextResponse("Unauthorized", { status: 401 });

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");
    const search = searchParams.get("search") || "";

    const where: any = {
      userId: (session.user as any).id,
    };

    if (search) {
      where.OR = [
        { billNo: { contains: search, mode: "insensitive" } },
        { 
          party: {
            officialInvoiceName: { contains: search, mode: "insensitive" }
          }
        }
      ];
    }

    const total = await prisma.invoice.count({ where });
    const bills = await prisma.invoice.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        party: { select: { officialInvoiceName: true } }
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        bills,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      }
    });
  } catch (error) {
    console.error("[BILLS_GET_ERROR]", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return new NextResponse("Unauthorized", { status: 401 });
    const userId = (session.user as any).id;

    const body = await req.json();
    const { 
      partyId, 
      partyNames, 
      startDate, 
      endDate, 
      invoiceDate, 
      partyAddress1, 
      partyAddress2, 
      partyCity, 
      partyState, 
      partyPincode, 
      partyContact, 
      partyGst,
      businessName,
      businessAddress,
      businessContact,
      businessGst,
      billingPartyName
    } = body;

    const where: any = { userId };
    const pNames = partyNames || [];
    if (pNames.length > 0) {
      where.OR = pNames.map((name: string) => ({
        fromParty: { equals: name, mode: "insensitive" }
      }));
    }

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.date.lte = end;
      }
    }

    const entries = await prisma.courierEntry.findMany({
      where,
      orderBy: { date: "asc" },
    });

    if (entries.length === 0) {
      return NextResponse.json({ success: false, error: "No billing entries found" }, { status: 404 });
    }

    const rawGrossAmount = entries.reduce((sum: number, entry: any) => sum + (entry.amount || 0), 0);
    const grossAmount = Number(rawGrossAmount.toFixed(2));
    const cgst = Number((grossAmount * 0.09).toFixed(2));
    const sgst = Number((grossAmount * 0.09).toFixed(2));
    const igst = 0;
    const netAmount = Number((grossAmount + cgst + sgst + igst).toFixed(2));

    let partySnapshot: any = {};
    if (partyId) {
      const party = await prisma.billingParty.findUnique({ where: { id: partyId } });
      if (party) {
        partySnapshot = {
          officialInvoiceName: party.officialInvoiceName,
          addressLine1: partyAddress1 || party.addressLine1,
          addressLine2: partyAddress2 || party.addressLine2,
          city: partyCity || party.city,
          state: partyState || party.state,
          pincode: partyPincode || party.pincode,
          contactNumber: partyContact || party.contactNumber,
          gstNumber: partyGst || party.gstNumber,
        };
      }
    }

    const businessSnapshot = {
      businessName: businessName || "SEETARAM ENTERPRISE",
      businessAddress: businessAddress || "Shop no.04, Dave Chawl, Near Kamu, Baba, SV Road, Opp. Patker College, Goregaon West, Mumbai 400104",
      businessContact: businessContact || "+91 9892796228",
      businessGst: businessGst || "27AYDPG0955B1ZV"
    };

    // 1. Allocate next Bill Number inside a transaction
    const allocatedBill = await prisma.$transaction(async (tx) => {
      const settings = await tx.systemSettings.update({
        where: { id: 'global' },
        data: { lastBillNo: { increment: 1 } }
      });
      return settings.lastBillNo.toString();
    });

    // 2. Save the Invoice with generation parameters
    const newInvoice = await prisma.invoice.create({
      data: {
        userId,
        billNo: allocatedBill,
        invoiceDate: invoiceDate ? new Date(invoiceDate) : new Date(),
        billingFromDate: startDate ? new Date(startDate) : null,
        billingToDate: endDate ? new Date(endDate) : null,
        billingPartyNames: pNames,
        partyId: partyId || null,
        partySnapshot,
        businessSnapshot,
        entriesCount: entries.length,
        grossAmount,
        cgst,
        sgst,
        igst,
        netAmount,
        status: "ACTIVE"
      }
    });

    // 3. Update CourierEntries (optional, but preserves old logic)
    await prisma.courierEntry.updateMany({
      where: { id: { in: entries.map((e: any) => e.id) } },
      data: { invoiceId: newInvoice.id }
    });

    // 4. Generate Excel
    const buffer = await generateBillingExcel({
      entries,
      billNo: allocatedBill,
      invoiceDate: newInvoice.invoiceDate,
      businessSnapshot,
      partySnapshot,
      billingPartyName: billingPartyName || partySnapshot.officialInvoiceName || ""
    });

    const sessionUser = session.user as any;
    await recordActivity({
      userId: sessionUser.id,
      userName: sessionUser.name || sessionUser.email || "Staff",
      role: sessionUser.role || "Staff",
      action: "INVOICE_CREATED",
      entity: "Invoice",
      entityId: newInvoice.id,
      newValue: JSON.stringify({ billNo: allocatedBill, entriesCount: entries.length, netAmount }),
      req
    });

    // Convert Buffer to Base64 to return in JSON
    // (Because this is a POST request, returning JSON with base64 is safer for React clients to handle)
    return NextResponse.json({
      success: true,
      data: {
        message: "Bill generated successfully",
        billNo: allocatedBill,
        invoiceId: newInvoice.id,
        fileBase64: buffer.toString('base64'),
        fileName: `Invoice_${allocatedBill}_${billingPartyName || 'Tax_Invoice'}.xlsx`
      }
    });

  } catch (error) {
    console.error("[BILLS_POST_ERROR]", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
