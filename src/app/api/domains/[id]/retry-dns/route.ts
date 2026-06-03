import { NextRequest, NextResponse } from "next/server";
import { getDomainById } from "@/lib/domains";
import { query } from "@/lib/database";
import {
  setupDomainDNS,
  verifyDomainOwnership,
  type DODomainRecord,
} from "@/lib/digitalocean";
import { generateDNSRecords, getDomainDkimTokens } from "@/lib/ses";

function cors(response: NextResponse) {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS"
  );
  response.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );
  return response;
}

// Helper function to convert DODomainRecord to DNSRecord
function convertDORecordToDNSRecord(doRecord: DODomainRecord): {
  type: string;
  name: string;
  value: string;
  ttl: number;
} {
  return {
    type: doRecord.type,
    name: doRecord.name,
    value: doRecord.data,
    ttl: doRecord.ttl,
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return cors(
      NextResponse.json(null, { status: 200 })
    );
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
      return cors(
        NextResponse.json({ error: "Domain not found" }, { status: 404 })
      );
    }

    const domainName = domain.domain;

    try {
      // Get DKIM tokens
      let dkimTokens: string[] = [];
      try {
        dkimTokens = await getDomainDkimTokens(domainName);
        console.log(`Found ${dkimTokens.length} DKIM tokens for ${domainName}`);
      } catch (error) {
        console.log(`No DKIM tokens found for ${domainName}:`, error);
      }

      // Generate DNS records
      const dnsRecords = generateDNSRecords(
        domainName,
        domain.verification_token || "",
        dkimTokens
      );

      // Check if domain exists in Digital Ocean
      console.log(`Checking if ${domainName} exists in DigitalOcean...`);
      const isDomainInDO = await verifyDomainOwnership(domainName);
      if (!isDomainInDO) {
        return cors(
          NextResponse.json(
            {
              success: false,
              error: `Domain ${domainName} not found in your DigitalOcean account. Please add it first.`,
            },
            { status: 400 }
          )
        );
      }

      // Setup DNS in Digital Ocean
      console.log(`Setting up DigitalOcean DNS for ${domainName}...`);
      const doRecords = await setupDomainDNS(domainName, dnsRecords);
      const digitalOceanRecords = doRecords.map(convertDORecordToDNSRecord);

      console.log(
        `Successfully created ${doRecords.length} DNS records for ${domainName}`
      );

      return cors(
        NextResponse.json({
          success: true,
          data: {
            domain: domainName,
            createdRecords: digitalOceanRecords,
            setupInstructions:
              "DNS records have been successfully created/updated in DigitalOcean.",
          },
          message: `DNS setup completed successfully for ${domainName}. Created ${doRecords.length} records.`,
        })
      );
    } catch (error: unknown) {
      console.error(`DNS retry failed for ${domainName}:`, error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      return cors(
        NextResponse.json(
          {
            success: false,
            error: `Failed to setup DigitalOcean DNS: ${errorMessage}`,
            suggestion:
              "Please check your DigitalOcean API token permissions and try again.",
          },
          { status: 500 }
        )
      );
    }
  } catch (error) {
    console.error("API Error:", error);
    return cors(
      NextResponse.json({ error: "Internal server error" }, { status: 500 })
    );
  }
}
