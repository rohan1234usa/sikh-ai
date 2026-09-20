'use client';

import { LanguageIcon } from '@heroicons/react/24/outline';
import { LANGS, LANG_META } from '@/lib/i18n/config';
import { useLanguage } from '../context/LanguageContext';
import SettingMenu from './SettingMenu';

// Site-language picker, mounted in the Navbar next to ThemeToggle. Option
// labels are intentionally NOT translated — each language names itself.
export default function LanguageToggle() {
    const { lang, setLang, t } = useLanguage();

    return (
        <SettingMenu
            label={t.nav.changeLanguage}
            icon={LanguageIcon}
            value={lang}
            options={LANGS.map((id) => ({
                id,
                label: LANG_META[id].label,
                lang: LANG_META[id].htmlLang,
                labelClassName: id === 'pa' ? 'font-gurmukhi' : undefined,
            }))}
            // Re-picking the active language would cost a router.refresh() for
            // no change. The cookie is re-set on every real switch, so unlike
            // the theme there is nothing to repair by reasserting it.
            onSelect={(next) => { if (next !== lang) setLang(next); }}
        />
    );
}
