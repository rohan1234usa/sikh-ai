'use client';

import Image from 'next/image';
import { useT } from '../context/LanguageContext';

export default function AboutPage() {
    const t = useT();

    return (
        <main className="flex-1 flex flex-col">
            <section className="flex-grow flex items-center justify-center py-12 px-4 md:px-8">
                <div className="bg-surface-raised max-w-5xl w-full rounded-2xl shadow-xl overflow-hidden border border-edge p-8 md:p-16">
                    <div className="grid md:grid-cols-[1fr_1.5fr] gap-12 items-center">

                        {/* Profile Image Column */}
                        <div className="flex justify-center md:justify-center">
                            <div className="relative w-64 h-64 md:w-80 md:h-80 rounded-full overflow-hidden border-[6px] border-edge shadow-inner">
                                <Image
                                    src="/rohan-profile.png"
                                    onError={(e) => {
                                        // Fallback if image not found (just for dev preview comfort)
                                        e.currentTarget.srcset = "https://ui-avatars.com/api/?name=Rohan+Singh&size=400&background=0F172A&color=F59E0B"
                                    }}
                                    alt="Rohan Singh"
                                    width={400}
                                    height={400}
                                    className="object-cover w-full h-full"
                                    priority
                                />
                            </div>
                        </div>

                        {/* Content Column */}
                        <div className="space-y-6 text-center md:text-left">

                            {/* Badge */}
                            <div className="flex justify-center md:justify-start">
                                <span className="inline-block bg-edge/60 text-ink-muted text-[10px] md:text-xs font-bold tracking-widest uppercase px-3 py-1 rounded-full">
                                    {t.about.badge}
                                </span>
                            </div>

                            {/* Headings */}
                            <div className="space-y-2">
                                <p className="text-sm font-bold text-ink-faint uppercase tracking-[0.2em]">
                                    {t.about.builtBy}
                                </p>
                                <h1 className="text-4xl md:text-5xl font-bold text-ink tracking-tight">
                                    Rohan Singh
                                </h1>
                            </div>

                            {/* Bio — split into segments so the styled spans can sit
                                wherever the translation's word order needs them */}
                            <div className="space-y-4">
                                <p className="text-ink-muted leading-relaxed font-medium">
                                    {t.about.bio1Before}<span className="text-ink font-bold">{t.about.bio1School}</span>{t.about.bio1After}
                                </p>
                                <p className="text-ink-faint text-sm leading-relaxed">
                                    {t.about.bio2Before}<span className="text-emerald-600 dark:text-emerald-400 font-semibold">{t.about.bio2Highlight}</span>{t.about.bio2After}
                                </p>
                            </div>

                            {/* Buttons */}
                            <div className="flex flex-col md:flex-row gap-4 justify-center md:justify-start pt-6 h-14">
                                <a
                                    href="https://built-by-rohan.vercel.app/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="bg-navy hover:bg-slate-800 text-white dark:bg-kesri dark:text-navy dark:hover:bg-kesri-hover text-xs font-bold tracking-wider uppercase px-8 rounded flex items-center justify-center gap-2 transition-colors h-full"
                                >
                                    {t.about.portfolioCta}
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4" aria-hidden="true">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
                                    </svg>
                                </a>
                                <a
                                    href="https://www.linkedin.com/in/rohan123/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="bg-surface-raised border border-edge text-ink-muted hover:text-ink hover:border-ink text-xs font-bold tracking-wider uppercase px-6 rounded flex items-center justify-center gap-2 transition-all h-full"
                                >
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 21.227.792 22 1.771 22h20.451C23.2 22 24 21.227 24 20.451V1.729C24 .774 23.2 0 22.225 0z" />
                                    </svg>
                                    {t.about.linkedinCta}
                                </a>
                            </div>

                        </div>
                    </div>
                </div>
            </section>
        </main>
    );
}
