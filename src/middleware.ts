import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// These routes are public — email sending uses API key auth, not admin session
const PUBLIC_PATHS = ["/api/emails", "/api/webhooks", "/api/health"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  if (isPublic) return NextResponse.next();

  const cookieNames = req.cookies.getAll().map((c) => c.name);
  const rawSessionCookie = req.cookies.get("__Secure-next-auth.session-token")?.value ?? "";
  const dotParts = rawSessionCookie ? rawSessionCookie.split(".").length : 0;
  // JWE = 5 parts, JWT = 3 parts
  const tokenFormat = dotParts === 5 ? "JWE (encrypted)" : dotParts === 3 ? "JWT (signed)" : `unknown (${dotParts} parts)`;

  // Try 1: standard getToken with NextRequest
  let token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET!,
    cookieName: "__Secure-next-auth.session-token",
    secureCookie: true,
  }).catch(() => null);

  // Try 2: pass cookies as plain object (bypasses NextRequest cookie API differences)
  if (!token && rawSessionCookie) {
    token = await getToken({
      req: { cookies: Object.fromEntries(req.cookies.getAll().map((c) => [c.name, c.value])) } as never,
      secret: process.env.NEXTAUTH_SECRET!,
      cookieName: "__Secure-next-auth.session-token",
      secureCookie: false,
    }).catch(() => null);
  }

  // Try 3: no cookieName — let getToken auto-detect
  if (!token && rawSessionCookie) {
    token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET!,
    }).catch(() => null);
  }

  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return new NextResponse(
      `<!DOCTYPE html><html><body style="font-family:monospace;padding:40px;max-width:700px;margin:0 auto;line-height:1.6">
        <h2 style="color:#ef4444">Access Denied — Debug Info</h2>
        <p><strong>Cookies received:</strong> ${cookieNames.join(", ") || "(none)"}</p>
        <p><strong>NEXTAUTH_SECRET set:</strong> ${!!process.env.NEXTAUTH_SECRET}</p>
        <p><strong>Token format:</strong> ${tokenFormat}</p>
        <p><strong>Raw token prefix:</strong> ${rawSessionCookie.substring(0, 30)}...</p>
        <p><strong>All 3 getToken attempts:</strong> null</p>
      </body></html>`,
      { status: 401, headers: { "Content-Type": "text/html" } }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
