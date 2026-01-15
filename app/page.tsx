import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen bg-offwhite flex flex-col font-sans">
      {/* Navigation */}
      <nav className="w-full py-6 px-8 flex justify-between items-center bg-navy text-white">
        <div className="text-2xl font-bold tracking-wide flex items-center gap-2">
          {/* Using a text emoji for Ik Onkar temporarily to save setup time */}
          <span className="text-kesri">ੴ</span> SikhAI
        </div>
        <div className="hidden md:flex gap-6 text-sm font-medium">
          <Link href="/hukamnama" className="hover:text-kesri transition">Hukamnama</Link>
          <Link href="/chat" className="hover:text-kesri transition">Ask SikhAI</Link>
          <Link href="/seva" className="hover:text-kesri transition">Seva Events</Link>
        </div>
        <button className="bg-kesri text-navy font-semibold px-4 py-2 rounded-lg hover:bg-white hover:text-kesri transition-all">
          Sign In
        </button>
      </nav>

      {/* Hero Section */}
      <section className="relative bg-navy text-white py-24 px-6 overflow-hidden flex-grow">
        {/* Abstract Background Element (Gold glow) */}
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gold/10 blur-3xl rounded-full -translate-y-1/4 translate-x-1/4 pointer-events-none"></div>

        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-12 items-center relative z-10">
          
          {/* Text Content */}
          <div className="space-y-6">
            <div className="inline-block bg-navy-light border border-gold/30 rounded-full px-4 py-1 text-xs font-semibold tracking-wider text-gold uppercase">
              Powered by Google Gemini
            </div>
            <h1 className="text-5xl md:text-6xl font-bold leading-tight">
              Wisdom of the Gurus, <br />
              <span className="text-kesri">Illuminated by AI.</span>
            </h1>
            <p className="text-lg text-slate-300 max-w-lg leading-relaxed">
              Explore Gurbani, find local Sangat, and discover daily Hukamnamas 
              in a space designed for peace, learning, and Seva.
            </p>
            
            <div className="flex flex-wrap gap-4 pt-4">
              <Link 
                href="/chat"
                className="bg-kesri text-navy font-bold px-8 py-3 rounded-xl shadow-lg shadow-kesri/20 hover:scale-105 transition-transform flex items-center gap-2"
              >
                Start Chatting
                {/* Arrow Icon */}
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </Link>
              <Link 
                href="/hukamnama"
                className="border border-slate-600 hover:border-gold hover:text-gold text-slate-300 font-semibold px-8 py-3 rounded-xl transition-colors"
              >
                Today's Hukamnama
              </Link>
            </div>
          </div>

          {/* Hero Visual Placeholder */}
          <div className="relative hidden md:block">
             <div className="bg-navy-light border border-slate-700 p-6 rounded-2xl shadow-2xl relative">
                <div className="flex items-center gap-3 mb-4 border-b border-slate-700 pb-4">
                   <div className="w-3 h-3 rounded-full bg-red-500"></div>
                   <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                   <div className="w-3 h-3 rounded-full bg-green-500"></div>
                   <span className="ml-auto text-xs text-slate-500">Sikh AI Chat</span>
                </div>
                <div className="space-y-4">
                  <div className="bg-slate-800/50 p-3 rounded-lg rounded-tl-none border border-slate-700 w-3/4">
                    <p className="text-sm text-slate-300">Waheguru Ji Ka Khalsa... How can I help you understand Gurbani today?</p>
                  </div>
                  <div className="bg-kesri/10 p-3 rounded-lg rounded-tr-none border border-kesri/20 w-3/4 ml-auto">
                    <p className="text-sm text-kesri">What does the Guru Granth Sahib say about humility?</p>
                  </div>
                </div>
             </div>
          </div>

        </div>
      </section>
    </main>
  );
}