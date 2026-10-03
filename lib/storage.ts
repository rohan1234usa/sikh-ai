// Browser-only: following one localStorage key while another tab changes it,
// for the choices kept there (the theme, lib/theme.ts; whether visits are
// counted, lib/analytics.ts), and hearing another tab empty it.

// Calls onChange when another tab writes `key`, or clears storage (a null
// key, which reads as the default). The storage event fires only in the tabs
// that didn't write, and for sessionStorage too, hence the storageArea check;
// storage that can't even be compared (blocked) is ignored. Callers re-read
// storage rather than trust e.newValue, which two tabs writing at once can
// leave out of date. Returns a function that stops it.
export function onStorageKey(key: string, onChange: () => void): () => void {
    const onStorage = (e: StorageEvent) => {
        try { if (e.storageArea !== localStorage) return; } catch { return; }
        if (e.key === null || e.key === key) onChange();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
}

// Calls onCleared when another tab empties localStorage at once: only "Clear
// this browser" does (lib/browserData.ts), and nothing else may. Returns a
// function that stops it.
export function onStorageCleared(onCleared: () => void): () => void {
    const onStorage = (e: StorageEvent) => {
        try { if (e.storageArea !== localStorage) return; } catch { return; }
        if (e.key === null) onCleared();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
}
