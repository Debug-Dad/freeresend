import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { addDomain, getUserDomains } from "@/lib/domains";
import { query } from "@/lib/database";

const addDomainSchema = z.object({
  domain: z.string().min(1, "Domain is required"),
});

function cors(response: NextResponse) {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return response;
}

export async function GET(request: NextRequest) {
  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return cors(new NextResponse(null, { status: 200 }));
  }

  try {
    const adminResult = await query("SELECT id FROM users LIMIT 1");
    if (adminResult.rows.length === 0) {
      return cors(NextResponse.json({ error: "No admin user configured" }, { status: 500 }));
    }
    const userId = adminResult.rows[0].id;

    const domains = await getUserDomains(userId);

    return cors(NextResponse.json({
      success: true,
      data: { domains },
    }));
  } catch (error) {
    console.error("API Error:", error);
    return cors(NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    ));
  }
}

export async function POST(request: NextRequest) {
  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return cors(new NextResponse(null, { status: 200 }));
  }

  try {
    const adminResult = await query("SELECT id FROM users LIMIT 1");
    if (adminResult.rows.length === 0) {
      return cors(NextResponse.json({ error: "No admin user configured" }, { status: 500 }));
    }
    const userId = adminResult.rows[0].id;

    // Parse and validate request
    const body = await request.json();
    const validatedData = addDomainSchema.parse(body);
    const { domain } = validatedData;

    const result = await addDomain(userId, domain);

    return cors(NextResponse.json({
      success: true,
      data: result,
      message: "Domain added successfully. Please verify DNS records.",
    }));
  } catch (error: unknown) {
    const errorObj = error as { errors?: unknown; message?: string };
    if (errorObj.errors || errorObj.message?.includes('validation') || errorObj.message?.includes('parse')) {
      return cors(NextResponse.json(
        {
          error: "Invalid request data",
          details: errorObj.errors || errorObj.message,
        },
        { status: 400 }
      ));
    }

    console.error("API Error:", error);
    return cors(NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    ));
  }
}
