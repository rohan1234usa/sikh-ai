'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useT } from './context/LanguageContext';
import { PRIMARY_BUTTON, StatusPage } from './components/StatusPage';

// Catches a render error in any page and shows it inside the root layout, so
// the navbar, the theme and the language all survive. Without it Next's
// default error page replaces the whole layout with English text on a bare,
// unthemed page. (An error in the root layout itself would still reach Next's
// global error page; that needs an app/global-error.tsx.)
export default function ErrorPage({ error, reset }: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useT();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StatusPage heading={t.errorPage.heading} body={t.errorPage.body}>
      <button type="button" onClick={reset} className={PRIMARY_BUTTON}>
        {t.errorPage.retry}
      </button>
      <Link href="/" className="text-sm font-semibold text-accent-text hover:underline">
        {t.notFound.home}
      </Link>
    </StatusPage>
  );
}
