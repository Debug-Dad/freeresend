import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// These routes are public — email sending uses API key auth, not admin session
const PUBLIC_PATHS = ["/api/emails", "/api/webhooks", "/api/health"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  if (isPublic) return NextResponse.next();

  // DEBUG: log all cookie names received
  const cookieNames = req.cookies.getAll().map((c) => c.name);
  console.log("[freeresend-auth] cookies received:", JSON.stringify(cookieNames));
  console.log("[freeresend-auth] NEXTAUTH_SECRET set:", !!process.env.NEXTAUTH_SECRET);

  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET!,
    cookieName: "__Secure-next-auth.session-token",
    secureCookie: true,
  }).catch((e) => { console.log("[freeresend-auth] getToken error:", e?.message); return null; });

  console.log("[freeresend-auth] token result:", token ? `ok (email: ${token.email})` : "null");

  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized", cookies: cookieNames }, { status: 401 });
    }
    return new NextResponse(
      `<!DOCTYPE html><html><body style="font-family:monospace;padding:40px;max-width:700px;margin:0 auto">
        <h2 style="color:#ef4444">Access Denied — Debug Info</h2>
        <p><strong>Cookies received:</strong> ${cookieNames.length === 0 ? "(none)" : cookieNames.join(", ")}</p>
        <p><strong>NEXTAUTH_SECRET set:</strong> ${!!process.env.NEXTAUTH_SECRET}</p>
        <p><strong>Looking for cookie:</strong> __Secure-next-auth.session-token</p>
        <p><strong>Token result:</strong> null</p>
      </body></html>`,
      { status: 401, headers: { "Content-Type": "text/html" } }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
