'use client';

import { memo } from 'react';
import { SpeakerWaveIcon, StopCircleIcon } from '@heroicons/react/24/outline';
import { ERROR_TURN, TURN_LABEL, Waiting } from '@/app/components/chat/turns';
import { tukkClasses } from '@/app/components/gurbani/Tukk';
import { useT } from '@/app/context/LanguageContext';
import { fmt } from '@/lib/i18n/fmt';
import type { TalkCopy } from '@/lib/i18n/talk';
import { LIVE_FIELDS, type LiveField, type LiveLines } from '@/lib/translate/live';
import type { Exchange, SpeakErrorCode } from '@/lib/translate/talk';
import { rolesOf, speechReady, type SpeechPlan } from '@/lib/translate/voice';
import CopyButton from './CopyButton';

// One clip and its reply on the Talk page: what was heard, small, then the
// translation, large, which is what the other person reads. Each line says
// its language, so a screen reader reads Gurmukhi as Punjabi.

const LANG: Record<LiveField, string> = { gurmukhi: 'pa', roman: 'pa-Latn', english: 'en' };

const HEARD: Record<LiveField, string> = {
    gurmukhi: 'font-gurmukhi text-xl leading-relaxed text-ink-muted',
    roman: 'font-sans text-base text-ink-muted',
    english: 'font-sans text-lg text-ink-muted',
};

const SAID: Record<LiveField, string> = {
    gurmukhi: tukkClasses('page', 'learn').gurmukhi,
    roman: 'font-sans text-lg text-ink',
    english: 'font-sans text-2xl leading-snug text-ink',
};

function Lines({ fields, lines, styles, settled }: {
    fields: readonly LiveField[];
    lines: LiveLines;
    styles: Record<LiveField, string>;
    settled: boolean; // a line missing now will stay missing
}) {
    const t = useT();
    return fields.map(field => {
        const text = lines[field];
        if (text) return <p key={field} lang={LANG[field]} className={styles[field]}>{text}</p>;
        return settled ? <p key={field} className="text-sm italic text-ink-faint">{t.translate.liveMissing}</p> : null;
    });
}

// Memoized, with callbacks that keep their identity (useSpeaker's), so while
// a reply streams only its own card is drawn again.
export default memo(function TalkExchange({ copy: talk, exchange, playing, trouble, onSpeak, onStop }: {
    copy: TalkCopy;
    exchange: Exchange;
    playing: boolean;                 // its translation is being read
    trouble: SpeakErrorCode | null;   // why it couldn't be
    onSpeak: (id: string, plan: SpeechPlan) => void;
    onStop: () => void;
}) {
    const { lines, status } = exchange;
    const settled = status !== 'streaming';

    if (status === 'failed') {
        return (
            <li>
                <p className={ERROR_TURN} role="note">{talk.errors[exchange.error ?? 'translate_voice_failed']}</p>
            </li>
        );
    }

    const roles = rolesOf(lines, exchange.speaker);
    const said = roles?.said ?? LIVE_FIELDS;
    const nothingSaidYet = !said.some(field => lines[field]);
    // Read aloud, and copied: the translation, once it is whole.
    const plan = status === 'done' ? speechReady(lines, exchange.speaker, true) : null;
    const translation = said.map(field => lines[field]).filter(Boolean).join('\n');

    return (
        <li className="space-y-3 border-l-2 border-edge pl-4">
            {roles && (
                <div>
                    <p className={TURN_LABEL}>{fmt(talk.heard, { lang: talk.langs[roles.from] })}</p>
                    <Lines fields={roles.heard} lines={lines} styles={HEARD} settled={settled} />
                </div>
            )}
            <div>
                {roles && <p className={TURN_LABEL}>{fmt(talk.translation, { lang: talk.langs[roles.to] })}</p>}
                {!settled && nothingSaidYet
                    ? <Waiting label={talk.translating} />
                    : <Lines fields={said} lines={lines} styles={SAID} settled={settled} />}
            </div>
            {status === 'cut' && <p className="text-sm italic text-ink-muted">{talk.cut}</p>}
            {settled && (plan || translation) && (
                <div className="flex items-center gap-1">
                    {plan && (
                        <button
                            type="button"
                            onClick={playing ? onStop : () => onSpeak(exchange.id, plan)}
                            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-semibold text-link transition-colors hover:bg-link/10"
                        >
                            {playing
                                ? <StopCircleIcon className="h-5 w-5" aria-hidden="true" />
                                : <SpeakerWaveIcon className="h-5 w-5" aria-hidden="true" />}
                            {playing ? talk.stopReading : talk.readAloud}
                        </button>
                    )}
                    {translation && <CopyButton text={translation} ariaLabel={talk.copyTranslation} />}
                    {trouble && <span className="text-xs text-red-700 dark:text-red-400">{talk.errors[trouble]}</span>}
                </div>
            )}
        </li>
    );
});
