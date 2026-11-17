// The /learn page as it is built, before this browser's progress is read:
// the hero, and the hub with its placeholder, its cells' order lines and its
// foot. What depends on progress waits for it (effects don't run here).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import LearnHero from '@/app/components/learn/LearnHero';
import LearnHub from '@/app/components/learn/LearnHub';
import ReviewSlot from '@/app/components/learn/ReviewSlot';
import { LANGS } from '@/lib/i18n/config';
import { getLearnCopy } from '@/lib/i18n/learn';
import { LESSON_META, TRACK_IDS, lessonPath } from '@/lib/learn/config';
import { VOCAB, getLessonPace } from '@/lib/learn/curriculum';
import { renderLearnIn } from '../helpers/markup';

const learn = getLearnCopy('en');

const hub = () => renderLearnIn('en', createElement(LearnHub, {
    lessons: LESSON_META.map((meta) => ({ slug: meta.slug, track: meta.track, title: meta.title, href: lessonPath(meta), pace: getLessonPace(meta.slug) })),
    wordIds: Object.values(VOCAB).flatMap((words) => words.map((word) => word.id)),
    tracks: TRACK_IDS.map((id) => ({ id, href: `/learn/${id}` })),
    reviewHref: '/learn/review',
}));

test('the caveat has left the hero', () => {
    const html = renderToStaticMarkup(createElement(LearnHero, { learn }));
    assert.ok(html.includes(learn.subtitle));
    assert.ok(!html.includes(learn.caveat));
});

test('the hub as built: the Today panel held, every cell placed, and the foot with the caveat', () => {
    const html = hub();
    assert.match(html, /animate-pulse/, 'the Today panel\'s place is held');
    for (const line of Object.values(learn.hub.order.default)) assert.ok(html.includes(line), line);
    const foot = html.slice(html.indexOf('<footer'));
    assert.ok(foot.includes(learn.hub.aboutProgress));
    assert.ok(foot.includes(learn.hub.savedHere));
    assert.match(foot, /<a [^>]*href="\/privacy#browser"[^>]*>Privacy<\/a>/);
    assert.ok(foot.includes(learn.caveat), 'the caveat at the foot');
    assert.ok(!html.includes(learn.hub.reset), 'Reset waits for progress to be read');
    assert.ok(!html.includes(learn.hub.milestones.script), 'so do the milestones');
});

test('the review slot holds its room before progress is read, says when nothing is due, then offers the review', () => {
    const slot = (due: number | null) => renderLearnIn('en', createElement(ReviewSlot, { href: '/learn/review', due }));
    const before = slot(null);
    assert.match(before, /min-h-11/, 'its room is held');
    assert.ok(!before.includes('<a') && !before.includes('<p'), 'and empty');
    assert.ok(slot(0).includes(learn.review.noneDue));
    assert.match(slot(1), /<a [^>]*href="\/learn\/review"[^>]*>Review 1 card due/);
    assert.ok(slot(12).includes('Review 12 cards due'));
});

test("each language's Learn words reach its pages through the provider", () => {
    // The provider picks them from the page's language (LearnCopy.tsx).
    for (const lang of LANGS) {
        const html = renderLearnIn(lang, createElement(ReviewSlot, { href: '/learn/review', due: 0 }));
        assert.ok(html.includes(getLearnCopy(lang).review.noneDue), lang);
        for (const other of LANGS.filter((l) => l !== lang)) assert.ok(!html.includes(getLearnCopy(other).review.noneDue), `${lang} shows ${other}`);
    }
});
