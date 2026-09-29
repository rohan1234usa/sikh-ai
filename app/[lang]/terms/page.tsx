import type { Metadata } from 'next';
import PolicyPage from '@/app/components/PolicyPage';
import { formatDay } from '@/lib/i18n/date';
import { localePath } from '@/lib/i18n/paths';
import { getServerT } from '@/lib/i18n/server';
import { pageMetadata } from '@/lib/metadata';
import { POLICY_VARS, TERMS_UPDATED, policyLinks } from '@/lib/policy';

// The few rules that come with using SikhAI (#19), among them that its AI
// features are for people 18 and over, as Google's terms for Gemini require.
// The words live in the dictionaries (terms), so all three languages say the
// same thing; the owner signs off on them.
export async function generateMetadata(): Promise<Metadata> {
  const { lang, t } = await getServerT();
  return pageMetadata(lang, t, '/terms', t.terms.title, t.terms.intro);
}

export default async function TermsPage() {
  const { lang, t } = await getServerT();
  return (
    <PolicyPage
      copy={t.terms}
      vars={{ ...POLICY_VARS, date: formatDay(TERMS_UPDATED, lang) }}
      links={policyLinks(lang, t)}
      related={[
        { href: localePath(lang, '/privacy'), label: t.privacy.title },
        { href: localePath(lang, '/about'), label: t.meta.aboutTitle },
      ]}
    />
  );
}
