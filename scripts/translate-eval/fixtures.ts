// Eval inputs, drawn from the curated phrasebook. Only the Punjabi renditions
// are used as input: the phrasebook's English is a functional gloss ("Father's
// younger brother", "Okay / I see / really?"), not something a learner would
// type, and English → Punjabi has many correct answers to score against anyway.
// Punjabi input has one: the translator must render the source itself in the
// other script, which is exactly what the phrasebook records.

import type { Phrase } from '../../lib/translate/phrasebook';

export type Direction = 'gurmukhi' | 'roman';

export type Fixture = {
    key: string; // `${phrase.id}:${direction}`
    phrase: Phrase;
    direction: Direction; // the script the input is written in
    input: string;
};

// Round-robin across categories, so a small --limit samples every category
// rather than ten greetings, with the input script alternating. A second pass
// adds each phrase's other script, so raising the limit only ever adds
// fixtures and everything already cached stays in scope.
export function buildFixtures(phrases: Phrase[]): Fixture[] {
    const byCategory = new Map<string, Phrase[]>();
    for (const p of phrases) byCategory.set(p.category, [...(byCategory.get(p.category) ?? []), p]);
    const queues = [...byCategory.values()];
    const ordered: Phrase[] = [];
    for (let i = 0; ordered.length < phrases.length; i++) {
        for (const queue of queues) if (queue[i]) ordered.push(queue[i]);
    }

    const make = (phrase: Phrase, direction: Direction): Fixture => ({
        key: `${phrase.id}:${direction}`,
        phrase,
        direction,
        input: direction === 'gurmukhi' ? phrase.gurmukhi : phrase.roman,
    });
    return [
        ...ordered.map((p, i) => make(p, i % 2 === 0 ? 'gurmukhi' : 'roman')),
        ...ordered.map((p, i) => make(p, i % 2 === 0 ? 'roman' : 'gurmukhi')),
    ];
}
