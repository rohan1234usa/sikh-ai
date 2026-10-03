'use client';

import IntentLink from './IntentLink';
import { usePathname } from 'next/navigation';
import { splitLocale } from '@/lib/i18n/paths';
import { useLocalePath, useT } from '../context/LanguageContext';

export default function Footer() {
    const { path } = splitLocale(usePathname());
    const t = useT();
    const to = useLocalePath();

    const links = [
        { href: to('/about'), label: t.nav.about },
        { href: to('/hukamnama'), label: t.nav.hukamnama },
        { href: to('/seva'), label: t.nav.seva },
        { href: to('/shabad'), label: t.nav.shabad },
        { href: to('/translate'), label: t.nav.translate },
        { href: to('/learn'), label: t.nav.learn },
        { href: to('/privacy'), label: t.footer.privacy },
        { href: to('/terms'), label: t.footer.terms },
    ];

    // The chat screen (/chat and each saved chat) and the Punjabi tutor are
    // fixed-height app screens with no room for a footer
    if (path === '/chat' || path.startsWith('/chat/') || path === '/learn/tutor') return null;

    return (
        <footer className="border-t border-edge bg-surface-raised mt-auto">
            <div className="mx-auto max-w-7xl px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-ink-muted">
                <p className="flex items-center gap-2 font-semibold text-ink">
                    <span className="font-gurmukhi text-accent-text" aria-hidden="true">ੴ</span> SikhAI
                </p>
                <nav aria-label={t.footer.navAria}>
                    <ul className="flex flex-wrap justify-center gap-x-5 gap-y-2">
                        {links.map(({ href, label }) => (
                            <li key={href}>
                                <IntentLink href={href} className="hover:text-accent-text transition-colors">
                                    {label}
                                </IntentLink>
                            </li>
                        ))}
                    </ul>
                </nav>
                <p>
                    {t.footer.builtBy}{' '}
                    <a
                        href="https://built-by-rohan.vercel.app/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:text-accent-text transition-colors"
                    >
                        Rohan Singh
                    </a>
                </p>
            </div>
        </footer>
    );
}
