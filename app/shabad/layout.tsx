import type { Metadata } from 'next';
import { getServerT } from '@/lib/i18n/server';
import { pageMetadata } from '@/lib/metadata';

export async function generateMetadata(): Promise<Metadata> {
  const { lang, t } = await getServerT();
  return pageMetadata(lang, t, '/shabad', t.meta.shabadTitle);
}

export default function ShabadLayout({ children }: { children: React.ReactNode }) {
  return children;
}
