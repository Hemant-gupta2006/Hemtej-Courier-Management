import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminSession, unauthorizedResponse } from "@/lib/adminAuth";
import { recordActivity } from "@/lib/activityLog";

export async function GET(req: Request) {
  try {
    const session = await checkAdminSession();
    if (!session) return unauthorizedResponse();

    let settings = await prisma.systemSettings.findUnique({
      where: { id: "global" }
    });

    if (!settings || settings.companyName === "HemTej Co" || !settings.companyGst || settings.companyGst === "") {
      settings = await prisma.systemSettings.upsert({
        where: { id: "global" },
        create: {
          id: "global",
          companyName: "SEETARAM ENTERPRISE",
          companyLogo: "/icon.png",
          companyAddress: "Shop no.04, Dave Chawl, Near Kamu, Baba, SV Road, Opp. Patker College, Goregaon West, Mumbai 400104",
          companyPhone: "+91 9892796228",
          companyEmail: "info@seetaram.com",
          companyGst: "27AYDPG0955B1ZV",
          defaultStatus: "Account"
        },
        update: {
          companyName: "SEETARAM ENTERPRISE",
          companyAddress: "Shop no.04, Dave Chawl, Near Kamu, Baba, SV Road, Opp. Patker College, Goregaon West, Mumbai 400104",
          companyPhone: "+91 9892796228",
          companyEmail: "info@seetaram.com",
          companyGst: "27AYDPG0955B1ZV",
          defaultStatus: "Account"
        }
      });
    }

    return NextResponse.json({ success: true, data: settings });
  } catch (error: any) {
    console.error("[ADMIN_SETTINGS_GET]", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load system settings" },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    const session = await checkAdminSession();
    if (!session) return unauthorizedResponse();

    const body = await req.json().catch(() => ({}));
    const {
      companyName,
      companyLogo,
      companyAddress,
      companyPhone,
      companyEmail,
      companyGst,
      defaultStatus,
      invoiceTerms,
      manifestTerms
    } = body;

    const existingSettings = await prisma.systemSettings.findUnique({
      where: { id: "global" }
    });

    const updateData: any = {};
    if (companyName !== undefined) updateData.companyName = String(companyName);
    if (companyLogo !== undefined) updateData.companyLogo = String(companyLogo);
    if (companyAddress !== undefined) updateData.companyAddress = String(companyAddress);
    if (companyPhone !== undefined) updateData.companyPhone = String(companyPhone);
    if (companyEmail !== undefined) updateData.companyEmail = String(companyEmail);
    if (companyGst !== undefined) updateData.companyGst = String(companyGst);
    if (defaultStatus !== undefined) updateData.defaultStatus = String(defaultStatus);
    if (invoiceTerms !== undefined) updateData.invoiceTerms = String(invoiceTerms);
    if (manifestTerms !== undefined) updateData.manifestTerms = String(manifestTerms);

    const updatedSettings = await prisma.systemSettings.upsert({
      where: { id: "global" },
      create: {
        id: "global",
        companyName: companyName || "SEETARAM ENTERPRISE",
        companyLogo: companyLogo || "/icon.png",
        companyAddress: companyAddress || "Shop no.04, Dave Chawl, Near Kamu, Baba, SV Road, Opp. Patker College, Goregaon West, Mumbai 400104",
        companyPhone: companyPhone || "+91 9892796228",
        companyEmail: companyEmail || "info@seetaram.com",
        companyGst: companyGst || "27AYDPG0955B1ZV",
        defaultStatus: defaultStatus || "Account",
        invoiceTerms: invoiceTerms || "Payment due within 15 days from invoice date. Goods once dispatched will not be returned.",
        manifestTerms: manifestTerms || "Subject to local jurisdiction. Handle package with care."
      },
      update: updateData
    });

    // Write Audit Log
    await recordActivity({
      userId: String((session.user as any).id),
      userName: session.user.name || session.user.email || "Admin",
      role: (session.user as any).role || "Admin",
      action: "SETTINGS_UPDATE",
      entity: "SystemSettings",
      entityId: "global",
      oldValue: existingSettings ? JSON.stringify(existingSettings) : null,
      newValue: JSON.stringify(updatedSettings),
      req
    });

    return NextResponse.json({ success: true, data: updatedSettings });
  } catch (error: any) {
    console.error("[ADMIN_SETTINGS_PUT]", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update system settings" },
      { status: 500 }
    );
  }
}
