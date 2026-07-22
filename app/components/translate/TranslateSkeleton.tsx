// Pulse mock of the result card so the wait for the single JSON response
// feels structured rather than blank. Purely decorative — the page's
// aria-busy region announces the loading state.
export default function TranslateSkeleton() {
    return (
        <div aria-hidden="true" className="bg-surface-raised rounded-xl border border-edge shadow-sm p-4 sm:p-6 animate-pulse space-y-4">
            <div className="h-4 w-40 rounded bg-edge/60" />
            <div className="h-8 w-3/4 rounded bg-edge/60" />
            <div className="h-5 w-2/3 rounded bg-edge/60" />
            <div className="h-5 w-4/5 rounded bg-edge/60" />
            <div className="flex flex-wrap gap-2 pt-2">
                {[0, 1, 2, 3, 4].map(i => (
                    <div key={i} className="h-14 w-24 rounded-lg bg-edge/60" />
                ))}
            </div>
        </div>
    );
}
