import { summarizeCspReports } from '@/lib/cspReport';
import { logEvent, withRequestLog } from '@/lib/log';

// Browsers post what the Content-Security-Policy (lib/csp.ts) blocked here.
// Each violation becomes one csp_violation log line: the directive, the
// blocked origin and the page's path, nothing more. A line is either a host
// the policy should list, or a browser extension's own code.

// A page's worth of reports; anything bigger isn't a browser reporting.
const MAX_BODY_CHARS = 64_000;

async function handlePost(req: Request) {
  const raw = await req.text();
  if (raw.length > MAX_BODY_CHARS) return new Response(null, { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response(null, { status: 400 });
  }
  for (const violation of summarizeCspReports(body)) logEvent('csp_violation', violation, 'warn');
  return new Response(null, { status: 204 });
}

export const POST = withRequestLog('/api/csp-report', handlePost);
