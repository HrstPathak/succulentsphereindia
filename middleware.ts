import { NextRequest, NextResponse } from "next/server";

const AUTH_COOKIE_NAME = "ss_firebase_session";

export function middleware(request: NextRequest) {
  if (!request.cookies.get(AUTH_COOKIE_NAME)?.value) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/account/:path*"] };
