import type { Metadata } from 'next';
import { getServerT } from '@/lib/i18n/server';
import { NotFoundContent } from './components/StatusPage';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerT();
  return { title: t.meta.notFoundTitle };
}

// Replaces Next's built-in 404, which paints its own white body (black under
// a dark OS preference) and so ignored the site's theme. The copy renders on
// the client so a language switch updates it in place: on a 404 URL the
// router.refresh() behind that switch can't succeed, and with a #fragment in
// the URL Next's fallback doesn't reload the page either.
export default function NotFound() {
  return <NotFoundContent />;
}
