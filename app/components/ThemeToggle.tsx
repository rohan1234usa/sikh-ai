'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { ComputerDesktopIcon, MoonIcon, SunIcon } from '@heroicons/react/24/outline';
import {
    applyTheme, DARK_QUERY, DEFAULT_THEME, keepThemeColor, parseTheme,
    THEMES, THEME_STORAGE_KEY, type Theme,
} from '@/lib/theme';
import { useT } from '../context/LanguageContext';
import SettingMenu, { type IconComponent } from './SettingMenu';

const ICONS: Record<Theme, IconComponent> = {
    light: SunIcon,
    dark: MoonIcon,
    system: ComputerDesktopIcon,
};

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

    // Under `system` the OS can change its mind while the page is open — at
    // sunset, or when the user flips it in another window.
    useEffect(() => {
        if (theme !== 'system') return;
        const query = window.matchMedia(DARK_QUERY);
        const onChange = () => applyTheme('system');
        query.addEventListener('change', onChange);
        return () => query.removeEventListener('change', onChange);
    }, [theme]);

    // The browser-chrome colour for an explicit pick lives in a <head> tag
    // React doesn't own, so re-renders of <head> can drop it. Guard it.
    useEffect(() => keepThemeColor(), []);

    const select = (next: Theme) => {
        applyTheme(next);
        try { localStorage.setItem(THEME_STORAGE_KEY, next); } catch { /* storage blocked — holds for this page */ }
    };

    return (
        <SettingMenu
            label={t.nav.changeTheme}
            icon={ICONS[theme]}
            value={theme}
            options={THEMES.map((id) => ({ id, label: t.nav.themes[id], icon: ICONS[id] }))}
            onSelect={select}
        />
    );
}
