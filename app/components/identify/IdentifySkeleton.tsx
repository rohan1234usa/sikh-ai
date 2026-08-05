// Pulse mock of the "we heard" card plus two match cards, so the wait for
// transcription and search feels structured rather than blank. Purely
// decorative — the page's aria-busy region announces the loading state.
export default function IdentifySkeleton() {
    return (
        <div aria-hidden="true" className="space-y-4">
            <div className="bg-surface-raised rounded-xl border border-edge shadow-sm p-4 sm:p-6 animate-pulse space-y-3">
                <div className="h-3 w-24 rounded bg-edge/60" />
                <div className="h-6 w-4/5 rounded bg-edge/60" />
                <div className="h-4 w-2/3 rounded bg-edge/60" />
            </div>
            {[0, 1].map(i => (
                <div
                    key={i}
                    className="bg-surface-raised rounded-xl border border-edge shadow-sm p-4 sm:p-6 animate-pulse space-y-4"
                >
                    <div className="flex justify-between">
                        <div className="h-6 w-28 rounded-full bg-edge/60" />
                        <div className="h-4 w-16 rounded bg-edge/60" />
                    </div>
                    <div className="h-8 w-3/4 mx-auto rounded bg-edge/60" />
                    <div className="h-4 w-2/3 mx-auto rounded bg-edge/60" />
                </div>
            ))}
        </div>
    );
}
