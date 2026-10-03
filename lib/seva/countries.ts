// Where an event can be: ISO 3166-1 alpha-2 codes, stored as the code and
// named in the reader's language by Intl (so the list carries no names).
// Places nobody lives (Antarctica and a few islands) are left out; Kosovo's
// XK is the code everyone uses for it.

import type { Lang } from '@/lib/i18n/config';

export const COUNTRY_CODES: readonly string[] = (
    'AD AE AF AG AI AL AM AO AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BW BY BZ ' +
    'CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK ' +
    'FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GT GU GW GY HK HN HR HT HU ID IE IL IM IN IO IQ IR IS ' +
    'IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ' +
    'ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL ' +
    'PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC ' +
    'TD TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW'
).split(' ');

// Listed first in the form: where most of the sangat lives.
export const COMMON_COUNTRIES: readonly string[] = ['IN', 'CA', 'US', 'GB', 'AU', 'NZ', 'MY', 'SG', 'IT', 'AE', 'KE', 'PK'];

const names = new Map<string, Intl.DisplayNames>();

// "Canada", "ਕੈਨੇਡਾ". Romanized Punjabi uses the English names, as it does
// for months.
export function countryName(code: string, lang: Lang): string {
    const locale = lang === 'pa' ? 'pa' : 'en';
    let dn = names.get(locale);
    if (!dn) {
        dn = new Intl.DisplayNames([locale], { type: 'region', fallback: 'code' });
        names.set(locale, dn);
    }
    try {
        return dn.of(code) ?? code;
    } catch {
        return code;
    }
}

// Every country, named and in alphabetical order for the reader.
export function sortedCountries(lang: Lang): { code: string; name: string }[] {
    const collator = new Intl.Collator(lang === 'pa' ? 'pa' : 'en');
    return COUNTRY_CODES.map((code) => ({ code, name: countryName(code, lang) }))
        .sort((a, b) => collator.compare(a.name, b.name));
}
