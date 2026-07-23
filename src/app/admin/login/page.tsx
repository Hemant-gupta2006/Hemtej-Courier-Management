import { redirect } from "next/navigation";

export default function AdminLoginPage() {
  // Preserve backward compatibility for old links/bookmarks by redirecting to unified /login
  redirect("/login");
}
