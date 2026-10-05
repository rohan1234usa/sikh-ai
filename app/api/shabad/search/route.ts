import { NextResponse } from 'next/server';
import { refuseCrossSite } from '@/lib/api/guard';
import { meters, verseSearchClient } from '@/lib/gurbani/gurbaninow';
import { alternativesOf, classifyQuery, isSearchable, parseSearchAs, type VerseSearchResponse } from '@/lib/gurbani/query';
import { MAX_SEARCH_CALLS, searchVerses } from '@/lib/gurbani/search';
import { logEvent, logRouteError, withRequestLog } from '@/lib/log';

// Shabad Search's verse search: a line of Gurbani, in Gurmukhi or English
// letters, or its first letters, to the shabads it's in. Sri Guru Granth
// Sahib Ji only (lib/gurbani/search.ts).
//
// GET, so the CDN can keep an answer: Gurbani doesn't change, so a complete
// answer is kept for a month there (Vercel empties it on every deploy) and
// an hour in the browser. "Nothing matched" is kept a day: it is an answer,
// but a spelling the search learns to read later should find its line
// before long. An incomplete answer, and every error, is never kept. The
// answer is the same in every language, so one copy serves all three.
//
// The search text is never logged.

export const maxDuration = 15;
// Two waves of lookups, each cut off by GurbaniNow's client after 3.5 s.
const DEADLINE_MS = 7000;
const FOUND_CACHE = 'public, max-age=3600, s-maxage=2592000, stale-while-revalidate=86400';
const EMPTY_CACHE = 'public, max-age=300, s-maxage=86400';
const NO_STORE = { 'Cache-Control': 'no-store' };

const fail = (status: number, code: string, error: string, extra: object = {}) =>
  NextResponse.json({ error, code, ...extra }, { status, headers: NO_STORE });

async function handleGet(request: Request) {
  // Another site's page (an <img> or a fetch from elsewhere) could spend the
  // search's allowance for everyone: refused first (lib/api/guard.ts). The
  // refusal is never cached, so it can't reach this site's own visitors.
  const refused = refuseCrossSite(request);
  if (refused) return refused;
  const params = new URL(request.url).searchParams;
  const q = params.get('q');
  if (q === null || q.trim() === '') return fail(400, 'missing_query', 'Missing query');

  // The browser classifies too; this is the check that counts.
  const query = classifyQuery(q, parseSearchAs(params.get('as')));
  if (!isSearchable(query)) {
    const reason = query.kind === 'ang' ? 'ang' : query.reason;
    return fail(400, 'invalid_query', 'Not a searchable line of Gurbani', { reason });
  }
  // A search can't run to the end without the allowance for its lookups.
  if (meters.verseSearch.remaining() < MAX_SEARCH_CALLS) {
    return fail(503, 'search_busy', 'Shabad Search is busy');
  }

  const started = Date.now();
  try {
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(DEADLINE_MS)]);
    const found = await searchVerses(query, { client: verseSearchClient, signal });
    if (!found) {
      // What went wrong upstream is in the server log; visitors get the
      // translated message for the code.
      return fail(502, 'source_error', 'Could not reach the Gurbani source');
    }
    logEvent('verse_search', {
      kind: query.kind,
      calls: found.calls,
      hits: found.hits.length,
      complete: found.complete,
      truncated: found.truncated,
      ms: Date.now() - started,
    });
    const body: VerseSearchResponse = {
      kind: query.kind,
      hits: found.hits,
      complete: found.complete,
      truncated: found.truncated,
      alternatives: alternativesOf(query),
    };
    const cache = !found.complete ? NO_STORE['Cache-Control'] : found.hits.length > 0 ? FOUND_CACHE : EMPTY_CACHE;
    return NextResponse.json(body, { headers: { 'Cache-Control': cache } });
  } catch (error) {
    logRouteError(error);
    return fail(500, 'search_failed', 'The search failed');
  }
}

export const GET = withRequestLog('/api/shabad/search', handleGet);
