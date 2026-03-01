import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || "https://journal-ayey.onrender.com";

// Fetch với timeout tuỳ chỉnh
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 60000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function GET(request: NextRequest, context: any) {
  const path: string[] = (await context.params).path ?? [];
  const url = `${BACKEND_URL}/${path.join('/')}`;

  try {
    // Timeout 60s để chờ backend wake up trên Render free tier
    const res = await fetchWithTimeout(url, {}, 60000);
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e: any) {
    console.error('[proxy GET error]', url, e?.message);
    const msg = e?.name === 'AbortError' ? 'Backend timeout (đang khởi động, thử lại sau)' : 'Backend unreachable';
    return NextResponse.json({ error: msg, url }, { status: 502 });
  }
}

export async function POST(request: NextRequest, context: any) {
  const path: string[] = (await context.params).path ?? [];
  const url = `${BACKEND_URL}/${path.join('/')}`;

  try {
    const authHeader = request.headers.get('authorization') || '';
    const contentType = request.headers.get('content-type') || '';

    const forwardHeaders: Record<string, string> = {};
    if (contentType) forwardHeaders['Content-Type'] = contentType;
    if (authHeader) forwardHeaders['Authorization'] = authHeader;

    const body = await request.arrayBuffer();

    // Timeout 60s để chờ backend wake up + xử lý upload ảnh
    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: forwardHeaders,
      body,
    }, 30000);

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e: any) {
    console.error('[proxy POST error]', url, e?.message);
    const msg = e?.name === 'AbortError' ? 'Backend timeout (đang khởi động, thử lại sau)' : 'Backend unreachable';
    return NextResponse.json({ error: msg, url }, { status: 502 });
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */