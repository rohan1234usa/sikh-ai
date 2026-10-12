import type { Metadata } from 'next';
import Image from 'next/image';
import { ArrowUpRightIcon } from '@heroicons/react/24/outline';
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '@/app/components/buttons';
import { getServerT } from '@/lib/i18n/server';
import { pageMetadata } from '@/lib/metadata';

export async function generateMetadata(): Promise<Metadata> {
    const { lang, t } = await getServerT();
    return pageMetadata(lang, t, '/about', t.meta.aboutTitle, t.meta.descriptions.about);
}

// Who built the site, set on the page like the site's other pages rather than
// in a card: the portrait square in a hairline mount, as a plate in a book
// is, then the name and a short note.
export default async function AboutPage() {
    const { t } = await getServerT();

    return (
        <main className="flex-1 flex flex-col">
            <section className="mx-auto grid w-full max-w-5xl flex-grow items-center gap-10 px-4 py-12 md:grid-cols-[auto_1fr] md:gap-16 md:px-8 md:py-20">
                <div className="flex justify-center">
                    <div className="border border-edge p-2">
                        <Image
                            src="/rohan-profile.png"
                            alt="Rohan Singh"
                            width={400}
                            height={400}
                            className="h-60 w-60 object-cover md:h-72 md:w-72"
                            priority
                        />
                    </div>
                </div>

                <div className="space-y-5 text-center md:text-left">
                    <div className="space-y-2">
                        <p className="text-xs font-bold uppercase tracking-widest text-accent-text">{t.about.builtBy}</p>
                        <h1 className="text-4xl font-bold text-ink md:text-5xl">Rohan Singh</h1>
                    </div>

                    {/* Split into segments so the styled spans can sit wherever
                        the translation's word order needs them */}
                    <p className="text-lg leading-relaxed text-ink-muted">
                        {t.about.bio1Before}<span className="font-semibold text-ink">{t.about.bio1School}</span>{t.about.bio1After}
                    </p>
                    <p className="leading-relaxed text-ink-muted">
                        {t.about.bio2Before}<span className="font-semibold text-accent-text">{t.about.bio2Highlight}</span>{t.about.bio2After}
                    </p>

                    <div className="flex flex-wrap justify-center gap-3 pt-2 md:justify-start">
                        <a
                            href="https://built-by-rohan.vercel.app/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className={PRIMARY_BUTTON}
                        >
                            {t.about.portfolioCta}
                            <ArrowUpRightIcon className="h-4 w-4" aria-hidden="true" />
                        </a>
                        <a
                            href="https://www.linkedin.com/in/rohan123/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className={SECONDARY_BUTTON}
                        >
                            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 21.227.792 22 1.771 22h20.451C23.2 22 24 21.227 24 20.451V1.729C24 .774 23.2 0 22.225 0z" />
                            </svg>
                            {t.about.linkedinCta}
                        </a>
                    </div>
                </div>
            </section>
        </main>
    );
}
