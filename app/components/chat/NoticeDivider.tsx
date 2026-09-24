'use client';

import type { Notice } from '@/lib/chat/transcript';
import { useT } from '../../context/LanguageContext';
import { fmt } from '@/lib/i18n/fmt';

// Where the lens changed between two answers. Worded now, in the current site
// language; notices carried over from the old format keep their own words.
// ink-muted, not ink-faint: 11px text needs the stronger contrast in dark mode.
export default function NoticeDivider({ notice }: { notice: Notice }) {
    const t = useT();
    const text = notice.lensId === null
        ? notice.text
        : notice.lensId === 'sikhai'
            ? t.chat.lensSwitchNoticeDefault
            : fmt(t.chat.lensSwitchNotice, { name: t.chat.config.lenses[notice.lensId].name });
    return (
        <div className="flex items-center gap-3 text-ink-muted">
            <span className="h-px flex-1 bg-edge" aria-hidden="true" />
            <span className="text-[11px] uppercase tracking-widest font-bold text-center">{text}</span>
            <span className="h-px flex-1 bg-edge" aria-hidden="true" />
        </div>
    );
}
