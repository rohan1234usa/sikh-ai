import ShabadHeader from '@/app/components/shabad/ShabadHeader';
import LegacyAngLink from '@/app/components/shabad/LegacyAngLink';
import VerseResults from '@/app/components/shabad/VerseResults';
import { getServerT } from '@/lib/i18n/server';

// Shabad Search: the box opens an Ang's own page (./[ang]/page.tsx), or
// searches for a verse and lists the shabads it's in (?q=…), each opening
// its own page (./s/[shabadId]/page.tsx). The page itself is static; the
// search runs in the browser, through /api/shabad/search.
export default async function ShabadSearchPage() {
  const { t } = await getServerT();
  return (
    <main className="flex-1 flex flex-col">
      <LegacyAngLink />
      <ShabadHeader t={t} page="search" />
      <VerseResults />
    </main>
  );
}
