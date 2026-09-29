import ShabadHeader from '@/app/components/shabad/ShabadHeader';
import LegacyAngLink from '@/app/components/shabad/LegacyAngLink';
import { getServerT } from '@/lib/i18n/server';

// Ang search: the box opens the Ang's own page (./[ang]/page.tsx), which is
// what search engines and shared links find.
export default async function ShabadSearchPage() {
  const { t } = await getServerT();
  return (
    <main className="flex-1 flex flex-col">
      <LegacyAngLink />
      <ShabadHeader t={t} />
    </main>
  );
}
