// What /privacy and /terms fill their {placeholders} with
// (app/components/PolicyPage.tsx). The limits come from the constants the
// code enforces, so the pages can't drift from what happens, and the i18n
// audit holds every language to the same placeholders. tests/site/policy.test.ts
// fails on any placeholder a page doesn't fill.

import { LANG_COOKIE, type Lang } from './i18n/config';
import { localePath } from './i18n/paths';
import type { PolicyDictionary } from './i18n/policy';
import { MAX_ACCOUNT_CHATS, MAX_HISTORY_TURNS, MAX_LOCAL_CHATS } from './chat/config';
import { MAX_TUTOR_HISTORY_TURNS } from './learn/tutor';
import { MAX_TRANSLATE_HISTORY } from './translate/history';
import { CONTACT_EMAIL } from './site';

// The day each page last changed what it says, in any language (not for a
// typo), shown at its top.
export const PRIVACY_UPDATED = '2026-10-03';
export const TERMS_UPDATED = '2026-10-03';

export const POLICY_VARS = {
    maxLocalChats: MAX_LOCAL_CHATS,
    maxAccountChats: MAX_ACCOUNT_CHATS,
    maxTranslations: MAX_TRANSLATE_HISTORY,
    maxEarlierMessages: MAX_HISTORY_TURNS,
    maxTutorMessages: MAX_TUTOR_HISTORY_TURNS,
    langCookie: LANG_COOKIE,
} as const;

// A placeholder that becomes a link: another page of the site (in the reader's
// language), a site elsewhere (in a new tab), or an email address. A site's
// name and a document's title stay as they are in every language.
export type PolicyLink = { href: string; label: string; kind: 'page' | 'site' | 'mail' };

export function policyLinks(lang: Lang, copy: PolicyDictionary): Record<string, PolicyLink> {
    return {
        email: { href: `mailto:${CONTACT_EMAIL}`, label: CONTACT_EMAIL, kind: 'mail' },
        privacy: { href: localePath(lang, '/privacy'), label: copy.privacy.title, kind: 'page' },
        terms: { href: localePath(lang, '/terms'), label: copy.terms.title, kind: 'page' },
        gurbaninow: { href: 'https://gurbaninow.com', label: 'GurbaniNow', kind: 'site' },
        usePolicy: {
            href: 'https://policies.google.com/terms/generative-ai/use-policy',
            label: 'Generative AI Prohibited Use Policy',
            kind: 'site',
        },
    };
}
