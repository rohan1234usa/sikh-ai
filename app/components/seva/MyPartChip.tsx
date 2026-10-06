'use client';

import { useAuth } from '@/app/context/AuthContext';
import { useMyEvents } from './hooks';
import { MINE_CHIP } from './styles';

// On a board card, for the one signed in: that they host this event, or have
// joined it. It comes from what "Your seva" read (useMyEvents), after the
// page, so the cached page stays the same for everyone.
export default function MyPartChip({ eventId, labels }: { eventId: string; labels: { hosting: string; joined: string } }) {
    const { user } = useAuth();
    const mine = useMyEvents();
    if (!user || mine?.uid !== user.uid) return null;
    const label = mine.hosting.has(eventId) ? labels.hosting : mine.joined.has(eventId) ? labels.joined : null;
    if (!label) return null;
    return (
        <span className={MINE_CHIP}>{label}</span>
    );
}
