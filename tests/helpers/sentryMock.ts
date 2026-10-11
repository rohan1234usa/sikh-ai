// A stand-in for Sentry, on a free port: it records each envelope it's sent
// and answers as a test tells it to. Point SENTRY_DSN, or a sender's own env,
// at its `dsn` (lib/errors/sentry.ts allows plain http to this machine).

import http from 'node:http';
import type { AddressInfo } from 'node:net';
import type { SentryEvent } from '@/lib/errors/sentry';

export type Received = { path: string; headers: http.IncomingHttpHeaders; body: string; event: SentryEvent };
export type Answer = { status: number; headers?: Record<string, string>; hang?: boolean; delayMs?: number };

export type SentryMock = {
    dsn: string;
    received: Received[];
    // How it answers the next envelope; tests change it as they go.
    answer: Answer;
    close(): Promise<void>;
};

export async function startSentryMock(): Promise<SentryMock> {
    const mock = { received: [] as Received[], answer: { status: 200 } as Answer };
    const server = http.createServer((req, res) => {
        let body = '';
        req.on('data', (chunk) => { body += chunk; });
        req.on('end', () => {
            mock.received.push({ path: req.url ?? '', headers: req.headers, body, event: JSON.parse(body.split('\n')[2]) });
            const { hang, delayMs = 0, status, headers } = mock.answer;
            if (hang) return;
            setTimeout(() => {
                res.writeHead(status, headers);
                res.end('{}');
            }, delayMs);
        });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;
    return Object.assign(mock, {
        dsn: `http://publickey@127.0.0.1:${port}/42`,
        close: () => new Promise<void>((resolve) => {
            server.closeAllConnections();
            server.close(() => resolve());
        }),
    });
}
