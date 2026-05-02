import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function isApiPath(pathname: string) {
  return pathname.startsWith("/api/");
}

export function middleware(request: NextRequest) {
  const hasAccess = request.cookies.get("gmbm_access")?.value === "granted";
  const pathname = request.nextUrl.pathname;

  if (!hasAccess) {
    if (isApiPath(pathname)) {
      return NextResponse.json(
        {
          error: "Access locked. Complete checkout and unlock your account to use this endpoint."
        },
        { status: 401 }
      );
    }

    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/unlock";
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/api/competitors/:path*", "/api/scrape/:path*"]
};
