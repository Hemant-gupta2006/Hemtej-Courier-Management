import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { generateBillingExcel } from "@/lib/excel-billing";
import { recordActivity } from "@/lib/activityLog";
import { calculateGstBillDate, resolveBillingMonthYear } from "@/lib/billing-date";

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
      billingMonth,
      billingYear,
      billNo,
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

    let resolvedPartyId = partyId;
    if (!resolvedPartyId && billingPartyName) {
      const matchedParty = await prisma.billingParty.findFirst({
        where: { officialInvoiceName: { equals: billingPartyName.trim(), mode: "insensitive" } }
      });
      if (matchedParty) {
        resolvedPartyId = matchedParty.id;
      }
    }

    let partySnapshot: any = {};
    if (resolvedPartyId) {
      const party = await prisma.billingParty.findUnique({ where: { id: resolvedPartyId } });
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
    } else {
      partySnapshot = {
        officialInvoiceName: billingPartyName || "",
        addressLine1: partyAddress1 || "",
        addressLine2: partyAddress2 || "",
        city: partyCity || "",
        state: partyState || "",
        pincode: partyPincode || "",
        contactNumber: partyContact || "",
        gstNumber: partyGst || "",
      };
    }

    const businessSnapshot = {
      businessName: businessName || "SEETARAM ENTERPRISE",
      businessAddress: businessAddress || "Shop no.04, Dave Chawl, Near Kamu, Baba, SV Road, Opp. Patker College, Goregaon West, Mumbai 400104",
      businessContact: businessContact || "+91 9892796228",
      businessGst: businessGst || "27AYDPG0955B1ZV"
    };

    // 1. Allocate next Bill Number or use user-provided Bill Number
    let allocatedBill = (billNo || body.billNo)?.toString().trim();
    if (!allocatedBill) {
      allocatedBill = await prisma.$transaction(async (tx) => {
        const settings = await tx.systemSettings.upsert({
          where: { id: 'global' },
          create: { id: 'global', lastBillNo: 101 },
          update: { lastBillNo: { increment: 1 } }
        });
        return settings.lastBillNo.toString();
      });
    } else {
      const numericBill = parseInt(allocatedBill, 10);
      if (!isNaN(numericBill)) {
        const existing = await prisma.systemSettings.findUnique({ where: { id: 'global' } });
        if (!existing) {
          await prisma.systemSettings.create({ data: { id: 'global', lastBillNo: numericBill } });
        } else if (numericBill > existing.lastBillNo) {
          await prisma.systemSettings.update({ where: { id: 'global' }, data: { lastBillNo: numericBill } });
        }
      }
    }

    // 2. Resolve billing month & year and calculate GST bill date
    const { billingMonth: resolvedMonth, billingYear: resolvedYear } = resolveBillingMonthYear({
      billingMonth,
      billingYear,
      startDate,
      endDate
    });
    const calculatedInvoiceDate = calculateGstBillDate(resolvedMonth, resolvedYear);

    const entryIds = entries.map((e: any) => e.id);
    const entriesSnapshot = entries.map((e: any) => ({
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
    }));

    const effectivePartyNames = pNames.length > 0
      ? pNames
      : (billingPartyName ? [billingPartyName.trim()] : []);

    // Save the Invoice with generation parameters and immutable snapshot
    const newInvoice = await prisma.invoice.create({
      data: {
        userId,
        billNo: allocatedBill,
        invoiceDate: calculatedInvoiceDate,
        billingFromDate: startDate ? new Date(startDate) : null,
        billingToDate: endDate ? new Date(endDate) : null,
        billingPartyNames: effectivePartyNames,
        partyId: resolvedPartyId || null,
        partySnapshot,
        businessSnapshot,
        entryIds,
        entriesSnapshot,
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

    const partyNameForExcel = (billingPartyName?.trim() || partySnapshot.officialInvoiceName || "").trim();

    // 4. Generate Excel
    const buffer = await generateBillingExcel({
      entries,
      billNo: allocatedBill,
      invoiceDate: newInvoice.invoiceDate,
      businessSnapshot,
      partySnapshot,
      billingPartyName: partyNameForExcel
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

    // Format fileName as `<party name> <bill no>.xlsx`
    const cleanPartyName = (partyNameForExcel || "Tax_Invoice").replace(/[/\\?%*:|"<>]/g, "").trim();
    const cleanBillNo = allocatedBill.toString().replace(/[/\\?%*:|"<>]/g, "").trim();
    const fileName = cleanBillNo ? `${cleanPartyName} ${cleanBillNo}.xlsx` : `${cleanPartyName}.xlsx`;

    // Convert Buffer to Base64 to return in JSON
    // (Because this is a POST request, returning JSON with base64 is safer for React clients to handle)
    return NextResponse.json({
      success: true,
      data: {
        message: "Bill generated successfully",
        billNo: allocatedBill,
        invoiceId: newInvoice.id,
        fileBase64: buffer.toString('base64'),
        fileName
      }
    });

  } catch (error: any) {
    console.error("[BILLS_POST_ERROR]", error);
    if (error?.code === "P2002") {
      return NextResponse.json({ success: false, error: "A bill with this Bill Number already exists. Please choose another." }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const sessionUser = session.user as any;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ success: false, error: "Bill ID is required" }, { status: 400 });
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id }
    });

    if (!invoice) {
      return NextResponse.json({ success: false, error: "Bill not found" }, { status: 404 });
    }

    if (invoice.userId !== sessionUser.id && sessionUser.role !== "Admin") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });
    }

    await prisma.courierEntry.updateMany({
      where: { invoiceId: id },
      data: { invoiceId: null }
    });

    await prisma.invoice.delete({
      where: { id }
    });

    await recordActivity({
      userId: sessionUser.id,
      userName: sessionUser.name || sessionUser.email || "Staff",
      role: sessionUser.role || "Staff",
      action: "INVOICE_DELETED",
      entity: "Invoice",
      entityId: id,
      newValue: JSON.stringify({ billNo: invoice.billNo, netAmount: invoice.netAmount }),
      req
    });

    return NextResponse.json({
      success: true,
      data: { message: "Bill deleted successfully" }
    });
  } catch (error) {
    console.error("[BILLS_DELETE_ERROR]", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

