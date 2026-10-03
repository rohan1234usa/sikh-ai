import type { Metadata } from 'next';
import Breadcrumbs from '@/app/components/Breadcrumbs';
import EventForm from '@/app/components/seva/EventForm';
import { localePath } from '@/lib/i18n/paths';
import { getSevaCopy } from '@/lib/i18n/seva';
import { getServerT } from '@/lib/i18n/server';
import { formProps } from '@/lib/seva/formProps';

// Hosting an event: the page is the same for everyone, and the form is built
// in the browser (app/components/seva/EventForm.tsx). Not for search results.
export async function generateMetadata(): Promise<Metadata> {
  const { lang } = await getServerT();
  const copy = getSevaCopy(lang);
  return { title: copy.meta.createTitle, robots: { index: false, follow: true }, alternates: { canonical: null } };
}

export default async function CreateEventPage() {
  const { lang } = await getServerT();
  const copy = getSevaCopy(lang);
  return (
    <main className="flex-1">
      <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
        <Breadcrumbs label={copy.common.breadcrumbAria} crumbs={[{ href: localePath(lang, '/seva'), label: copy.board.title }]} />
        <h1 className="mt-3 text-3xl font-bold text-ink">{copy.form.createTitle}</h1>
        <p className="mt-2 text-ink-muted">{copy.form.intro}</p>
        <EventForm mode="create" {...formProps(lang, copy)} />
      </div>
    </main>
  );
}
