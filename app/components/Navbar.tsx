'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import { useT } from '../context/LanguageContext';
import { fmt } from '@/lib/i18n/fmt';
import ThemeToggle from './ThemeToggle';
import LanguageToggle from './LanguageToggle';

export default function Navbar() {
    const { user, signIn, logOut } = useAuth();
    const t = useT();
    const pathname = usePathname();
    const [open, setOpen] = useState(false);
    const closeMenu = () => setOpen(false);

    const links = [
        { href: '/about', label: t.nav.about },
        { href: '/hukamnama', label: t.nav.hukamnama },
        { href: '/chat', label: t.nav.chat },
        { href: '/seva', label: t.nav.seva },
        { href: '/shabad', label: t.nav.shabad },
        { href: '/translate', label: t.nav.translate },
    ];

    const isActive = (href: string) =>
        pathname === href || pathname.startsWith(href + '/');

    return (
        <header className="sticky top-0 z-50 bg-navy text-white shadow-md dark:border-b dark:border-white/10">
            <nav aria-label={t.nav.mainNavAria} className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
                <Link href="/" onClick={closeMenu} className="flex items-center gap-2 text-xl font-bold tracking-wide">
                    <span className="font-gurmukhi text-kesri" aria-hidden="true">ੴ</span> SikhAI
                </Link>

                <ul className="hidden md:flex items-center gap-6 text-sm font-medium">
                    {links.map(({ href, label }) => (
                        <li key={href}>
                            <Link
                                href={href}
                                aria-current={isActive(href) ? 'page' : undefined}
                                className={isActive(href)
                                    ? 'text-kesri font-semibold'
                                    : 'text-slate-300 hover:text-kesri transition-colors'}
                            >
                                {label}
                            </Link>
                        </li>
                    ))}
                </ul>

                <div className="flex items-center gap-3">
                    <LanguageToggle />
                    <ThemeToggle />
                    {user ? (
                        <div className="flex items-center gap-3">
                            <span className="hidden lg:inline text-sm text-slate-300">
                                {fmt(t.nav.greeting, { name: user.displayName?.split(' ')[0] ?? '' })}
                            </span>
                            <button
                                onClick={logOut}
                                className="border border-kesri text-kesri text-sm font-semibold px-3 py-1.5 rounded-lg hover:bg-kesri hover:text-navy transition-colors"
                            >
                                {t.nav.signOut}
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={signIn}
                            className="bg-kesri text-navy text-sm font-semibold px-3 py-1.5 rounded-lg hover:bg-kesri-hover transition-colors"
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
                        className="md:hidden p-2 -mr-2"
                    >
                        {open ? <XMarkIcon className="w-6 h-6" /> : <Bars3Icon className="w-6 h-6" />}
                    </button>
                </div>
            </nav>

            {open && (
                <ul id="mobile-nav" className="md:hidden border-t border-white/10 bg-navy px-4 py-3 space-y-1">
                    {links.map(({ href, label }) => (
                        <li key={href}>
                            <Link
                                href={href}
                                onClick={closeMenu}
                                aria-current={isActive(href) ? 'page' : undefined}
                                className={`block rounded-lg px-3 py-2 ${isActive(href)
                                    ? 'bg-white/10 text-kesri font-semibold'
                                    : 'text-slate-200 hover:bg-white/5'}`}
                            >
                                {label}
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </header>
    );
}
