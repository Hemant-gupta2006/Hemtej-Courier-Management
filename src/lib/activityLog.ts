import "server-only";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

export async function recordActivity({
  userId,
  userName,
  role,
  action,
  entity,
  entityId,
  oldValue = null,
  newValue = null,
  req
}: {
  userId: string;
  userName: string;
  role: string;
  action: string;
  entity: string;
  entityId: string;
  oldValue?: string | null;
  newValue?: string | null;
  req?: Request;
}) {
  try {
    let ipAddress = "127.0.0.1";
    let browser = "Chrome";

    if (req) {
      ipAddress = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || ipAddress;
      const ua = req.headers.get("user-agent") || "";
      if (ua.includes("Firefox")) browser = "Firefox";
      else if (ua.includes("Chrome")) browser = "Chrome";
      else if (ua.includes("Safari") && !ua.includes("Chrome")) browser = "Safari";
      else if (ua.includes("Edge")) browser = "Edge";
      else if (ua) browser = "Other";
    } else {
      try {
        const headersList = await headers();
        ipAddress = headersList.get("x-forwarded-for") || headersList.get("x-real-ip") || ipAddress;
        const ua = headersList.get("user-agent") || "";
        if (ua.includes("Firefox")) browser = "Firefox";
        else if (ua.includes("Chrome")) browser = "Chrome";
        else if (ua.includes("Safari") && !ua.includes("Chrome")) browser = "Safari";
        else if (ua.includes("Edge")) browser = "Edge";
        else if (ua) browser = "Other";
      } catch (e) {
        // headers() might not be available
      }
    }

    const metadata = { ip: ipAddress, browser, role };
    const metaStr = JSON.stringify(metadata);

    const finalOldValue = oldValue ? JSON.stringify({ ...metadata, raw: oldValue }) : metaStr;
    const finalNewValue = newValue ? JSON.stringify({ ...metadata, raw: newValue }) : metaStr;

    await prisma.auditLog.create({
      data: {
        adminId: userId,
        adminName: userName || "System User",
        action,
        entity,
        entityId,
        oldValue: finalOldValue,
        newValue: finalNewValue
      }
    });
  } catch (err) {
    console.error("[RECORD_ACTIVITY_ERROR]", err);
  }
}
