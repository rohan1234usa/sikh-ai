import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query');
  const type = searchParams.get('type'); 

  if (!query) return NextResponse.json({ error: 'Missing query' }, { status: 400 });

  const cleanQuery = query.trim();
  const isEnglish = /^[A-Za-z0-9\s]+$/.test(cleanQuery);
  
  // We use the legacy stable domain. 
  // If this fails, the entire ecosystem is likely down.
  const BASE_URL = 'https://api.gurbaninow.com/v2';

  try {
    // -------------------------
    // CASE 1: ANG SEARCH
    // -------------------------
    if (type === 'ang') {
      const url = `${BASE_URL}/ang/${cleanQuery}`;
      console.log(`[Proxy] Fetching Ang: ${url}`);
      
      const res = await fetch(url);
      if (!res.ok) {
        // Ang 1 should definitely exist. If 404, API is misbehaving.
        throw new Error(`Ang API returned ${res.status}`);
      }
      const data = await res.json();
      return NextResponse.json(data);
    } 

    // -------------------------
    // CASE 2: TEXT SEARCH
    // -------------------------
    
    // Default: Search Gurmukhi
    let url = `${BASE_URL}/search/${encodeURIComponent(cleanQuery)}`;

    if (isEnglish) {
      // English Logic:
      // searchtype=4 is English Transliteration (Sound) -> "Nanak"
      // searchtype=3 is English Translation (Meaning) -> "Truth"
      
      // Step A: Try Transliteration First
      const transUrl = `${BASE_URL}/search/${encodeURIComponent(cleanQuery)}?searchtype=4`;
      console.log(`[Proxy] Trying Transliteration: ${transUrl}`);
      
      const transRes = await fetch(transUrl);
      const transData = await transRes.json();

      // If we found results, return them immediately
      if (transRes.ok && transData.count > 0) {
        return NextResponse.json(transData);
      }

      // Step B: If Transliteration failed, Try Translation
      console.log(`[Proxy] Transliteration empty. Switching to Translation...`);
      url = `${BASE_URL}/search/${encodeURIComponent(cleanQuery)}?searchtype=3`;
    }

    // Final Fetch (either Gurmukhi default OR English Translation fallback)
    console.log(`[Proxy] Final Fetch: ${url}`);
    const res = await fetch(url);
    
    if (!res.ok) {
       throw new Error(`Search API returned ${res.status}`);
    }

    const data = await res.json();
    return NextResponse.json(data);

  } catch (error: any) {
    console.error('[Proxy] Critical Error:', error.message);
    return NextResponse.json(
      { error: `Gurbani Source Error: ${error.message}` }, 
      { status: 500 }
    );
  }
}