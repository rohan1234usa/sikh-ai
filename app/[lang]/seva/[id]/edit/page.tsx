import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Breadcrumbs from '@/app/components/Breadcrumbs';
import EventForm from '@/app/components/seva/EventForm';
import { localePath } from '@/lib/i18n/paths';
import { getSevaCopy } from '@/lib/i18n/seva';
import { getServerT } from '@/lib/i18n/server';
import { eventHref, isEventId } from '@/lib/seva/config';
import { formProps } from '@/lib/seva/formProps';

// Editing an event, for its host: the form loads the event in the browser,
// signed in, and checks it's theirs (the rules check it again).
export async function generateMetadata(): Promise<Metadata> {
  const { lang } = await getServerT();
  const copy = getSevaCopy(lang);
  return { title: copy.meta.editTitle, robots: { index: false, follow: true }, alternates: { canonical: null } };
}

export default async function EditEventPage({ params }: PageProps<'/[lang]/seva/[id]/edit'>) {
  const { lang } = await getServerT();
  const { id } = await params;
  const to = (path: string) => localePath(lang, path);
  if (!isEventId(id)) redirect(to('/seva'));
  const copy = getSevaCopy(lang);
  return (
    <main className="flex-1">
      <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
        <Breadcrumbs
          label={copy.common.breadcrumbAria}
          crumbs={[{ href: to('/seva'), label: copy.board.title }, { href: to(eventHref(id)), label: copy.host.heading }]}
        />
        <h1 className="mt-3 text-3xl font-bold text-ink">{copy.form.editTitle}</h1>
        <EventForm mode="edit" eventId={id} {...formProps(lang, copy)} />
      </div>
    </main>
  );
}
