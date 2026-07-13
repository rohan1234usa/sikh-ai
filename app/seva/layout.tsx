import type { Metadata } from 'next';

export const metadata: Metadata = {
  // Redeclares the template because a plain string title here would stop
  // the root template from reaching /seva/create
  title: { default: 'Seva Events', template: '%s | SikhAI' },
};

export default function SevaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
