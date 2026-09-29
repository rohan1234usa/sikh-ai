import type { Dictionary } from '@/lib/i18n';
import AngSearch from './AngSearch';

// The top of /shabad and of every Ang page: the title and the search box,
// filled with the Ang on show.
export default function ShabadHeader({ t, ang }: { t: Dictionary; ang?: number }) {
    // Word order around the highlighted word differs per language, so split
    // the template on {ang} and render the styled span between the halves.
    const [titleBefore, titleAfter] = t.shabad.title.split('{ang}');
    // The page's heading on /shabad; on an Ang's page, the Ang is.
    const Title = ang ? 'p' : 'h1';
    return (
        <div className="bg-navy text-white py-12 px-6 flex flex-col items-center">
            <Title className="text-3xl font-bold mb-6 text-center">
                {titleBefore}<span className="text-kesri">{t.shabad.angWord}</span>{titleAfter}
            </Title>
            <AngSearch key={ang} initial={ang} />
            <p className="mt-4 text-sm text-slate-300">{t.shabad.helpText}</p>
        </div>
    );
}
