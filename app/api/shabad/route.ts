import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query');
  // Type param is no longer needed/used.

  // The `code` field lets clients render a translated message; the English
  // `error` string stays for logs and older clients.
  if (!query) return NextResponse.json({ error: 'Missing query', code: 'missing_query' }, { status: 400 });

  const cleanQuery = query.trim();

  // Validation: Must be a number (double check server side)
  if (!/^\d+$/.test(cleanQuery)) {
    return NextResponse.json({ error: 'Invalid Ang number', code: 'invalid_ang' }, { status: 400 });
  }

  // We use the legacy stable domain. 
  // If this fails, the entire ecosystem is likely down.
  const BASE_URL = 'https://api.gurbaninow.com/v2';

  try {
    // -------------------------
    // ANG SEARCH ONLY
    // -------------------------
    const url = `${BASE_URL}/ang/${cleanQuery}`;
    const res = await fetch(url);
    if (!res.ok) {
      // Ang 1 should definitely exist. If 404, API is misbehaving or out of range (though client checks range).
      throw new Error(`Ang API returned ${res.status}`);
    }
    const data = await res.json();
    return NextResponse.json(data);

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Proxy] Critical Error:', message);
    return NextResponse.json(
      { error: `Gurbani Source Error: ${message}`, code: 'source_error' },
      { status: 500 }
    );
  }
}