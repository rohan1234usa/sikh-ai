// The whole curriculum, joined: each lesson's metadata (lib/learn/config.ts)
// with its body (lib/learn/content/). Server side only, in practice: pages
// and the tutor route import it, and hand a client component only the lesson
// or topic it shows, so no page ships the rest of the course.

import {
    LESSON_META,
    lessonMeta,
    lessonsFor,
    type Lesson,
    type LessonBody,
    type LessonEntry,
    type LessonSlug,
    type VocabTopicId,
    type VocabWord,
} from './config';
import howGurmukhiWorks from './content/script/01-how-gurmukhi-works';
import rows34 from './content/script/02-rows-3-4-palatal-retroflex';
import rows57 from './content/script/03-rows-5-7-dental-labial-last';
import nuktaAndDigits from './content/script/04-nukta-letters-and-digits';
import vowelSigns1 from './content/script/05-vowel-signs-1-muharni';
import vowelSigns2 from './content/script/06-vowel-signs-2-and-carriers';
import bindiTippiAddak from './content/script/07-bindi-tippi-addak-subjoined';
import tones from './content/script/08-tones';
import readingDrills from './content/script/09-reading-drills';
import sentenceOrder from './content/grammar/01-sentence-order-and-copulas';
import genderNumber from './content/grammar/02-gender-number-and-agreement';
import possession from './content/grammar/03-possession-da-di-de';
import postpositions from './content/grammar/04-postpositions-and-oblique';
import present from './content/grammar/05-present-habitual-and-continuous';
import past from './content/grammar/06-past-and-the-ergative-ne';
import future from './content/grammar/07-future';
import commands from './content/grammar/08-commands-and-requests';
import questions from './content/grammar/09-questions-and-negation';
import honorifics from './content/grammar/10-honorifics-and-respect';
import dativeSubjects from './content/grammar/11-dative-subjects';
import compoundVerbs from './content/grammar/12-compound-verbs-and-modals';
import bodyHealth from './content/vocab/body-health';
import describing from './content/vocab/describing';
import family from './content/vocab/family';
import feelings from './content/vocab/feelings';
import food from './content/vocab/food';
import greetings from './content/vocab/greetings';
import gurdwara from './content/vocab/gurdwara';
import home from './content/vocab/home';
import numbersTime from './content/vocab/numbers-time';
import verbs from './content/vocab/verbs';

// Keyed by slug, so a lesson listed in LESSON_META without a body, or a body
// under a slug that isn't listed, is a compile error.
const BODIES: Record<LessonSlug, LessonBody> = {
    'how-gurmukhi-works': howGurmukhiWorks,
    'rows-3-4-palatal-retroflex': rows34,
    'rows-5-7-dental-labial-last': rows57,
    'nukta-letters-and-digits': nuktaAndDigits,
    'vowel-signs-1-muharni': vowelSigns1,
    'vowel-signs-2-and-carriers': vowelSigns2,
    'bindi-tippi-addak-subjoined': bindiTippiAddak,
    'tones': tones,
    'reading-drills': readingDrills,
    'sentence-order-and-copulas': sentenceOrder,
    'gender-number-and-agreement': genderNumber,
    'possession-da-di-de': possession,
    'postpositions-and-oblique': postpositions,
    'present-habitual-and-continuous': present,
    'past-and-the-ergative-ne': past,
    'future': future,
    'commands-and-requests': commands,
    'questions-and-negation': questions,
    'honorifics-and-respect': honorifics,
    'dative-subjects': dativeSubjects,
    'compound-verbs-and-modals': compoundVerbs,
};

export function getLesson(slug: LessonSlug): Lesson {
    return { ...lessonMeta(slug), ...BODIES[slug] };
}

// A lesson's place in its track, for "Lesson 3 of 9" and the links either side.
export function neighbors(slug: LessonSlug): { prev?: LessonEntry; next?: LessonEntry; index: number; total: number } {
    const track = lessonsFor(lessonMeta(slug).track);
    const index = track.findIndex((meta) => meta.slug === slug);
    return { prev: track[index - 1], next: track[index + 1], index, total: track.length };
}

// Every vocabulary topic's words, in the order its page lists them.
export const VOCAB: Record<VocabTopicId, VocabWord[]> = {
    'family': family,
    'greetings': greetings,
    'gurdwara': gurdwara,
    'food': food,
    'home': home,
    'numbers-time': numbersTime,
    'body-health': bodyHealth,
    'feelings': feelings,
    'describing': describing,
    'verbs': verbs,
};

export { LESSON_META };
