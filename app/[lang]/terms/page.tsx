import type { Metadata } from 'next';
import PolicyPage from '@/app/components/PolicyPage';
import { formatDay } from '@/lib/i18n/date';
import { localePath } from '@/lib/i18n/paths';
import { getPolicyCopy } from '@/lib/i18n/policy';
import { getServerT } from '@/lib/i18n/server';
import { pageMetadata } from '@/lib/metadata';
import { POLICY_VARS, TERMS_UPDATED, policyLinks } from '@/lib/policy';

// The few rules that come with using SikhAI (#19), among them that its AI
// features are for people 18 and over, as Google's terms for Gemini require.
// The words live in lib/i18n/policy, so all three languages say the same
// thing and only this page ships them; the owner signs off on them.
export async function generateMetadata(): Promise<Metadata> {
  const { lang, t } = await getServerT();
  const { terms } = getPolicyCopy(lang);
  return pageMetadata(lang, t, '/terms', terms.title, terms.intro);
}

export default async function TermsPage() {
  const { lang, t } = await getServerT();
  const copy = getPolicyCopy(lang);
  return (
    <PolicyPage
      copy={copy.terms}
      vars={{ ...POLICY_VARS, date: formatDay(TERMS_UPDATED, lang) }}
      links={policyLinks(lang, copy)}
      related={[
        { href: localePath(lang, '/privacy'), label: copy.privacy.title },
        { href: localePath(lang, '/about'), label: t.meta.aboutTitle },
      ]}
    />
  );
}
