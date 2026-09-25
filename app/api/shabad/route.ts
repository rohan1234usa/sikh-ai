import { NextResponse } from 'next/server';
import { MAX_ANG } from '@/lib/gurbani/citations';
import { fetchAngPayload } from '@/lib/gurbani/gurbaninow';

// One Ang from GurbaniNow, passed through as-is for the Ang reader and the
// chat's links to an Ang. An Ang's text never changes, so a good answer is
// cached for a month at the CDN (Vercel empties that cache on every deploy)
// and for a day in the browser. Errors are never cached.
const ANG_CACHE = 'public, max-age=86400, s-maxage=2592000, stale-while-revalidate=86400';
const NO_STORE = { 'Cache-Control': 'no-store' };

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get('query');

  // The `code` field lets clients render a translated message; the English
  // `error` string stays for logs and older clients.
  if (!query) {
    return NextResponse.json({ error: 'Missing query', code: 'missing_query' }, { status: 400, headers: NO_STORE });
  }

  // The browser checks the range too; this is the check that counts.
  const clean = query.trim();
  const ang = /^\d+$/.test(clean) ? Number(clean) : NaN;
  if (!Number.isInteger(ang) || ang < 1 || ang > MAX_ANG) {
    return NextResponse.json({ error: 'Invalid Ang number', code: 'invalid_ang' }, { status: 400, headers: NO_STORE });
  }

  const data = await fetchAngPayload(ang);
  if (data === null) {
    // What went wrong upstream is in the server log; visitors get the
    // translated message for the code.
    return NextResponse.json(
      { error: 'Could not reach the Gurbani source', code: 'source_error' },
      { status: 502, headers: NO_STORE },
    );
  }
  return NextResponse.json(data, { headers: { 'Cache-Control': ANG_CACHE } });
}
