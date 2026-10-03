'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { classifyQuery } from '@/lib/gurbani/query';
import { useLocalePath } from '../../context/LanguageContext';

// Links from before each Ang had its own page (/shabad?ang=12: old chat
// citations, bookmarks, shared links) open that Ang's page instead. The Ang
// is read as the search box reads one.
export default function LegacyAngLink() {
    const router = useRouter();
    const to = useLocalePath();
    useEffect(() => {
        const query = classifyQuery(new URLSearchParams(window.location.search).get('ang') ?? '');
        if (query.kind === 'ang') router.replace(to(`/shabad/${query.ang}`));
    }, [router, to]);
    return null;
}
