import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { recordActivity } from "@/lib/activityLog";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const sessionUser = session.user as any;
    const { id } = await params;

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        party: { select: { officialInvoiceName: true } },
        courierEntries: true
      }
    });

    if (!invoice) {
      return NextResponse.json({ success: false, error: "Bill not found" }, { status: 404 });
    }

    if (invoice.userId !== sessionUser.id && sessionUser.role !== "Admin") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });
    }

    return NextResponse.json({ success: true, data: invoice });
  } catch (error) {
    console.error("[BILL_GET_ERROR]", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const sessionUser = session.user as any;
    const { id } = await params;

    const invoice = await prisma.invoice.findUnique({
      where: { id }
    });

    if (!invoice) {
      return NextResponse.json({ success: false, error: "Bill not found" }, { status: 404 });
    }

    if (invoice.userId !== sessionUser.id && sessionUser.role !== "Admin") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });
    }

    // Unlink any associated courier entries
    await prisma.courierEntry.updateMany({
      where: { invoiceId: id },
      data: { invoiceId: null }
    });

    // Delete invoice
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
    console.error("[BILL_DELETE_ERROR]", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
