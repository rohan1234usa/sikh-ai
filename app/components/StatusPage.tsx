import type { ReactNode } from 'react';

export { PRIMARY_BUTTON } from './buttons';

// The body of the error pages. It sits on the same theme tokens as every
// other page, so it follows the user's theme (Next's built-in fallback pages
// paint their own white, or OS-dark, body). The 404 is app/global-not-found.tsx,
// a server page that shares PRIMARY_BUTTON; neither needs the client.
export function StatusPage({ code, heading, body, children }: {
    code?: string;
    heading: string;
    body: string;
    children: ReactNode;
}) {
    return (
        <main className="flex-1 flex items-center justify-center px-4 py-20">
            <div className="max-w-md text-center space-y-4">
                {code && <p className="text-sm font-semibold tracking-widest text-accent-text">{code}</p>}
                <h1 className="text-3xl font-bold text-ink">{heading}</h1>
                <p className="text-ink-muted">{body}</p>
                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">{children}</div>
            </div>
        </main>
    );
}
