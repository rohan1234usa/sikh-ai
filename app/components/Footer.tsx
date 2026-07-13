'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
    { href: '/about', label: 'About' },
    { href: '/hukamnama', label: 'Hukamnama' },
    { href: '/seva', label: 'Seva Events' },
    { href: '/shabad', label: 'Shabad Search' },
];

export default function Footer() {
    const pathname = usePathname();
    // The chat page is a fixed-height app screen with no room for a footer
    if (pathname === '/chat') return null;

    return (
        <footer className="border-t border-edge bg-surface-raised mt-auto">
            <div className="mx-auto max-w-7xl px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-ink-muted">
                <p className="flex items-center gap-2 font-semibold text-ink">
                    <span className="font-gurmukhi text-accent-text" aria-hidden="true">ੴ</span> SikhAI
                </p>
                <nav aria-label="Footer">
                    <ul className="flex flex-wrap justify-center gap-x-5 gap-y-2">
                        {LINKS.map(({ href, label }) => (
                            <li key={href}>
                                <Link href={href} className="hover:text-accent-text transition-colors">
                                    {label}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </nav>
                <p>
                    Built by{' '}
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
