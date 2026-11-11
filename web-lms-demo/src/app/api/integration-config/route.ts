import { NextResponse } from "next/server";

export async function GET() {
  const secret = process.env.SECURESIGN_API_SECRET || "";
  const key = process.env.SECURESIGN_API_KEY || "";
  return NextResponse.json({
    configured: Boolean(secret || key),
    apiUrl: process.env.SECURESIGN_API_URL || "http://localhost:8000",
    apiKeyPrefix: (key || secret).slice(0, 12),
  });
}
