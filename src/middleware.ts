import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// These routes are public — email sending uses API key auth, not admin session
const PUBLIC_PATHS = ["/api/emails", "/api/webhooks", "/api/health"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  if (isPublic) return NextResponse.next();

  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET!,
    cookieName: "__Secure-next-auth.session-token",
    secureCookie: true,
  });

  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return new NextResponse(
      `<!DOCTYPE html><html><body style="font-family:system-ui;padding:40px;max-width:500px;margin:0 auto">
        <h1 style="color:#ef4444">Access Denied</h1>
        <p>You must be logged into <a href="https://admin.debugdad.com" style="color:#3b82f6">admin.debugdad.com</a> first.</p>
        <p style="margin-top:24px"><a href="https://admin.debugdad.com" style="background:#3b82f6;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block">Log in to Admin →</a></p>
      </body></html>`,
      { status: 401, headers: { "Content-Type": "text/html" } }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
