'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { parseAngInput } from '@/lib/gurbani/ang';
import { useLocalePath } from '../../context/LanguageContext';

// Links from before each Ang had its own page (/shabad?ang=12: old chat
// citations, bookmarks, shared links) open that Ang's page instead.
export default function LegacyAngLink() {
    const router = useRouter();
    const to = useLocalePath();
    useEffect(() => {
        const parsed = parseAngInput(new URLSearchParams(window.location.search).get('ang') ?? '');
        if (parsed.ok) router.replace(to(`/shabad/${parsed.ang}`));
    }, [router, to]);
    return null;
}
