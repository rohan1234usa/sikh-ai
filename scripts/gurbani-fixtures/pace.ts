// GurbaniNow turns away bursts: about 36 quick calls bring "503 No available
// server" for a minute. So the scripts that call it in bulk (the fixture
// recorder, npm run eval:search) make their calls one at a time, `gapMs`
// apart, each tried once more after `retryMs` if it went unanswered (null).

const sleep = (ms: number) => new Promise(done => setTimeout(done, ms));

export function pacedCalls({ gapMs, retryMs }: { gapMs: number; retryMs: number }) {
    let last = 0;
    let queue: Promise<unknown> = Promise.resolve();
    return <T>(call: () => Promise<T | null>): Promise<T | null> => {
        const next = queue.then(async () => {
            for (let attempt = 0; attempt < 2; attempt++) {
                const wait = last + (attempt ? retryMs : gapMs) - Date.now();
                if (wait > 0) await sleep(wait);
                last = Date.now();
                const result = await call();
                if (result !== null) return result;
            }
            return null;
        });
        // A call that throws fails alone; the ones queued behind it still run.
        queue = next.catch(() => undefined);
        return next;
    };
}
