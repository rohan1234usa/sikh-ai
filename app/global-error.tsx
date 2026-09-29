'use client';

import Link from 'next/link';
import { useEffect, useSyncExternalStore } from 'react';
import './globals.css';
import { FONT_VARIABLES } from './fonts';
import { PRIMARY_BUTTON, StatusPage } from './components/StatusPage';
import { DEFAULT_LANG, LANG_META } from '@/lib/i18n/config';
import { localePath, splitLocale } from '@/lib/i18n/paths';
import { getDictionary } from '@/lib/i18n';
import { watchTheme } from '@/lib/theme';

// Shown in place of the root layout when the layout itself fails, so none of
// it is here: no navbar, no language or auth provider, no pre-paint theme
// script. It still reads as the site. The language comes from the address
// (lib/i18n/paths.ts), and the stored light or dark choice is put back on
// <html>, which this page renders afresh. A failure in any single page is
// app/[lang]/error.tsx's job, inside the layout.

// This page must not fail in turn: anything odd just means English.
function readLang() {
    try {
        return splitLocale(window.location.pathname).lang;
    } catch {
        return DEFAULT_LANG;
    }
}
const neverChanges = () => () => {};

export default function GlobalError({ error, retry }: {
    error: Error & { digest?: string };
    retry: () => void;
}) {
    // English on the server, which renders this without the address; the
    // page's own language takes over as it hydrates.
    const lang = useSyncExternalStore(neverChanges, readLang, () => DEFAULT_LANG);
    const t = getDictionary(lang);

    useEffect(() => {
        console.error(error);
    }, [error]);

    useEffect(() => watchTheme(), []);

    return (
        <html lang={LANG_META[lang].htmlLang} className={FONT_VARIABLES} suppressHydrationWarning>
            <body className="antialiased min-h-dvh flex flex-col">
                <title>{t.meta.titleTemplate.replace('%s', t.errorPage.heading)}</title>
                <StatusPage heading={t.errorPage.heading} body={t.errorPage.body}>
                    <button type="button" onClick={() => retry()} className={PRIMARY_BUTTON}>
                        {t.errorPage.retry}
                    </button>
                    <Link href={localePath(lang, '/')} className="text-sm font-semibold text-accent-text hover:underline">
                        {t.notFound.home}
                    </Link>
                </StatusPage>
            </body>
        </html>
    );
}
