// Server-side language access for server components and generateMetadata.
// Importing next/headers keeps this module server-only.

import { cookies } from 'next/headers';
import { LANG_COOKIE, parseLang, type Lang } from './config';
import { getDictionary, type Dictionary } from './index';

export async function getLang(): Promise<Lang> {
    return parseLang((await cookies()).get(LANG_COOKIE)?.value);
}

export async function getServerT(): Promise<{ lang: Lang; t: Dictionary }> {
    const lang = await getLang();
    return { lang, t: getDictionary(lang) };
}
