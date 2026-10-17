import type { Dictionary } from '@/lib/i18n';
import { sectionAnchor, type LessonSection } from '@/lib/learn/config';
import ExampleRow from './ExampleRow';
import LetterGrid from './LetterGrid';
import Mixed from './Mixed';

// A lesson's teaching, rendered on the server: its explanations are English
// in every UI language, and every Punjabi example comes in all three
// renditions, as ruled rows like the tracks' lessons. Each heading carries
// the anchor its checkpoint links to.
export default function LessonSections({ t, sections }: { t: Dictionary; sections: LessonSection[] }) {
    return (
        <div className="space-y-10">
            {sections.map((section, i) => (
                <section key={i} aria-labelledby={sectionAnchor(i)} className="space-y-4">
                    <h2 id={sectionAnchor(i)} lang="en" className="text-xl font-bold text-ink"><Mixed text={section.heading} /></h2>
                    {section.body.map((paragraph, j) => (
                        <p key={j} lang="en" className="leading-relaxed text-ink-muted"><Mixed text={paragraph} /></p>
                    ))}
                    {section.letters && <LetterGrid letters={section.letters} label={t.learn.lesson.lettersAria} />}
                    {section.examples && (
                        <ul aria-label={t.learn.lesson.examplesAria} className="border-t border-edge">
                            {section.examples.map((example, j) => (
                                <li key={j} className="border-b border-edge py-3">
                                    <ExampleRow example={example} />
                                </li>
                            ))}
                        </ul>
                    )}
                    {section.tip && (
                        <p className="border-l-2 border-accent-text py-1 pl-4 text-sm text-ink">
                            <span className="font-semibold text-accent-text">{t.learn.lesson.tip}: </span>
                            <span lang="en"><Mixed text={section.tip} /></span>
                        </p>
                    )}
                </section>
            ))}
        </div>
    );
}
