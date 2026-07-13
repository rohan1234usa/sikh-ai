import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Post a Seva Event',
};

export default function CreateSevaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
