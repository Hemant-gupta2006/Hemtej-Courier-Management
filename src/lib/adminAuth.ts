import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function checkAdminSession() {
  const session = await getServerSession(authOptions);
  if (!session || !session.user || (session.user as any).role !== "Admin") {
    return null;
  }
  return session;
}

export function unauthorizedResponse() {
  return NextResponse.json(
    { success: false, error: "Unauthorized access. Admins only." },
    { status: 401 }
  );
}
