'use client';

import { useEffect } from 'react';
import { followClearElsewhere } from '@/lib/browserData';
import { onStorageCleared } from '@/lib/storage';

// On every page: when another tab clears this browser (/privacy), this one
// starts again, so nothing it still holds is written back, and what it keeps
// for itself goes too (lib/browserData.ts).
export default function SiteDataGuard() {
    useEffect(() => onStorageCleared(followClearElsewhere), []);
    return null;
}
