// A page that can't be built because its source (GurbaniNow, Firestore) gave
// no usable answer. The pages throw it rather than show it, so a passing
// outage isn't cached as the page, and the error page offers Try again. It
// passes on its own, and the fetchers already log the outage itself
// (upstream_error), so it's a warning: instrumentation.ts doesn't send it on
// to Sentry (lib/errors/requestError.ts). Read by name, since Next can bundle
// this class more than once.
export class SourceUnavailable extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'SourceUnavailable';
    }
}
