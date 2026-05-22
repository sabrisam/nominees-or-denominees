import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key");
  if (!key) {
    return NextResponse.json({ ok: false, error: "Missing key" }, { status: 400 });
  }

  const chunks: string[] = [];
  let index = 0;
  
  while (true) {
    const cookieName = index === 0 ? key : `${key}_${index}`;
    const chunk = request.cookies.get(cookieName)?.value;
    if (!chunk) break;
    chunks.push(chunk);
    index++;
  }

  if (chunks.length === 0) {
    return NextResponse.json({ ok: true, value: null });
  }

  return NextResponse.json({ ok: true, value: chunks.join("") });
}

export async function POST(request: NextRequest) {
  try {
    const { action, key, value } = await request.json();
    const response = NextResponse.json({ ok: true });
    const isProd = process.env.NODE_ENV === "production";
    
    if (action === "set") {
      // Chunking for cookie size limits (4KB)
      const chunkSize = 3000;
      const chunks = Math.ceil(value.length / chunkSize);
      
      for (let i = 0; i < chunks; i++) {
        const cookieName = i === 0 ? key : `${key}_${i}`;
        const chunkValue = value.substring(i * chunkSize, (i + 1) * chunkSize);
        response.cookies.set(cookieName, chunkValue, {
          httpOnly: true,
          secure: isProd,
          sameSite: "lax",
          maxAge: 60 * 60 * 24 * 365, // 1 year
          path: "/",
        });
      }
    } else if (action === "remove") {
      // Remove up to 5 chunks just in case
      for (let i = 0; i < 5; i++) {
        const cookieName = i === 0 ? key : `${key}_${i}`;
        response.cookies.set(cookieName, "", {
          maxAge: -1,
          path: "/",
        });
      }
    }
    
    return response;
  } catch (err) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
