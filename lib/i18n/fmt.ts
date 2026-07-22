// Tiny {placeholder} interpolation for dictionary strings. Unknown
// placeholders pass through unchanged, so a translation typo degrades
// visibly instead of crashing.

export function fmt(template: string, vars: Record<string, string | number> = {}): string {
    return template.replace(/\{(\w+)\}/g, (match, key) => (key in vars ? String(vars[key]) : match));
}

// Same pattern as above, exposed so tooling (scripts/i18n-audit) checks for
// exactly the placeholders fmt() will substitute rather than an approximation.
// A function, not a shared regex: a global RegExp carries lastIndex state that
// is easy to trip over across modules. Sorted so callers can compare directly.
export function extractPlaceholders(value: string): string[] {
    return (value.match(/\{\w+\}/g) ?? []).sort();
}
