import type { Instrumentation } from 'next';

// A server error nothing else caught (lib/errors/requestError.ts). The site
// runs no code on the edge, and the module it loads is Node's alone
// (node:https, AsyncLocalStorage), so it's loaded only under Node.
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
    if (process.env.NEXT_RUNTIME !== 'nodejs') return;
    const { logRequestError } = await import('./lib/errors/requestError');
    await logRequestError(error, request, context);
};
