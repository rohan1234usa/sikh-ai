'use client';

import Link from 'next/link';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
    const { user, signIn, logOut } = useAuth();

    return (
        <nav className="w-full py-6 px-8 flex justify-between items-center bg-navy text-white">
            <Link href="/" className="text-2xl font-bold tracking-wide flex items-center gap-2 hover:opacity-80 transition">
                <span className="text-kesri">ੴ</span> SikhAI
            </Link>
            <div className="hidden md:flex gap-6 text-sm font-medium">
                <Link href="/about" className="hover:text-kesri transition">About</Link>
                <Link href="/hukamnama" className="hover:text-kesri transition">Hukamnama</Link>
                <Link href="/chat" className="hover:text-kesri transition">Ask SikhAI</Link>
                <Link href="/seva" className="hover:text-kesri transition">Seva Events</Link>
                <Link href="/shabad" className="hover:text-kesri transition">Shabad Search</Link>
            </div>

            {/* DYNAMIC AUTH BUTTON */}
            {user ? (
                <div className="flex items-center gap-4">
                    <span className="text-sm text-slate-300 hidden sm:inline">Sat Sri Akal, {user.displayName?.split(' ')[0]}</span>
                    <button onClick={logOut} className="border border-kesri text-kesri text-sm font-semibold px-4 py-2 rounded-lg hover:bg-kesri hover:text-navy transition-all">
                        Sign Out
                    </button>
                </div>
            ) : (
                <button onClick={signIn} className="bg-kesri text-navy font-semibold px-4 py-2 rounded-lg hover:bg-white hover:text-kesri transition-all">
                    Sign In
                </button>
            )}
        </nav>
    );
}
