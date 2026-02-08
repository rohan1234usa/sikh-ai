'use client';

import Image from 'next/image';
import Link from 'next/link';
import Navbar from '../components/Navbar';

export default function AboutPage() {
    return (
        <main className="min-h-screen bg-offwhite flex flex-col font-sans">
            <Navbar />

            <section className="flex-grow flex items-center justify-center py-12 px-4 md:px-8 bg-slate-50">
                <div className="bg-white max-w-5xl w-full rounded-2xl shadow-xl overflow-hidden border border-slate-100 p-8 md:p-16">
                    <div className="grid md:grid-cols-[1fr_1.5fr] gap-12 items-center">

                        {/* Profile Image Column */}
                        <div className="flex justify-center md:justify-center">
                            <div className="relative w-64 h-64 md:w-80 md:h-80 rounded-full overflow-hidden border-[6px] border-slate-100 shadow-inner">
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
                                <span className="inline-block bg-slate-100 text-slate-600 text-[10px] md:text-xs font-bold tracking-widest uppercase px-3 py-1 rounded-full">
                                    &lt;/&gt; The Architect
                                </span>
                            </div>

                            {/* Headings */}
                            <div className="space-y-2">
                                <h2 className="text-sm font-bold text-slate-400 uppercase tracking-[0.2em]">
                                    Built By
                                </h2>
                                <h1 className="text-4xl md:text-5xl font-bold text-navy tracking-tight">
                                    Rohan Singh
                                </h1>
                            </div>

                            {/* Bio Code */}
                            <div className="space-y-4">
                                <p className="text-slate-600 leading-relaxed font-medium">
                                    Computer Science undergraduate at <span className="text-navy font-bold">UC Irvine</span> (Class of '27) with a relentless passion for AI/ML and Full Stack engineering.
                                </p>
                                <p className="text-slate-500 text-sm leading-relaxed">
                                    This platform leverages <span className="text-emerald-600 font-semibold">Generative AI</span> to bridge the gap between ancient wisdom and modern technology. It represents the intersection of spiritual heritage and state-of-the-art language models.
                                </p>
                            </div>

                            {/* Buttons */}
                            <div className="flex flex-col md:flex-row gap-4 justify-center md:justify-start pt-6 h-14">
                                <a
                                    href="https://built-by-rohan.vercel.app/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="bg-navy hover:bg-slate-800 text-white text-xs font-bold tracking-wider uppercase px-8 rounded flex items-center justify-center gap-2 transition-colors h-full"
                                >
                                    View My Portfolio
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
                                    </svg>
                                </a>
                                <a
                                    href="https://www.linkedin.com/in/rohan123/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="bg-white border text-slate-600 hover:text-navy hover:border-navy text-xs font-bold tracking-wider uppercase px-6 rounded flex items-center justify-center gap-2 transition-all h-full"
                                >
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 21.227.792 22 1.771 22h20.451C23.2 22 24 21.227 24 20.451V1.729C24 .774 23.2 0 22.225 0z" />
                                    </svg>
                                    Connect on LinkedIn
                                </a>
                            </div>

                        </div>
                    </div>
                </div>
            </section>
        </main>
    );
}
