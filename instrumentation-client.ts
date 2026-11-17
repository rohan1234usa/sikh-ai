// Next runs this on every page before it's interactive. Anything thrown and
// not caught becomes an error report (lib/errors/client.ts, #20): an error in
// an event handler or a timer, a promise nobody handled, and the errors Next
// passes to the browser's own reportError (one no error page caught, a page
// that didn't hydrate cleanly). What an error page catches it reports itself
// (app/[lang]/error.tsx, app/global-error.tsx); those never reach here.
//
// Everything this imports ships on every page: a test keeps the list short.

import { sendErrorReport } from './lib/errors/client';

window.addEventListener('error', (event) => {
    // No Error, nothing to go on: another site's script ("Script error.").
    if (event.error instanceof Error) sendErrorReport(event.error, 'uncaught');
});

window.addEventListener('unhandledrejection', (event) => {
    sendErrorReport(event.reason, 'rejection');
});
