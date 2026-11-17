// A client component as the server draws it, inside the language provider
// its useT() reads. Effects don't run, so it shows what the page is built
// with, before anything only the browser knows.

import { createElement, type ComponentProps, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LanguageProvider } from '@/app/context/LanguageContext';
import type { Lang } from '@/lib/i18n/config';

export const renderIn = (lang: Lang, element: ReactElement): string =>
    renderToStaticMarkup(createElement(
        LanguageProvider,
        // The child goes as an argument (the lint rule against a children
        // prop), which the props' type doesn't know.
        { lang } as ComponentProps<typeof LanguageProvider>,
        element,
    ));
