// Emits report.md: one summary column per model, then every fixture side by
// side, disagreements first. Written for a fluent reviewer — the numbers only
// decide the reading order, the side-by-side decides the model.

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { CachedRun } from './cache';
import type { Fixture } from './fixtures';
import type { Score } from './score';

const REPORT_PATH = resolve(import.meta.dirname, 'report.md');

export type Answer = { run: CachedRun; score: Score };

export type Row = { fixture: Fixture; answers: Map<string, Answer> }; // keyed by model

export type ReportInput = {
    models: string[]; // baseline first
    rows: Row[];
    totalFixtures: number;
    fingerprint: string;
};

function cell(value: string, max = 140): string {
    const flat = value.replace(/\s+/g, ' ').trim();
    const clipped = flat.length > max ? flat.slice(0, max - 1) + '…' : flat;
    return clipped.split('|').join('\\|');
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);

function median(xs: number[]): number {
    if (!xs.length) return NaN;
    const sorted = [...xs].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const fixed = (n: number, digits = 2) => (Number.isNaN(n) ? '—' : n.toFixed(digits));

function summary(models: string[], rows: Row[]): string {
    const lines: [string, (answers: Answer[]) => string][] = [
        ['Fixtures answered', a => `${a.length} / ${rows.length}`],
        ['Usable result', a => `${a.filter(x => x.score.result).length}`],
        ['Truncated (MAX_TOKENS)', a => `${a.filter(x => x.run.finishReason === 'MAX_TOKENS').length}`],
        ['Blocked or empty', a => `${a.filter(x => x.run.blockReason || !x.run.text).length}`],
        ['Input script detected', a => `${a.filter(x => x.score.detectedOk).length}`],
        ['Mean match, converted script', a => fixed(mean(a.flatMap(x => (x.score.converted === null ? [] : [x.score.converted]))))],
        ['Mean match, source kept', a => fixed(mean(a.flatMap(x => (x.score.kept === null ? [] : [x.score.kept]))))],
        ['Answers breaking romanization/script rules', a => `${a.filter(x => x.score.issues.length).length}`],
        ['Mean glosses · notes · tips', a => {
            const ok = a.flatMap(x => (x.score.result ? [x.score.result] : []));
            return `${fixed(mean(ok.map(r => r.words.length)), 1)} · ${fixed(mean(ok.map(r => r.notes.length)), 1)} · ${fixed(mean(ok.map(r => r.pronunciation.length)), 1)}`;
        }],
        ['Median latency', a => `${fixed(median(a.map(x => x.run.latencyMs)) / 1000, 1)} s`],
        // Thinking is billed as output, so it is counted in the total too
        ['Mean output tokens (of which thinking)', a => {
            const metered = a.filter(x => x.run.usage.output !== undefined);
            const thoughts = metered.map(x => x.run.usage.thoughts ?? 0);
            const total = metered.map((x, i) => (x.run.usage.output ?? 0) + thoughts[i]);
            return `${fixed(mean(total), 0)} (${fixed(mean(thoughts), 0)})`;
        }],
        ['Served by', a => [...new Set(a.map(x => x.run.modelVersion ?? '?'))].join(', ') || '—'],
    ];

    const answersFor = (model: string) => rows.flatMap(r => {
        const answer = r.answers.get(model);
        return answer ? [answer] : [];
    });
    const perModel = models.map(answersFor);
    return [
        `| | ${models.map(m => `\`${m}\``).join(' | ')} |`,
        `| --- | ${models.map(() => '---').join(' | ')} |`,
        ...lines.map(([label, fn]) => `| ${label} | ${perModel.map(fn).join(' | ')} |`),
    ].join('\n');
}

function answerCells(answer: Answer | undefined): Record<string, string> {
    if (!answer) return { match: 'not run yet', gurmukhi: '', roman: '', english: '', words: '', notes: '', issues: '' };
    const { run, score } = answer;
    const r = score.result;
    if (!r) {
        const why = run.blockReason ?? run.finishReason ?? 'no text';
        return { match: `unusable (${why})`, gurmukhi: '', roman: '', english: '', words: '', notes: '', issues: '' };
    }
    return {
        match: `${fixed(score.converted ?? NaN)} / ${fixed(score.kept ?? NaN)}${score.detectedOk ? '' : ' · detection missed'}`,
        gurmukhi: r.gurmukhi,
        roman: r.roman,
        english: r.english,
        words: r.words.map(w => `${w.roman} = ${w.meaning}`).join(' · '),
        notes: r.notes.map(n => `${n.kind}: ${n.title}`).join(' · ') || '—',
        issues: score.issues.join(' · ') || '—',
    };
}

// Lowest match across models first: those are where the models disagree with
// the phrasebook — or with each other — and where a reviewer's time goes.
function worstMatch(row: Row, models: string[]): number {
    return Math.min(...models.map(m => {
        const answer = row.answers.get(m);
        if (!answer) return 2; // unanswered sorts last
        return answer.score.converted ?? -1; // unusable sorts first
    }));
}

function fixtureSection(row: Row, models: string[]): string {
    const { fixture } = row;
    const { phrase } = fixture;
    const cells = models.map(m => answerCells(row.answers.get(m)));
    const line = (label: string, key: string) => `| ${label} | ${cells.map(c => cell(c[key])).join(' | ')} |`;
    return [
        `### \`${phrase.id}\` · ${fixture.direction === 'gurmukhi' ? 'Gurmukhi' : 'romanized'} input · ${phrase.category}`,
        '',
        `Input: ${fixture.input} — phrasebook: ${phrase.gurmukhi} · ${phrase.roman} · ${phrase.english}`,
        '',
        `| | ${models.map(m => `\`${m}\``).join(' | ')} |`,
        `| --- | ${models.map(() => '---').join(' | ')} |`,
        line('Match (converted / kept)', 'match'),
        line('Gurmukhi', 'gurmukhi'),
        line('Roman', 'roman'),
        line('English', 'english'),
        line('Words', 'words'),
        line('Notes', 'notes'),
        line('Issues', 'issues'),
        '',
    ].join('\n');
}

export function writeReport(input: ReportInput): string {
    const { models, rows } = input;
    const sorted = [...rows].sort(
        (a, b) => worstMatch(a, models) - worstMatch(b, models) || a.fixture.key.localeCompare(b.fixture.key),
    );
    const body = [
        '# Translator model eval',
        '',
        `Generated by \`npm run eval:translate\` on ${new Date().toISOString().slice(0, 10)} · ` +
        `${rows.length} of ${input.totalFixtures} fixtures in scope · request fingerprint \`${input.fingerprint}\` · ` +
        `baseline \`${models[0]}\``,
        '',
        '> The phrasebook these answers are compared against is AI-drafted and awaiting review by a fluent',
        '> speaker. A low match means the model and the phrasebook disagree — not necessarily that the model',
        '> is wrong. Decide from the side-by-side, not the numbers.',
        '',
        '**Match** is word overlap (0–1). *Converted* compares the script the model had to produce against the',
        'phrasebook (romanization for Gurmukhi input, Gurmukhi for romanized input). *Kept* compares the script',
        'it had to echo against the input itself — the prompt says to keep the user\'s wording, so it should sit',
        'near 1.',
        '',
        '## Summary',
        '',
        summary(models, rows),
        '',
        '## Side by side (disagreements first)',
        '',
        ...sorted.map(row => fixtureSection(row, models)),
    ].join('\n');
    writeFileSync(REPORT_PATH, body, 'utf8');
    return REPORT_PATH;
}
