import type { Dictionary } from '@/lib/i18n';
import { SEARCH_EXAMPLES } from '@/lib/gurbani/query';
import ShabadSearchBox from './ShabadSearchBox';

// The top of /shabad, of every Ang's page and of every shabad's page: the
// title and the search box, filled with the Ang on show.
export default function ShabadHeader({ t, page, ang }: { t: Dictionary; page: 'search' | 'ang' | 'shabad'; ang?: number }) {
    // Word order around the highlighted word differs per language, so split
    // the template on {word} and render the styled span between the halves.
    const [titleBefore, titleAfter] = t.shabad.title.split('{word}');
    // The help text's example is Gurmukhi in every language, so it comes from
    // code rather than the dictionaries.
    const [helpBefore, helpAfter] = t.shabad.helpText.split('{example}');
    // The page's heading on /shabad; elsewhere the Ang or the shabad is.
    const Title = page === 'search' ? 'h1' : 'p';
    return (
        <div className="bg-navy text-white py-12 px-6 flex flex-col items-center">
            <Title className="text-3xl font-bold mb-6 text-center">
                {titleBefore}<span className="text-kesri">{t.shabad.titleWord}</span>{titleAfter}
            </Title>
            <ShabadSearchBox key={ang} initial={ang ? String(ang) : undefined} inline={page === 'search'} />
            <p className="mt-4 max-w-xl text-center text-sm text-slate-300">
                {helpBefore}<span lang="pa" className="font-gurmukhi text-base text-white">{SEARCH_EXAMPLES.letters}</span>{helpAfter}
            </p>
        </div>
    );
}
