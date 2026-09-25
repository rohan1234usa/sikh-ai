import type { Metadata } from 'next';
import { getServerT } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerT();
  // A form to fill in, not a search result.
  return { title: t.meta.sevaCreateTitle, robots: { index: false, follow: true } };
}

export default function CreateSevaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
