import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Shabad Search',
};

export default function ShabadLayout({ children }: { children: React.ReactNode }) {
  return children;
}
