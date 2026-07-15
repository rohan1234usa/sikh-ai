import type { Metadata } from 'next';
import { getServerT } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerT();
  return { title: t.meta.sevaCreateTitle };
}

export default function CreateSevaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
