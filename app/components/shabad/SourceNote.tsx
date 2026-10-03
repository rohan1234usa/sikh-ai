import type { Dictionary } from '@/lib/i18n';

// The attribution GurbaniNow's licence (CC BY-NC-ND 4.0) asks for, under
// every page that shows its text.
export default function SourceNote({ t }: { t: Dictionary }) {
    const [before, after] = t.shabad.page.sourceNote.split('{source}');
    return (
        <p className="text-center text-xs text-ink-faint">
            {before}
            <a href="https://www.gurbaninow.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-ink-muted">GurbaniNow</a>
            {after}
        </p>
    );
}
