import type { Metadata } from 'next';
import { getServerT } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerT();
  return { title: t.meta.translateTitle };
}

export default function TranslateLayout({ children }: { children: React.ReactNode }) {
  return children;
}
