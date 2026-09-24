// Emits report.md: one summary column per variant, then every fixture with
// its answers side by side, most problems first. The numbers set the reading
// order; reading the answers decides.

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ChatContext } from '../../lib/chat/config';
import { CITATION_STATUSES, type Citation, type CitationStatus } from '../../lib/gurbani/citations';
import { finishedNormally } from './checks';
import type { ChatFixture } from './fixtures';
import type { ChatRun } from './run';

const REPORT_PATH = resolve(import.meta.dirname, 'report.md');

export type Answer = {
    variant: string;
    sample: number;
    run: ChatRun;
    failures: { check: string; reason: string }[];
    cost: number | null;
};

type Row = { fixture: ChatFixture; answers: Answer[] };

type ReportInput = {
    variants: string[]; // baseline first
    rows: Row[];
    set: string;
    samples: number;
    passages: { capturedOn: string; hukamnama: ChatContext; shabad: ChatContext };
    fingerprint: string;
};

const LABELS: Record<CitationStatus, string> = {
    verified: 'verified',
    'wrong-ang': 'wrong Ang',
    close: 'altered',
    unverified: 'not found',
};

const cell = (s: string) => s.replace(/\s+/g, ' ').trim().split('|').join('\\|');
const seconds = (ms: number) => (Number.isFinite(ms) ? `${(ms / 1000).toFixed(1)} s` : '—');
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const words = (text: string) => text.split(/\s+/).filter(Boolean).length;

