import { limitVisitor } from '@/lib/api/allowance';
import { refuseCrossSite } from '@/lib/api/guard';
import { readClientReport, type ReadReport } from '@/lib/errors/report';
import { browserEvent } from '@/lib/errors/sentry';
import { currentRequestId, logEvent, sendInBackground, withRequestLog } from '@/lib/log';

// The site's pages post their own errors here (lib/errors/client.ts, #20).
// Each report is read again from scratch (lib/errors/report.ts), since anyone
// can post anything, then logged as a client_error line and sent on to Sentry
// when it's set up (lib/errors/sentry.ts). So the browser talks only to this
// site, and Sentry never sees a visitor's address, cookies or text. The line
// is a warning, so lib/log.ts doesn't send it a second time.

// A report's worth; anything bigger isn't the site's reporter.
const MAX_BODY_CHARS = 16_000;
// Taken or not, a report gets no answer worth reading.
const done = () => new Response(null, { status: 204 });

// A frame as a log line shows it: function, file, line and column.
const frameText = ({ fn, file, line, column }: ReadReport['frames'][number]) =>
    `${fn ? `${fn} ` : ''}${file}:${line}:${column}`;

async function handlePost(req: Request) {
    const refused = refuseCrossSite(req);
    if (refused) return refused;
    // A browser asking every site not to track it (Global Privacy Control)
    // sends no reports; one that arrives anyway is dropped unread.
    if (req.headers.get('sec-gpc') === '1') return done();
    const raw = await req.text();
    if (raw.length > MAX_BODY_CHARS) return new Response(null, { status: 413 });
    let body: unknown;
    try {
        body = JSON.parse(raw);
    } catch {
        return new Response(null, { status: 400 });
    }
    const origin = new URL(req.url).origin;
    const report = readClientReport(body, origin);
    if (!report) return done();
    const limited = limitVisitor(req, 'errorReport');
    if (limited) return limited;
    logEvent('client_error', {
        kind: report.kind,
        error: report.message ? `${report.name}: ${report.message}` : report.name,
        page: report.page,
        frames: report.frames.slice(0, 6).map(frameText),
    }, 'warn');
    void sendInBackground(browserEvent(report, {
        origin,
        userAgent: req.headers.get('user-agent'),
        requestId: currentRequestId(),
    }));
    return done();
}

export const POST = withRequestLog('/api/error-report', handlePost);
