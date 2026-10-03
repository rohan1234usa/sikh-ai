// What a hosting form's server page hands the form (app/components/seva/
// EventForm.tsx): its words, the countries named in the page's language, and
// the addresses it leads to. SERVER-ONLY in use: it reads the page's copy.

import type { Lang } from '@/lib/i18n/config';
import { localePath } from '@/lib/i18n/paths';
import type { SevaCopy } from '@/lib/i18n/seva';
import { CREATE_HREF, SEVA_HREF } from './config';
import { COMMON_COUNTRIES, sortedCountries } from './countries';

export function formProps(lang: Lang, copy: SevaCopy) {
    return {
        lang,
        copy: copy.form,
        categories: copy.common.categories,
        optional: copy.common.optional,
        newTab: copy.common.newTab,
        whenWords: copy.common.when,
        countries: sortedCountries(lang),
        commonCountries: COMMON_COUNTRIES,
        hrefs: {
            board: localePath(lang, SEVA_HREF),
            eventBase: localePath(lang, `${SEVA_HREF}/`),
            create: localePath(lang, CREATE_HREF),
            privacy: localePath(lang, '/privacy'),
        },
    };
}
