'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from './ThemeToggle';

const LINKS = [
    { href: '/about', label: 'About' },
    { href: '/hukamnama', label: 'Hukamnama' },
    { href: '/chat', label: 'Ask SikhAI' },
    { href: '/seva', label: 'Seva Events' },
    { href: '/shabad', label: 'Shabad Search' },
];

export default function Navbar() {
    const { user, signIn, logOut } = useAuth();
    const pathname = usePathname();
    const [open, setOpen] = useState(false);
    const closeMenu = () => setOpen(false);

    const isActive = (href: string) =>
        pathname === href || pathname.startsWith(href + '/');

    return (
        <header className="sticky top-0 z-50 bg-navy text-white shadow-md dark:border-b dark:border-white/10">
            <nav aria-label="Main" className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
                <Link href="/" onClick={closeMenu} className="flex items-center gap-2 text-xl font-bold tracking-wide">
                    <span className="font-gurmukhi text-kesri" aria-hidden="true">ੴ</span> SikhAI
                </Link>

                <ul className="hidden md:flex items-center gap-6 text-sm font-medium">
                    {LINKS.map(({ href, label }) => (
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
                    <ThemeToggle />
                    {user ? (
                        <div className="flex items-center gap-3">
                            <span className="hidden lg:inline text-sm text-slate-300">
                                Sat Sri Akal, {user.displayName?.split(' ')[0]}
                            </span>
                            <button
                                onClick={logOut}
                                className="border border-kesri text-kesri text-sm font-semibold px-3 py-1.5 rounded-lg hover:bg-kesri hover:text-navy transition-colors"
                            >
                                Sign Out
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={signIn}
                            className="bg-kesri text-navy text-sm font-semibold px-3 py-1.5 rounded-lg hover:bg-kesri-hover transition-colors"
                        >
                            Sign In
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => setOpen(o => !o)}
                        aria-expanded={open}
                        aria-controls="mobile-nav"
                        aria-label="Toggle navigation menu"
                        className="md:hidden p-2 -mr-2"
                    >
                        {open ? <XMarkIcon className="w-6 h-6" /> : <Bars3Icon className="w-6 h-6" />}
                    </button>
                </div>
            </nav>

            {open && (
                <ul id="mobile-nav" className="md:hidden border-t border-white/10 bg-navy px-4 py-3 space-y-1">
                    {LINKS.map(({ href, label }) => (
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
