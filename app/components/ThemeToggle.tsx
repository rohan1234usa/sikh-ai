'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { ComputerDesktopIcon, MoonIcon, SunIcon } from '@heroicons/react/24/outline';
import { DEFAULT_THEME, parseTheme, setTheme, THEMES, watchTheme, type Theme } from '@/lib/theme';
import { useT } from '../context/LanguageContext';
import SettingMenu, { type IconComponent } from './SettingMenu';

const ICONS: Record<Theme, IconComponent> = {
    light: SunIcon,
    dark: MoonIcon,
    system: ComputerDesktopIcon,
};

// The trigger shows the current choice, but the server can't know it (it's in
// localStorage), so choosing in React meant System's icon and name on every
// full load until hydration. Instead each choice's icon and name are rendered
// and CSS shows the one matching <html data-theme>, which the pre-paint script
// sets before the first frame. No data-theme at all means System, the default.
const SHOW: Record<Theme, string> = {
    light: 'hidden in-data-[theme=light]:block',
    dark: 'hidden in-data-[theme=dark]:block',
    system: 'in-data-[theme=light]:hidden in-data-[theme=dark]:hidden',
};

function ThemeIcon({ className = '' }: { className?: string }) {
    return THEMES.map((id) => {
        const Icon = ICONS[id];
        return <Icon key={id} className={`${className} ${SHOW[id]}`} />;
    });
}

// The <html data-theme> attribute is the source of truth (set pre-paint by the
// inline script in layout.tsx). Subscribing via MutationObserver keeps the
// picker correct no matter what changes the attribute.
function subscribe(onChange: () => void) {
    const observer = new MutationObserver(onChange);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
}

const getTheme = (): Theme => parseTheme(document.documentElement.dataset.theme);
const serverSnapshot = (): Theme => DEFAULT_THEME; // corrected right after hydration

export default function ThemeToggle() {
    const theme = useSyncExternalStore(subscribe, getTheme, serverSnapshot);
    const t = useT();

    // Page-wide, but anchored here because the navbar is on every page.
    useEffect(() => watchTheme(), []);

    return (
        <SettingMenu
            label={t.nav.changeTheme}
            icon={ThemeIcon}
            name={
                <>
                    {t.nav.changeTheme}
                    {THEMES.map((id) => (
                        <span key={id} className={SHOW[id]}> ({t.nav.themes[id]})</span>
                    ))}
                </>
            }
            value={theme}
            options={THEMES.map((id) => ({ id, label: t.nav.themes[id], icon: ICONS[id] }))}
            onSelect={setTheme}
        />
    );
}
