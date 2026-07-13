import Link from 'next/link';
import {
  ChatBubbleLeftRightIcon,
  SunIcon,
  MagnifyingGlassIcon,
  UserGroupIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';

const FEATURES = [
  {
    href: '/chat',
    title: 'Ask SikhAI',
    desc: 'Ask questions and get Gurbani-grounded answers, streamed in real time.',
    cta: 'Start chatting',
    Icon: ChatBubbleLeftRightIcon,
  },
  {
    href: '/hukamnama',
    title: 'Daily Hukamnama',
    desc: "Today's Hukamnama from Darbar Sahib, in Gurmukhi and English.",
    cta: 'Read today’s',
    Icon: SunIcon,
  },
  {
    href: '/shabad',
    title: 'Shabad Search',
    desc: 'Look up any Ang (1–1430) of the Guru Granth Sahib.',
    cta: 'Search Gurbani',
    Icon: MagnifyingGlassIcon,
  },
  {
    href: '/seva',
    title: 'Seva Events',
    desc: 'Find and join local Sangat seva opportunities.',
    cta: 'Browse events',
    Icon: UserGroupIcon,
  },
];

export default function Home() {
  return (
    <main className="flex-1 flex flex-col">
      {/* Hero Section */}
      <section className="relative overflow-hidden text-white px-6 py-20 md:py-28 bg-gradient-to-b from-navy to-navy-light dark:from-[#0b1220] dark:via-navy dark:to-[#020617]">
        {/* Ambient glows */}
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gold/10 dark:bg-gold/20 blur-3xl rounded-full -translate-y-1/4 translate-x-1/4 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-1/2 h-2/3 bg-kesri/10 blur-3xl rounded-full translate-y-1/4 -translate-x-1/4 pointer-events-none"></div>

        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-12 items-center relative z-10">
          <div className="space-y-6">
            <div className="inline-block bg-navy-light border border-gold/30 rounded-full px-4 py-1 text-xs font-semibold tracking-wider text-gold uppercase animate-fade-up">
              Powered by Google Gemini
            </div>
            <h1 className="text-5xl md:text-6xl font-bold leading-tight animate-fade-up [animation-delay:80ms]">
              Wisdom of the Gurus, <br />
              <span className="text-kesri">Illuminated by AI.</span>
            </h1>
            <p className="text-lg text-slate-300 max-w-lg leading-relaxed animate-fade-up [animation-delay:160ms]">
              Explore Gurbani, find local Sangat, and discover daily Hukamnamas
              in a space designed for peace, learning, and Seva.
            </p>

            <div className="flex flex-wrap gap-4 pt-4 animate-fade-up [animation-delay:240ms]">
              <Link
                href="/chat"
                className="bg-kesri text-navy font-bold px-8 py-3 rounded-xl shadow-lg shadow-kesri/20 motion-safe:hover:scale-105 transition-transform flex items-center gap-2"
              >
                Start Chatting
                <ArrowRightIcon className="w-5 h-5" aria-hidden="true" />
              </Link>
              <Link
                href="/hukamnama"
                className="border border-slate-600 hover:border-gold hover:text-gold text-slate-300 font-semibold px-8 py-3 rounded-xl transition-colors"
              >
                Today&apos;s Hukamnama
              </Link>
            </div>
          </div>

          {/* Decorative product preview — hidden from assistive tech (the
              conversation is illustrative, not real content) */}
          <div className="relative mt-4 md:mt-0 animate-fade-up [animation-delay:320ms]" aria-hidden="true">
            <div className="bg-navy-light border border-slate-700 p-4 md:p-6 rounded-2xl shadow-2xl relative motion-safe:animate-float">
              <div className="flex items-center gap-3 mb-4 border-b border-slate-700 pb-4">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span className="ml-auto text-xs text-slate-400">Sikh AI Chat</span>
              </div>
              <div className="space-y-4">
                <div className="bg-slate-800/50 p-3 rounded-lg rounded-tl-none border border-slate-700 w-3/4">
                  <p className="text-sm text-slate-300">Waheguru Ji Ka Khalsa... How can I help you understand Gurbani today?</p>
                </div>
                <div className="bg-kesri/10 p-3 rounded-lg rounded-tr-none border border-kesri/20 w-3/4 ml-auto">
                  <p className="text-sm text-kesri">What does the Guru Granth Sahib say about humility?</p>
                </div>
                <div className="bg-slate-800/50 p-3 rounded-lg rounded-tl-none border border-slate-700 w-fit">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce"></span>
                    <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce [animation-delay:150ms]"></span>
                    <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce [animation-delay:300ms]"></span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Explore Section */}
      <section className="bg-surface px-6 py-16 md:py-24">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-ink">Explore SikhAI</h2>
            <p className="mt-3 text-ink-muted">
              Four ways to connect with Gurbani and Sangat — all in one place.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(({ href, title, desc, cta, Icon }) => (
              <Link
                key={href}
                href={href}
                className="group flex flex-col gap-3 bg-surface-raised border border-edge rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-accent-text/40 motion-safe:hover:-translate-y-1 transition-all"
              >
                <span className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-accent-text/10 text-accent-text">
                  <Icon className="w-6 h-6" aria-hidden="true" />
                </span>
                <h3 className="font-semibold text-lg text-ink">{title}</h3>
                <p className="text-sm text-ink-muted leading-relaxed">{desc}</p>
                <span className="mt-auto pt-2 inline-flex items-center gap-1 text-sm font-medium text-accent-text">
                  {cta}
                  <ArrowRightIcon
                    className="w-4 h-4 motion-safe:group-hover:translate-x-0.5 transition-transform"
                    aria-hidden="true"
                  />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
