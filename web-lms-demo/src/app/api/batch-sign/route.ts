import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const apiUrl = (process.env.SECURESIGN_API_URL || "http://localhost:8000").replace(/\/$/, "");
  const apiSecret = process.env.SECURESIGN_API_SECRET || process.env.SECURESIGN_API_KEY;

  if (!apiSecret) {
    return NextResponse.json(
      { detail: "LMS demo chưa được cấu hình SECURESIGN_API_SECRET hoặc SECURESIGN_API_KEY." },
      { status: 503 },
    );
  }

  const incoming = await request.formData();
  const outbound = new FormData();
  for (const [name, value] of incoming.entries()) {
    if (typeof value === "string") {
      outbound.append(name, value);
    } else {
      outbound.append(name, value, value.name);
    }
  }

  try {
    const response = await fetch(`${apiUrl}/api/batch/sign`, {
      method: "POST",
      headers: { "X-API-Key": apiSecret },
      body: outbound,
      cache: "no-store",
    });
    const body = await response.arrayBuffer();
    const headers = new Headers();
    for (const name of ["content-type", "content-disposition", "x-tracking-ids", "retry-after"]) {
      const value = response.headers.get(name);
      if (value) headers.set(name, value);
    }
    return new NextResponse(body, { status: response.status, headers });
  } catch {
    return NextResponse.json(
      { detail: "Không thể kết nối SecureSign API từ LMS demo." },
      { status: 502 },
    );
  }
}
