'use client';

import IntentLink from './IntentLink';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import { useLocalePath, useT } from '../context/LanguageContext';
import AccountMenu from './AccountMenu';
import ThemeToggle from './ThemeToggle';
import LanguageToggle from './LanguageToggle';

export default function Navbar() {
    const { user, signIn, signInIntent } = useAuth();
    const t = useT();
    const to = useLocalePath();
    const pathname = usePathname();
    const [open, setOpen] = useState(false);
    const closeMenu = () => setOpen(false);

    // Seven links fit on one line from lg (1024px) up in all three languages,
    // romanized Punjabi's being the longest, at a tight gap; below lg they sit
    // in the menu. The sign-in button never wraps, and the account menu's
    // greeting waits for xl and cuts a long name short, so the row stays one
    // line (checked at 1024 and 1280px in romanized Punjabi, signed in and out).
    const links = [
        { href: to('/about'), label: t.nav.about },
        { href: to('/hukamnama'), label: t.nav.hukamnama },
        { href: to('/chat'), label: t.nav.chat },
        { href: to('/seva'), label: t.nav.seva },
        { href: to('/shabad'), label: t.nav.shabad },
        { href: to('/translate'), label: t.nav.translate },
        { href: to('/learn'), label: t.nav.learn },
    ];

    const isActive = (href: string) =>
        pathname === href || pathname.startsWith(href + '/');

    return (
        <header className="sticky top-0 z-50 bg-navy text-white shadow-md dark:border-b dark:border-white/10 [--focus-ring:var(--color-kesri)]">
            <nav aria-label={t.nav.mainNavAria} className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
                <IntentLink href={to('/')} onClick={closeMenu} className="flex items-center gap-2 text-xl font-bold tracking-wide">
                    <span className="font-gurmukhi text-kesri" aria-hidden="true">ੴ</span> SikhAI
                </IntentLink>

                <ul className="hidden lg:flex items-center gap-2 xl:gap-4 whitespace-nowrap text-sm font-medium">
                    {links.map(({ href, label }) => (
                        <li key={href}>
                            <IntentLink
                                href={href}
                                aria-current={isActive(href) ? 'page' : undefined}
                                className={isActive(href)
                                    ? 'text-kesri font-semibold'
                                    : 'text-slate-300 hover:text-kesri transition-colors'}
                            >
                                {label}
                            </IntentLink>
                        </li>
                    ))}
                </ul>

                <div className="flex items-center gap-3">
                    <LanguageToggle />
                    <ThemeToggle />
                    {user ? (
                        <AccountMenu user={user} />
                    ) : (
                        // Hidden, keeping its place, while a returning member's
                        // session is restored (data-auth: lib/firebase/hint.ts).
                        // data-sign-in: where focus goes once an account is
                        // signed out or deleted, and the menu that had it is gone.
                        <button
                            data-sign-in
                            onClick={signIn}
                            {...signInIntent}
                            className="shrink-0 whitespace-nowrap bg-kesri text-navy text-sm font-semibold px-3 py-1.5 rounded-lg hover:bg-kesri-hover transition-colors in-data-[auth=1]:invisible"
                        >
                            {t.nav.signIn}
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => setOpen(o => !o)}
                        aria-expanded={open}
                        aria-controls="mobile-nav"
                        aria-label={t.nav.toggleMenu}
                        className="lg:hidden p-2 -mr-2"
                    >
                        {open ? <XMarkIcon className="w-6 h-6" /> : <Bars3Icon className="w-6 h-6" />}
                    </button>
                </div>
            </nav>

            {open && (
                <ul id="mobile-nav" className="lg:hidden border-t border-white/10 bg-navy px-4 py-3 space-y-1">
                    {links.map(({ href, label }) => (
                        <li key={href}>
                            <IntentLink
                                href={href}
                                onClick={closeMenu}
                                aria-current={isActive(href) ? 'page' : undefined}
                                className={`block rounded-lg px-3 py-2 ${isActive(href)
                                    ? 'bg-white/10 text-kesri font-semibold'
                                    : 'text-slate-200 hover:bg-white/5'}`}
                            >
                                {label}
                            </IntentLink>
                        </li>
                    ))}
                </ul>
            )}
        </header>
    );
}
