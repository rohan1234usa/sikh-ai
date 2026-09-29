import type { Dictionary } from '@/lib/i18n';
import { fmt } from '@/lib/i18n/fmt';
import type { LessonSection } from '@/lib/learn/config';
import ExampleRow from './ExampleRow';
import LetterGrid from './LetterGrid';
import Mixed from './Mixed';

// A lesson's teaching, rendered on the server: its explanations are English
// in every UI language, and every Punjabi example comes in all three
// renditions.
export default function LessonSections({ t, sections }: { t: Dictionary; sections: LessonSection[] }) {
    const copyLabel = fmt(t.translate.copyAria, { label: t.translate.gurmukhiLabel });
    return (
        <div className="space-y-10">
            {sections.map((section, i) => (
                <section key={i} aria-labelledby={`section-${i}`} className="space-y-4">
                    <h2 id={`section-${i}`} lang="en" className="text-xl font-bold text-ink"><Mixed text={section.heading} /></h2>
                    {section.body.map((paragraph, j) => (
                        <p key={j} lang="en" className="leading-relaxed text-ink-muted"><Mixed text={paragraph} /></p>
                    ))}
                    {section.letters && <LetterGrid letters={section.letters} label={t.learn.lesson.lettersAria} />}
                    {section.examples && (
                        <ul aria-label={t.learn.lesson.examplesAria} className="space-y-3">
                            {section.examples.map((example, j) => (
                                <li key={j} className="bg-surface-raised border border-edge rounded-xl shadow-sm p-4">
                                    <ExampleRow example={example} copyLabel={copyLabel} />
                                </li>
                            ))}
                        </ul>
                    )}
                    {section.tip && (
                        <p className="rounded-lg border border-kesri/30 bg-kesri/10 p-3 text-sm text-ink">
                            <span className="font-semibold text-accent-text">{t.learn.lesson.tip}: </span>
                            <span lang="en"><Mixed text={section.tip} /></span>
                        </p>
                    )}
                </section>
            ))}
        </div>
    );
}
