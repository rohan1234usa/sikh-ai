// The JSON body of a response the page didn't want (a refusal, an error),
// or null. A rate limiter or proxy in front of an API can answer with HTML,
// which is let go unread, and a body that isn't JSON after all is null too.
export async function readJson(res: Response): Promise<unknown> {
    if (!res.headers.get('content-type')?.includes('json')) {
        void res.body?.cancel();
        return null;
    }
    return res.json().catch(() => null);
}
