import Link from 'next/link';
import type { ReactNode } from 'react';
import { splitTemplate } from '@/lib/i18n/fmt';
import type { PolicyLink } from '@/lib/policy';

// /privacy and /terms: a title, the day the page last changed, an intro (also
// the page's description), then sections, each with its own anchor
// (/privacy#analytics). The words live in the dictionaries as sections keyed
// by id, so every language has the same ones in the same order; a {placeholder}
// in an item becomes a figure from lib/policy.ts or a link. `after` puts
// something that isn't words (a switch) at the end of a section.

export type PolicySection = { heading: string; items: readonly string[] };
export type PolicyCopy<Id extends string> = {
    title: string;
    updated: string;
    intro: string;
    sections: Record<Id, PolicySection>;
};

const INLINE_LINK = 'text-accent-text underline hover:no-underline';

function Item({ text, vars, links }: { text: string; vars: Record<string, string | number>; links: Record<string, PolicyLink> }) {
    return splitTemplate(text).map((part, i) => {
        if (typeof part === 'string') return part;
        if (part.key in vars) return String(vars[part.key]);
        const link = links[part.key];
        // An unknown placeholder shows as written; tests/site/policy.test.ts
        // fails on one before it can ship.
        if (!link) return `{${part.key}}`;
        if (link.kind === 'page') return <Link key={i} href={link.href} className={INLINE_LINK}>{link.label}</Link>;
        if (link.kind === 'mail') return <a key={i} href={link.href} className={`${INLINE_LINK} break-all`}>{link.label}</a>;
        return <a key={i} href={link.href} target="_blank" rel="noopener noreferrer" className={INLINE_LINK}>{link.label}</a>;
    });
}

export default function PolicyPage<Id extends string>({ copy, vars, links, after, related }: {
    copy: PolicyCopy<Id>;
    vars: Record<string, string | number>;
    links: Record<string, PolicyLink>;
    after?: Partial<Record<Id, ReactNode>>;
    related: { href: string; label: string }[];
}) {
    return (
        <main className="flex-1 px-4 py-12">
            <article className="mx-auto max-w-2xl space-y-8">
                <header className="space-y-3">
                    <h1 className="text-3xl font-bold text-ink">{copy.title}</h1>
                    <p className="text-sm text-ink-muted"><Item text={copy.updated} vars={vars} links={links} /></p>
                    <p className="text-ink leading-relaxed">{copy.intro}</p>
                </header>
                {(Object.entries(copy.sections) as [Id, PolicySection][]).map(([id, section]) => (
                    <section key={id} id={id} aria-labelledby={`${id}-heading`} className="space-y-3 scroll-mt-20">
                        <h2 id={`${id}-heading`} className="text-xl font-bold text-ink">{section.heading}</h2>
                        {section.items.length === 1 ? (
                            <p className="text-ink leading-relaxed"><Item text={section.items[0]} vars={vars} links={links} /></p>
                        ) : (
                            <ul className="list-disc pl-5 space-y-2 text-ink leading-relaxed">
                                {section.items.map((item) => <li key={item}><Item text={item} vars={vars} links={links} /></li>)}
                            </ul>
                        )}
                        {after?.[id]}
                    </section>
                ))}
                <p className="flex flex-wrap gap-x-6 gap-y-2">
                    {related.map(({ href, label }) => (
                        <Link key={href} href={href} className="text-sm font-semibold text-accent-text hover:underline">
                            {label} →
                        </Link>
                    ))}
                </p>
            </article>
        </main>
    );
}
