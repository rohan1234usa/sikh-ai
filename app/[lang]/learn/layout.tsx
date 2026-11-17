import { LearnCopyProvider } from '@/app/components/learn/LearnCopy';

// Learn's words, for every Learn page's client components, from a script that
// only Learn's pages load (app/components/learn/LearnCopy.tsx says why).
export default function LearnLayout({ children }: LayoutProps<'/[lang]/learn'>) {
  return <LearnCopyProvider>{children}</LearnCopyProvider>;
}
