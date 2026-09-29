import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, normalize, sep } from 'node:path';
import type { PolicyCopy } from '@/app/components/PolicyPage';
import { LANGS, LANG_COOKIE_MAX_AGE } from '@/lib/i18n/config';
import { formatDay } from '@/lib/i18n/date';
import { getPolicyCopy, type PolicyDictionary } from '@/lib/i18n/policy';
import { extractPlaceholders, splitTemplate } from '@/lib/i18n/fmt';
import { POLICY_VARS, PRIVACY_UPDATED, TERMS_UPDATED, policyLinks } from '@/lib/policy';
import { CONTACT_EMAIL } from '@/lib/site';

// The pages built on app/components/PolicyPage.tsx, and their words.
const PAGES: Record<string, (copy: PolicyDictionary) => PolicyCopy<string>> = {
    privacy: (copy) => copy.privacy,
    terms: (copy) => copy.terms,
};

const names = (s: string) => extractPlaceholders(s).map((p) => p.slice(1, -1));

test('a template splits into its text and its placeholders, in order', () => {
    assert.deepEqual(splitTemplate('plain'), ['plain']);
    assert.deepEqual(splitTemplate('email {email}.'), ['email ', { key: 'email' }, '.']);
    assert.deepEqual(splitTemplate('{a} and {b}'), [{ key: 'a' }, ' and ', { key: 'b' }]);
    assert.deepEqual(splitTemplate('{a}{b}'), [{ key: 'a' }, { key: 'b' }]);
    assert.deepEqual(splitTemplate('{not a placeholder}'), ['{not a placeholder}']);
    assert.deepEqual(splitTemplate(''), []);
});

test('the date at the top is written out in each language', () => {
    assert.equal(formatDay('2026-09-29', 'en'), '29 September 2026');
    assert.equal(formatDay('2026-09-29', 'pa-latn'), '29 September 2026');
    assert.match(formatDay('2026-09-29', 'pa'), /^29 [਀-੿]+ 2026$/, 'the month in Gurmukhi');
    for (const day of [PRIVACY_UPDATED, TERMS_UPDATED])
        assert.equal(new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10), day, `${day} is a real day`);
});

test('every placeholder on a policy page is filled, in every language', () => {
    for (const [page, copyOf] of Object.entries(PAGES)) {
        for (const lang of LANGS) {
            const copy = copyOf(getPolicyCopy(lang));
            const known = new Set([...Object.keys(POLICY_VARS), 'date', ...Object.keys(policyLinks(lang, getPolicyCopy(lang)))]);
            const texts = [copy.updated, ...Object.values(copy.sections).flatMap((s) => s.items)];
            for (const text of texts)
                for (const name of names(text)) assert.ok(known.has(name), `${page} (${lang}): {${name}} in "${text}"`);
            assert.deepEqual(names(copy.updated), ['date'], `${page} (${lang}): the date is in its line`);
            // The title, intro and headings are plain words: the intro is also
            // the page's description in search results and link previews.
            for (const text of [copy.title, copy.intro, ...Object.values(copy.sections).map((s) => s.heading)])
                assert.deepEqual(names(text), [], `${page} (${lang}): "${text}"`);
        }
    }
});

test('every language has the same sections, in the same order, with as many items', () => {
    // The i18n audit checks each English string has its twin, but not that a
    // translation has no extra item.
    for (const [page, copyOf] of Object.entries(PAGES)) {
        const shape = (lang: (typeof LANGS)[number]) =>
            Object.entries(copyOf(getPolicyCopy(lang)).sections).map(([id, s]) => `${id}:${s.items.length}`);
        for (const lang of LANGS) assert.deepEqual(shape(lang), shape('en'), `${page} (${lang})`);
    }
});

test('every figure lib/policy.ts supplies is stated on a page', () => {
    const en = getPolicyCopy('en');
    const used = new Set(Object.values(PAGES).flatMap((copyOf) => {
        const copy = copyOf(en);
        return [copy.updated, ...Object.values(copy.sections).flatMap((s) => s.items)].flatMap(names);
    }));
    for (const name of Object.keys(POLICY_VARS)) assert.ok(used.has(name), name);
});

test('a placeholder is either a figure or a link, never both', () => {
    const links = Object.keys(policyLinks('en', getPolicyCopy('en')));
    for (const name of Object.keys(POLICY_VARS)) assert.ok(!links.includes(name), name);
    assert.ok(!links.includes('date'));
});

test("the pages' words never reach a client component", () => {
    // They live apart from the dictionaries so that only /privacy and /terms
    // ship them. One import from a 'use client' file, or from the dictionaries'
    // index (which every page's client code reads), would put them in every
    // page's script again. Every import is resolved, by alias or relative
    // path, static or dynamic, and the directive may follow comments.
    const policy = join('lib', 'i18n', 'policy');
    const leadingComments = /^(?:\s|\/\/[^\n]*|\/\*[\s\S]*?\*\/)*/;
    const specifiers = /\b(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g;
    const sources = ['app', 'lib'].flatMap((dir) =>
        readdirSync(dir, { recursive: true, encoding: 'utf8' })
            .filter((f) => /\.tsx?$/.test(f))
            .map((f) => join(dir, f)));
    assert.ok(sources.length > 50, 'found the sources');
    let clients = 0;
    for (const file of sources) {
        const src = readFileSync(file, 'utf8');
        const client = /^['"]use client['"]/.test(src.replace(leadingComments, '')) || file === join('lib', 'i18n', 'index.ts');
        if (!client) continue;
        clients++;
        for (const [, spec] of src.matchAll(specifiers)) {
            const target = spec.startsWith('@/') ? normalize(spec.slice(2)) : spec.startsWith('.') ? join(dirname(file), spec) : null;
            assert.ok(target === null || (target !== policy && !target.startsWith(policy + sep)), `${file} imports ${spec}`);
        }
    }
    assert.ok(clients > 20, 'found the client components');
});

test('the figures the pages state in words match the code', () => {
    // "kept for a year": the only one the pages write in words.
    assert.equal(LANG_COOKIE_MAX_AGE, 365 * 24 * 60 * 60);
});

test('the contact address is a real inbox', {
    todo: CONTACT_EMAIL.endsWith('.invalid') && 'set CONTACT_EMAIL in lib/site.ts before the pages go live',
}, () => {
    assert.ok(!CONTACT_EMAIL.endsWith('.invalid'));
    assert.match(CONTACT_EMAIL, /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i);
});
