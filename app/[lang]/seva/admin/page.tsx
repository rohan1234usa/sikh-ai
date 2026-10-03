import type { Metadata } from 'next';
import Breadcrumbs from '@/app/components/Breadcrumbs';
import AdminReview from '@/app/components/seva/AdminReview';
import { localePath } from '@/lib/i18n/paths';
import { getSevaCopy } from '@/lib/i18n/seva';
import { getServerT } from '@/lib/i18n/server';

// Moderation, for the site's admins (admins/{uid}, made in the Firebase
// console). The page is the same for everyone; who may see the reports is the
// rules' to say, and the browser asks.
export async function generateMetadata(): Promise<Metadata> {
  const { lang } = await getServerT();
  const copy = getSevaCopy(lang);
  return { title: copy.meta.adminTitle, robots: { index: false, follow: false }, alternates: { canonical: null } };
}

export default async function SevaAdminPage() {
  const { lang } = await getServerT();
  const copy = getSevaCopy(lang);
  const to = (path: string) => localePath(lang, path);
  return (
    <main className="flex-1">
      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
        <Breadcrumbs label={copy.common.breadcrumbAria} crumbs={[{ href: to('/seva'), label: copy.board.title }]} />
        <h1 className="mt-3 text-3xl font-bold text-ink">{copy.admin.title}</h1>
        <AdminReview
          lang={lang}
          copy={copy.admin}
          reasons={copy.report.reasons}
          hostedBy={copy.common.hostedBy}
          retry={copy.common.retry}
          eventBase={to('/seva/')}
        />
      </div>
    </main>
  );
}
