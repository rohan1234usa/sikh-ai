'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { ComputerDesktopIcon, MoonIcon, SunIcon } from '@heroicons/react/24/outline';
import {
    applyTheme, DARK_QUERY, DEFAULT_THEME, parseTheme,
    THEMES, THEME_STORAGE_KEY, type Theme,
} from '@/lib/theme';
import { useT } from '../context/LanguageContext';
import SettingMenu, { type IconComponent } from './SettingMenu';

const ICONS: Record<Theme, IconComponent> = {
    light: SunIcon,
    dark: MoonIcon,
    system: ComputerDesktopIcon,
};

// The trigger shows the current choice, but the server can't know it (it's in
// localStorage), so picking the icon in React meant System's icon on every
// full load until hydration swapped it. Instead all three are rendered and CSS
// shows the one matching <html data-theme>, which the pre-paint script sets
// before the first frame. No data-theme at all means System, the default.
function ThemeIcon({ className = '' }: { className?: string }) {
    return (
        <>
            <SunIcon className={`${className} hidden theme-light:block`} />
            <MoonIcon className={`${className} hidden theme-dark:block`} />
            <ComputerDesktopIcon className={`${className} theme-light:hidden theme-dark:hidden`} />
        </>
    );
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

    // Under `system` the OS can change its mind while the page is open — at
    // sunset, or when the user flips it in another window. The handler re-reads
    // the live choice rather than trusting `theme`: during hydration `theme` is
    // the server's System for everyone, so this can briefly be attached for a
    // Light or Dark user, and must not overwrite their pick if the OS moves.
    useEffect(() => {
        if (theme !== 'system') return;
        const query = window.matchMedia(DARK_QUERY);
        const onChange = () => { if (getTheme() === 'system') applyTheme('system'); };
        query.addEventListener('change', onChange);
        return () => query.removeEventListener('change', onChange);
    }, [theme]);

    // A pick made in another tab. The browser fires `storage` only in the
    // OTHER tabs, so without this they keep the old theme until reloaded. A
    // null key means storage was cleared, which reads as the default.
    useEffect(() => {
        const onStorage = (e: StorageEvent) => {
            if (e.key !== null && e.key !== THEME_STORAGE_KEY) return;
            applyTheme(parseTheme(e.newValue));
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, []);

    const select = (next: Theme) => {
        applyTheme(next);
        try { localStorage.setItem(THEME_STORAGE_KEY, next); } catch { /* storage blocked — holds for this page */ }
    };

    return (
        <SettingMenu
            label={t.nav.changeTheme}
            icon={ThemeIcon}
            value={theme}
            options={THEMES.map((id) => ({ id, label: t.nav.themes[id], icon: ICONS[id] }))}
            onSelect={select}
        />
    );
}