function median(xs: number[]): number {
    if (!xs.length) return NaN;
    const sorted = [...xs].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// The same rule the checks and the route apply, so a reply cannot be "cut
// short" in one column and fine in another.
const endedEarly = (run: ChatRun) => finishedNormally({ text: run.text, context: null, finishReason: run.finishReason }) !== null;

function citationCounts(citations: Citation[]): string {
    if (!citations.length) return 'none quoted';
    const parts = CITATION_STATUSES.flatMap(status => {
        const n = citations.filter(c => c.status === status).length;
        return n ? [`${n} ${LABELS[status]}`] : [];
    });
    return parts.join(' · ');
}

// Problems a reviewer should look at first: failed checks, quotes that did
// not verify, and answers cut short.
function problems(answer: Answer): number {
    const quotes = (answer.run.citations ?? []).filter(c => c.status !== 'verified').length;
    return answer.failures.length + quotes + (endedEarly(answer.run) ? 1 : 0);
}

function summary(answers: Answer[], expected: number): [string, string][] {
    const runs = answers.map(a => a.run);
    const checked = runs.filter(r => r.citations !== undefined);
    const citations = checked.flatMap(r => r.citations!);
    const exact = citations.filter(c => c.status === 'verified' && c.exact).length;
    const costs = answers.map(a => a.cost).filter((c): c is number => c !== null);
    const checks = answers.reduce((n, a) => n + a.failures.length, 0);
    const versions = [...new Set(runs.map(r => r.modelVersion).filter(Boolean))].join(', ') || '—';
    return [
        ['Answers', `${answers.length} / ${expected}`],
        ['Median time to first text', seconds(median(runs.flatMap(r => (r.ttftMs === null ? [] : [r.ttftMs]))))],
        ['Median total time', seconds(median(runs.map(r => r.latencyMs)))],
        ['Mean words', Number.isNaN(mean(runs.map(r => words(r.text)))) ? '—' : Math.round(mean(runs.map(r => words(r.text)))).toString()],
        ['Mean tokens in / out (thinking)', runs.length
            ? `${Math.round(mean(runs.map(r => r.usage.prompt ?? 0)))} / ${Math.round(mean(runs.map(r => r.usage.output ?? 0)))} (${Math.round(mean(runs.map(r => r.usage.thoughts ?? 0)))})`
            : '—'],
        ['Est. cost per answer', costs.length ? `$${mean(costs).toFixed(4)}` : '—'],
        ['Checks failed', `${checks}`],
        ['Cut short (not a normal finish)', `${runs.filter(endedEarly).length}`],
        ['Gurbani quotes', `${citationCounts(citations)}${exact ? ` (${exact} spelled exactly)` : ''}`],
        ['Answers with quotes not checked', `${runs.length - checked.length}`],
        ['Served as', versions],
    ];
}

function quoteLines(citations: Citation[] | undefined): string[] {
    if (citations === undefined) return ['Gurbani check: not run (GurbaniNow unreachable)'];
    if (!citations.length) return [];
    return ['Gurbani check:', ...citations.map(c => {
        const where = c.line ? ` — Ang ${c.line.ang ?? '?'}${c.line.writer ? `, ${c.line.writer}` : ''}${c.line.source.id !== 1 ? `, ${c.line.source.name}` : ''}` : '';
        const cited = c.citedAng !== undefined ? ` (reply cites Ang ${c.citedAng})` : '';
        const source = c.line && c.status !== 'verified' ? `; source: ${c.line.gurmukhi}` : '';
        return `- ${LABELS[c.status]}${c.status === 'verified' && c.exact === false ? ' (spelling differs)' : ''}: ${c.quote}${where}${cited}${source}`;
    })];
}

export function writeReport(input: ReportInput): string {
    const { variants, rows, samples } = input;
    const expected = rows.length * samples;
    const lines = [
        '# Chat eval',
        '',
        `Set \`${input.set}\`: ${rows.length} fixtures × ${variants.length} variants${samples > 1 ? ` × ${samples} samples` : ''}. ` +
            `Request fingerprint \`${input.fingerprint}\`. Passages captured ${input.passages.capturedOn}: ` +
            `${input.passages.hukamnama.title}; ${input.passages.shabad.title}.`,
        '',
        'Every answer went through the production request (`buildChatRequest`), streamed as the route streams it. ' +
            'Every Gurbani quote is checked by the chat page\'s own verifier against GurbaniNow (the chat itself ' +
            'shows cards for the first six): *altered* means the ' +
            'closest real line differs from the quote, *not found* means no line matched at all. Costs use the ' +
            'introductory Sept 2026 prices, which double on 1 Jan 2027.',
        '',
        '## Summary',
        '',
        `| | ${variants.map(v => `\`${v}\``).join(' | ')} |`,
        `| --- |${variants.map(() => ' --- |').join('')}`,
    ];

    const table = variants.map(v => summary(rows.flatMap(r => r.answers.filter(a => a.variant === v)), expected));
    for (let i = 0; i < table[0].length; i++) {
        lines.push(`| ${table[0][i][0]} | ${table.map(col => cell(col[i][1])).join(' | ')} |`);
    }

    lines.push('', '## Fixtures (most problems first)', '');
    const ordered = [...rows].sort((a, b) => sum(b.answers.map(problems)) - sum(a.answers.map(problems)));
    for (const { fixture, answers } of ordered) {
        const passage = fixture.passage ? ` · passage: ${input.passages[fixture.passage].title}` : '';
        lines.push(
            `### \`${fixture.id}\``,
            '',
            `${fixture.modeId} mode · ${fixture.lensId} lens · ${fixture.languageId}${fixture.script ? ` (${fixture.script})` : ''}${passage}`,
            '',
            `*${fixture.why}*`,
            '',
            `> ${fixture.message}`,
            '',
            `| | ${variants.map(v => `\`${v}\``).join(' | ')} |`,
            `| --- |${variants.map(() => ' --- |').join('')}`,
        );
        const per = (render: (a: Answer) => string) =>
            variants.map(v => answers.filter(a => a.variant === v).map(render).join('<br>') || '—').join(' | ');
        lines.push(
            `| Checks | ${per(a => (a.failures.length ? a.failures.map(f => cell(`✗ ${f.check}: ${f.reason}`)).join('<br>') : '✓'))} |`,
            `| Gurbani quotes | ${per(a => (a.run.citations === undefined ? 'not checked' : citationCounts(a.run.citations)))} |`,
            `| First text · total | ${per(a => `${seconds(a.run.ttftMs ?? NaN)} · ${seconds(a.run.latencyMs)}`)} |`,
            `| Words · tokens out | ${per(a => `${words(a.run.text)} · ${a.run.usage.output ?? '—'}${endedEarly(a.run) ? ` (${a.run.finishReason})` : ''}`)} |`,
            '',
        );
        for (const answer of answers) {
            lines.push(
                `<details><summary>${answer.variant}${samples > 1 ? ` #${answer.sample}` : ''}</summary>`,
                '',
                answer.run.text.trim() || '*(no text)*',
                '',
                ...quoteLines(answer.run.citations),
                '',
                '</details>',
                '',
            );
        }
    }

    writeFileSync(REPORT_PATH, lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n', 'utf8');
    return REPORT_PATH;
}
