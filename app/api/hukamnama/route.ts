import { NextResponse } from 'next/server';

// Normalizes today's Hukamnama into { title, text } for the chat deep-link.
// The upstream API is loosely shaped, so every field access is defensive.

type LooseLine = {
  line?: {
    gurmukhi?: string | { unicode?: string };
    translation?: { english?: string | { default?: string } };
  };
};

export async function GET() {
  try {
    const res = await fetch('https://api.gurbaninow.com/v2/hukamnama/today', { cache: 'no-store' });
    if (!res.ok) throw new Error(`Hukamnama API returned ${res.status}`);
    const data = await res.json();

    const lines: LooseLine[] = Array.isArray(data?.hukamnama) ? data.hukamnama : [];
    const text = lines
      .map((item) => {
        const line = item?.line ?? {};
        const g = line.gurmukhi;
        const gurmukhi = (typeof g === 'string' ? g : g?.unicode) || '';
        const t = line.translation?.english;
        const english = (typeof t === 'string' ? t : t?.default) || '';
        return [gurmukhi, english].filter(Boolean).join('\n');
      })
      .filter(Boolean)
      .join('\n\n');

    if (!text) throw new Error('Hukamnama payload was empty');

    const ang = data?.hukamnamainfo?.pageno;
    const title = typeof ang === 'number' ? `Today's Hukamnama — Ang ${ang}` : "Today's Hukamnama";

    return NextResponse.json({ title, text });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Hukamnama Proxy] Error:', message);
    return NextResponse.json({ error: 'Unable to load the Hukamnama right now.' }, { status: 500 });
  }
}
