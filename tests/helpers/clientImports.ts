// Every import a client component makes: from each 'use client' file, and
// from the dictionaries' index, which every page's client code reads. An
// import of the app's own code is resolved to its path in the repo (by alias
// or relative path); a package's stays as it is. Type-only imports ship
// nothing and are left out.

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';

export type ClientImport = { file: string; spec: string; target: string; dynamic: boolean };

const LEADING_COMMENTS = /^(?:\s|\/\/[^\n]*|\/\*[\s\S]*?\*\/)*/;
const TYPE_ONLY = /^\s*(?:import|export)\s+type\s[^;]*?from\s*['"][^'"]+['"];?/gm;
const TYPEOF_IMPORT = /typeof\s+import\(\s*['"][^'"]+['"]\s*\)/g;
const STATIC = /\b(?:from|import)\s+['"]([^'"]+)['"]/g;
const DYNAMIC = /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g;

export function sourceFiles(dirs = ['app', 'lib']): string[] {
    return dirs.flatMap((dir) =>
        readdirSync(dir, { recursive: true, encoding: 'utf8' })
            .filter((f) => /\.tsx?$/.test(f))
            .map((f) => join(dir, f)));
}

export const isClientFile = (file: string, src = readFileSync(file, 'utf8')) =>
    /^['"]use client['"]/.test(src.replace(LEADING_COMMENTS, '')) || file === join('lib', 'i18n', 'index.ts');

function resolveSpec(file: string, spec: string): string {
    if (spec.startsWith('@/')) return normalize(spec.slice(2));
    if (spec.startsWith('.')) return join(dirname(file), spec);
    return spec;
}

export function importsOf(file: string, src = readFileSync(file, 'utf8')): ClientImport[] {
    const code = src.replace(TYPE_ONLY, '').replace(TYPEOF_IMPORT, '');
    return [
        ...[...code.matchAll(STATIC)].map((m) => ({ file, spec: m[1], target: resolveSpec(file, m[1]), dynamic: false })),
        ...[...code.matchAll(DYNAMIC)].map((m) => ({ file, spec: m[1], target: resolveSpec(file, m[1]), dynamic: true })),
    ];
}

export function clientImports(dirs?: string[]): ClientImport[] {
    return sourceFiles(dirs).flatMap((file) => {
        const src = readFileSync(file, 'utf8');
        return isClientFile(file, src) ? importsOf(file, src) : [];
    });
}

// Whether an import's target is a module or folder, or anything under it.
export const reaches = (target: string, path: string) =>
    target === path || target.startsWith(`${path}/`) || target.replace(/\.tsx?$/, '') === path;
