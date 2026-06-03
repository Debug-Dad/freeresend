import { NextRequest, NextResponse } from "next/server";
import { getDomainById, deleteDomain } from "@/lib/domains";
import { query } from "@/lib/database";

function cors(response: NextResponse) {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return response;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const domain = await getDomainById(id);

    if (!domain || domain.user_id !== userId) {
      return cors(NextResponse.json({ error: "Domain not found" }, { status: 404 }));
    }

    return cors(NextResponse.json({
      success: true,
      data: { domain },
    }));
  } catch (error) {
    console.error("API Error:", error);
    return cors(NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    ));
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    await deleteDomain(id, userId);

    return cors(NextResponse.json({
      success: true,
      message: "Domain deleted successfully",
    }));
  } catch (error) {
    console.error("API Error:", error);
    return cors(NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    ));
  }
}
