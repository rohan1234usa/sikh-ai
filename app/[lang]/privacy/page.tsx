import type { Metadata } from 'next';
import AnalyticsSwitch from '@/app/components/AnalyticsSwitch';
import PolicyPage from '@/app/components/PolicyPage';
import { formatDay } from '@/lib/i18n/date';
import { localePath } from '@/lib/i18n/paths';
import { getServerT } from '@/lib/i18n/server';
import { pageMetadata } from '@/lib/metadata';
import { POLICY_VARS, PRIVACY_UPDATED, policyLinks } from '@/lib/policy';

// What the site keeps, where, for how long, what it sends to which service,
// how it counts visits, and how to remove it (#19). The words live in the
// dictionaries (privacy), so all three languages say the same thing, and the
// limits they state come from the code (lib/policy.ts); the owner signs off
// on them. The switch under "Counting visits" (#analytics) turns counting off
// for this browser.
export async function generateMetadata(): Promise<Metadata> {
  const { lang, t } = await getServerT();
  return pageMetadata(lang, t, '/privacy', t.privacy.title, t.privacy.intro);
}

export default async function PrivacyPage() {
  const { lang, t } = await getServerT();
  return (
    <PolicyPage
      copy={t.privacy}
      vars={{ ...POLICY_VARS, date: formatDay(PRIVACY_UPDATED, lang) }}
      links={policyLinks(lang, t)}
      after={{ analytics: <AnalyticsSwitch /> }}
      related={[
        { href: localePath(lang, '/terms'), label: t.terms.title },
        { href: localePath(lang, '/about'), label: t.meta.aboutTitle },
      ]}
    />
  );
}
