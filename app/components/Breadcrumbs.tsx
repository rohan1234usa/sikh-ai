import IntentLink from '@/app/components/IntentLink';

export type Crumb = { href: string; label: string };

// Where a page sits: the pages above it, each a link. The page itself is the
// h1 that follows, so it isn't repeated here.
export default function Breadcrumbs({ label, crumbs }: { label: string; crumbs: Crumb[] }) {
    return (
        <nav aria-label={label}>
            <ol className="flex flex-wrap items-center gap-1 text-sm text-ink-muted">
                {crumbs.map((crumb, i) => (
                    <li key={crumb.href} className="flex items-center gap-1">
                        {i > 0 && <span aria-hidden="true">›</span>}
                        <IntentLink href={crumb.href} className="hover:text-ink hover:underline">
                            {crumb.label}
                        </IntentLink>
                    </li>
                ))}
            </ol>
        </nav>
    );
}
