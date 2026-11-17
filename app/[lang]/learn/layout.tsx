import { LearnCopyProvider } from '@/app/components/learn/LearnCopy';
import { getLearnCopy } from '@/lib/i18n/learn';
import { getLang } from '@/lib/i18n/server';

// Every Learn page gets Learn's words in its language, and no other page
// does: they live apart from the dictionaries (lib/i18n/learn/en.ts).
export default async function LearnLayout({ children }: LayoutProps<'/[lang]/learn'>) {
  const learn = getLearnCopy(await getLang());
  return <LearnCopyProvider copy={learn}>{children}</LearnCopyProvider>;
}
