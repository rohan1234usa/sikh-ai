'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useT } from './context/LanguageContext';
import { PRIMARY_BUTTON, StatusPage } from './components/StatusPage';

// Catches a render error in any page and shows it inside the root layout, so
// the navbar, the theme and the language all survive. Without it Next's
// default error page replaces the whole layout with English text on a bare,
// unthemed page. An error in the root layout itself is app/global-error.tsx's.
export default function ErrorPage({ error, retry }: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const t = useT();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StatusPage heading={t.errorPage.heading} body={t.errorPage.body}>
      {/* retry() fetches the page's server content again, so a passing
          failure (a slow source, a network blip) can actually recover;
          reset() would only re-render what already failed. */}
      <button type="button" onClick={() => retry()} className={PRIMARY_BUTTON}>
        {t.errorPage.retry}
      </button>
      <Link href="/" className="text-sm font-semibold text-accent-text hover:underline">
        {t.notFound.home}
      </Link>
    </StatusPage>
  );
}
