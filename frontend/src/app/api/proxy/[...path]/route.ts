import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || "https://journal-ayey.onrender.com";

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function GET(request: NextRequest, context: any) {
  const path: string[] = (await context.params).path ?? [];
  const url = `${BACKEND_URL}/${path.join('/')}`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    console.error('[proxy GET error]', url, e);
    return NextResponse.json({ error: 'Backend unreachable' }, { status: 502 });
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

    // Stream trực tiếp sang backend — không buffer vào memory, không giới hạn size
    const res = await fetch(url, {
      method: 'POST',
      headers: forwardHeaders,
      body: request.body,
      // @ts-ignore — cần thiết để tắt auto body consumption của Node.js fetch
      duplex: 'half',
    } as any);

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    console.error('[proxy POST error]', url, e);
    return NextResponse.json({ error: 'Backend unreachable' }, { status: 502 });
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */