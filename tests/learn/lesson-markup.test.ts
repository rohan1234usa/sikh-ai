// The lesson page's anchors are a contract: the checkpoint tracker
// (LessonProgress), the hub's "Continue", the track list and the outline all
// find a section by sectionAnchor(). These render the server components that
// carry them, for every lesson.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import LessonOutline from '@/app/components/learn/LessonOutline';
import LessonSections from '@/app/components/learn/LessonSections';
import { getDictionary } from '@/lib/i18n';
import { LESSON_META, sectionAnchor } from '@/lib/learn/config';
import { getLesson } from '@/lib/learn/curriculum';
import { lessonPace } from '@/lib/learn/pace';
import { placeHash } from '@/lib/learn/progress';

const t = getDictionary('en');
const LESSONS = LESSON_META.map((meta) => getLesson(meta.slug));

test("every section's heading carries the anchor its checkpoint reopens", () => {
    for (const lesson of LESSONS) {
        const html = renderToStaticMarkup(createElement(LessonSections, { t, sections: lesson.sections }));
        const ids = [...html.matchAll(/<h2[^>]*\sid="([^"]+)"/g)].map((match) => match[1]);
        assert.deepEqual(ids, lesson.sections.map((_, i) => sectionAnchor(i)), lesson.slug);
        lesson.sections.forEach((_, index) => {
            const hash = placeHash({ kind: 'section', index });
            assert.ok(hash === '' || ids.includes(hash.slice(1)), `${lesson.slug}: ${hash}`);
        });
    }
});

test("a lesson's examples are ruled rows with no copy button", () => {
    for (const lesson of LESSONS) {
        const html = renderToStaticMarkup(createElement(LessonSections, { t, sections: lesson.sections }));
        assert.doesNotMatch(html, /<button/, lesson.slug);
        const rows = lesson.sections.reduce((n, section) => n + (section.examples?.length ?? 0), 0);
        assert.equal(html.split('<li class="border-b border-edge py-3">').length - 1, rows, lesson.slug);
    }
});

test('the outline links every section, with its time, and is closed on a phone', () => {
    for (const lesson of LESSONS) {
        const pace = lessonPace(lesson);
        const html = renderToStaticMarkup(createElement(LessonOutline, { t, headings: lesson.sections.map((s) => s.heading), pace }));
        const hrefs = new Set([...html.matchAll(/href="#([^"]+)"/g)].map((match) => match[1]));
        assert.deepEqual([...hrefs], lesson.sections.map((_, i) => sectionAnchor(i)), lesson.slug);
        assert.match(html, /<details class="[^"]*"><summary/, `${lesson.slug}: the phone's outline starts closed`);
    }
    const first = LESSONS[0];
    const html = renderToStaticMarkup(createElement(LessonOutline, { t, headings: first.sections.map((s) => s.heading), pace: lessonPace(first) }));
    assert.match(html, /4 sections · about 6 min/);
});
