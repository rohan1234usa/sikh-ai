'use client';

import { SparklesIcon } from '@heroicons/react/24/outline';
import {
    LANGUAGE_IDS,
    LENS_IDS,
    MODE_IDS,
    siteDefaultLanguageId,
    type LanguageId,
    type LensId,
    type ModeId,
} from '@/lib/chat/config';
import { useLanguage } from '../../context/LanguageContext';
import { fmt } from '@/lib/i18n/fmt';
import ChatSettingChip from './ChatSettingChip';
import type { ChatPrefs } from './useChatPrefs';

type Props = {
    prefs: ChatPrefs;
    /** False until the stored prefs are read: the chips stay invisible, so the defaults never flash */
    hydrated: boolean;
    onSelectLens: (id: LensId) => void;
    onSelectMode: (id: ModeId) => void;
    onSelectLanguage: (id: LanguageId | null) => void;
};

// The three answer settings, as chips in the chat bar right under the
// question: a change is visibly part of what gets sent, not a setting filed
// away in a dialog. They apply from the next message.
export default function ChatSettingsBar({ prefs, hydrated, onSelectLens, onSelectMode, onSelectLanguage }: Props) {
    const { lang, t } = useLanguage();
    const { lenses, modes, replyLanguages } = t.chat.config;
    // A null pref follows the site language (the Auto option). The chip names
    // the language replies will actually use, and the check stays on Auto.
    const siteLanguage = siteDefaultLanguageId(lang);
    const effectiveLanguage = prefs.languageId ?? siteLanguage;

    return (
        <div
            role="group"
            aria-label={t.chat.answerSettingsAria}
            data-pad
            className={`flex min-w-0 flex-1 flex-wrap items-center gap-1.5 ${hydrated ? '' : 'invisible'}`}
        >
            <ChatSettingChip
                heading={t.chat.perspective}
                note={t.chat.perspectiveNote}
                icon={SparklesIcon}
                value={prefs.lensId}
                options={LENS_IDS.map((id) => ({
                    id,
                    label: lenses[id].name,
                    badge: lenses[id].ordinal,
                    description: lenses[id].tagline,
                }))}
                onSelect={onSelectLens}
            />
            <ChatSettingChip
                heading={t.chat.responseStyle}
                value={prefs.modeId}
                options={MODE_IDS.map((id) => ({ id, label: modes[id].name, description: modes[id].description }))}
                onSelect={onSelectMode}
            />
            <ChatSettingChip<LanguageId | 'auto'>
                heading={t.chat.language}
                value={prefs.languageId ?? 'auto'}
                text={replyLanguages[effectiveLanguage].name}
                options={[
                    {
                        id: 'auto',
                        label: t.chat.autoLanguage,
                        description: fmt(t.chat.autoLanguageNote, { language: replyLanguages[siteLanguage].name }),
                    },
                    ...LANGUAGE_IDS.map((id) => ({
                        id,
                        label: replyLanguages[id].name,
                        description: replyLanguages[id].description,
                    })),
                ]}
                onSelect={(id) => onSelectLanguage(id === 'auto' ? null : id)}
            />
        </div>
    );
}
