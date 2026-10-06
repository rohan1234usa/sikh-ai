'use client';

import { createContext, useContext } from 'react';
import { MINE_CHIP } from './styles';

// On a board card, for the one signed in: "You're hosting" or "You've
// joined". SevaBoard gives each card its word through MyPart, from what
// "Your seva" read, once the page is in the browser: the cached page stays
// the same for everyone, and each card carries no more than this empty chip.
export const MyPart = createContext<string | null>(null);

export default function MyPartChip() {
    const label = useContext(MyPart);
    return label ? <span className={MINE_CHIP}>{label}</span> : null;
}
