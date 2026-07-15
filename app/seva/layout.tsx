import type { Metadata } from 'next';
import { getServerT } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerT();
  return {
    // Redeclares the template because a plain string title here would stop
    // the root template from reaching /seva/create
    title: { default: t.meta.sevaTitle, template: t.meta.titleTemplate },
  };
}

export default function SevaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
