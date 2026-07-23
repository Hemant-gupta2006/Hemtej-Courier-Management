import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export const proxy = withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const pathname = req.nextUrl.pathname;

    // Block disabled accounts
    if (token?.disabled) {
      return NextResponse.redirect(new URL("/login?error=ACCOUNT_DISABLED", req.url));
    }

    // Role check for /admin routes (except /admin/login which redirects to /login)
    if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
      if (token?.role !== "Admin") {
        return NextResponse.redirect(new URL("/admin/unauthorized", req.url));
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const pathname = req.nextUrl.pathname;

        // Allow public routes
        if (
          pathname === "/" ||
          pathname === "/login" ||
          pathname === "/register" ||
          pathname === "/admin/login" ||
          pathname.startsWith("/api/auth") ||
          pathname.startsWith("/icon.png") ||
          pathname.startsWith("/_next")
        ) {
          return true;
        }

        // Require token for protected routes (/dashboard, /admin, private /api)
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/api/:path*",
  ],
};
