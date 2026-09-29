import type { Metadata } from 'next';
import { getServerT } from '@/lib/i18n/server';
import { pageMetadata } from '@/lib/metadata';

export async function generateMetadata(): Promise<Metadata> {
  const { lang, t } = await getServerT();
  return pageMetadata(lang, t, '/seva', t.meta.sevaTitle, t.meta.descriptions.seva);
}

export default function SevaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
