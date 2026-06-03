import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateApiKey, getUserApiKeys } from "@/lib/api-keys";
import { getDomainById } from "@/lib/domains";
import { query } from "@/lib/database";

const createApiKeySchema = z.object({
  domainId: z.string().uuid("Invalid domain ID"),
  keyName: z.string().min(1, "Key name is required"),
  permissions: z.array(z.string()).optional().default(["send"]),
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

    const apiKeys = await getUserApiKeys(userId);

    return cors(NextResponse.json({
      success: true,
      data: { apiKeys },
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
    const validatedData = createApiKeySchema.parse(body);
    const { domainId, keyName, permissions = ["send"] } = validatedData;

    // Verify domain belongs to user
    const domain = await getDomainById(domainId);
    if (!domain || domain.user_id !== userId) {
      return cors(NextResponse.json(
        { error: "Domain not found or unauthorized" },
        { status: 404 }
      ));
    }

    // Check if domain is verified
    if (domain.status !== "verified") {
      return cors(NextResponse.json(
        { error: "Domain must be verified before creating API keys" },
        { status: 400 }
      ));
    }

    const apiKey = await generateApiKey(
      userId,
      domainId,
      keyName,
      permissions
    );

    return cors(NextResponse.json({
      success: true,
      data: { apiKey },
      message:
        "API key created successfully. Save it securely - it will not be shown again.",
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
