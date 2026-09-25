import type { Metadata } from 'next';
import { getServerT } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerT();
  // A form to fill in, not a search result. Like a saved chat, it drops the
  // canonical URL it would inherit (/seva), which would contradict noindex.
  return { title: t.meta.sevaCreateTitle, robots: { index: false, follow: true }, alternates: { canonical: null } };
}

export default function CreateSevaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
