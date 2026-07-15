// Tiny {placeholder} interpolation for dictionary strings. Unknown
// placeholders pass through unchanged, so a translation typo degrades
// visibly instead of crashing.

export function fmt(template: string, vars: Record<string, string | number> = {}): string {
    return template.replace(/\{(\w+)\}/g, (match, key) => (key in vars ? String(vars[key]) : match));
}
