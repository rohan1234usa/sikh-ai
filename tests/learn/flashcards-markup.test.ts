// A flashcard session as the server would draw it: the session is built in
// its first render (the queue from the schedule), so what it starts on can be
// read from the markup. Effects don't run here, so nothing after the first
// render (answers, the clock moving) is.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement, type ComponentProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Flashcards from '@/app/components/learn/Flashcards';
import { LanguageProvider } from '@/app/context/LanguageContext';
import type { FlashcardWord } from '@/lib/learn/config';
import { DAY_MS, type CardState } from '@/lib/learn/srs';

const NOW = Date.UTC(2026, 9, 24, 20, 0);

// ਖਾਣਾ twice, as in the vocabulary: food in one topic, to eat in another.
const WORDS: FlashcardWord[] = [
    { id: 'family-chacha', topic: 'family', gurmukhi: 'ਚਾਚਾ', roman: 'chacha', english: 'uncle (father’s younger brother)' },
    { id: 'food-khana', topic: 'food', gurmukhi: 'ਖਾਣਾ', roman: 'khana', english: 'food; a meal' },
    { id: 'verbs-khana', topic: 'verbs', gurmukhi: 'ਖਾਣਾ', roman: 'khana', english: 'to eat' },
];

const card = (box: number, due: number): CardState => ({ box, due, reviews: 1, lastAt: NOW - DAY_MS });

// family-chacha is due in box 2, verbs-khana in box 0; food-khana was never seen.
const DUE: Record<string, CardState> = { 'family-chacha': card(2, NOW - 10), 'verbs-khana': card(0, NOW - 5) };
const LATER: Record<string, CardState> = Object.fromEntries(WORDS.map((word) => [word.id, card(3, NOW + DAY_MS)]));

const render = (props: ComponentProps<typeof Flashcards>) => renderToStaticMarkup(createElement(
    LanguageProvider,
    // The child goes as an argument, which the props' type doesn't know.
    { lang: 'en' } as ComponentProps<typeof LanguageProvider>,
    createElement(Flashcards, props),
));

const base = { words: WORDS, now: NOW, onReview: () => {} };

test('a review starts on the lowest box, names the card\'s topic, and brings in no new word', () => {
    const html = render({ ...base, cards: DUE, mode: 'review', topicsHref: '/learn/vocab' });
    assert.ok(html.includes('Card 1 of 2'), 'the two due cards, not the new one');
    assert.ok(html.includes('Everyday verbs'), 'box 0 first: to eat');
    assert.ok(html.indexOf('Everyday verbs') < html.indexOf('ਖਾਣਾ'), 'the topic heads the card');
    assert.ok(!html.includes('Food and the kitchen'), 'the word never seen stays in its topic');
});

test('a topic\'s session takes its due cards, then new ones, and names no topic', () => {
    const html = render({ ...base, cards: DUE });
    assert.ok(html.includes('Card 1 of 3'));
    assert.ok(!html.includes('Everyday verbs'));
});

test('with nothing due, a review says so for every topic and points to the topics, not to practice', () => {
    const html = render({ ...base, cards: LATER, mode: 'review', topicsHref: '/learn/vocab' });
    assert.ok(html.includes('Nothing is due from any topic.'));
    // It holds for a learner who has met no card yet as well.
    assert.ok(render({ ...base, cards: {}, mode: 'review', topicsHref: '/learn/vocab' }).includes('Each card comes back here on its day.'));
    assert.ok(html.includes('Check again'));
    assert.match(html, /<a [^>]*href="\/learn\/vocab"[^>]*>Practice a topic instead<\/a>/);
    assert.ok(!html.includes('Practice anyway'));
});

test('with nothing due, a topic offers practice anyway', () => {
    const html = render({ ...base, cards: LATER });
    assert.ok(html.includes('Nothing is due. Every card here is scheduled for later.'));
    assert.ok(html.includes('Practice anyway'));
});
