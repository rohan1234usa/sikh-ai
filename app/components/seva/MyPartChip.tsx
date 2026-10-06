'use client';

import { createContext, useContext } from 'react';
import { MINE_CHIP } from './styles';

// On a board card, for the one signed in: "You're hosting" or "You've
// joined". SevaBoard gives each card its word through MyPart, from what
// "Your seva" read, once the page is in the browser: the cached page stays
// the same for everyone. The chip is always there, hidden while it has no
// word, as the title's link names it for its description (EventCard).
export const MyPart = createContext<string | null>(null);

export default function MyPartChip({ id }: { id: string }) {
    const label = useContext(MyPart);
    return <span id={id} hidden={!label} className={MINE_CHIP}>{label}</span>;
}
