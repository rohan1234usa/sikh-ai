import Link from 'next/link';

type HukamnamaLine = {
  line: {
    id: string;
    gurmukhi: { unicode: string };
    translation: { english: { default: string } };
  };
};

type HukamnamaResponse = {
  date: {
    nanakshahi: {
      english: { date: number; month: string; year: number };
    };
  };
  hukamnamainfo: {
    raag: { unicode: string; };
    pageno: number;
  };
  hukamnama: HukamnamaLine[];
};

async function getHukamnama() {
  const res = await fetch('https://api.gurbaninow.com/v2/hukamnama/today', { 
    cache: 'no-store' 
  });
  
  if (!res.ok) throw new Error('Failed to fetch');
  
  return res.json() as Promise<HukamnamaResponse>;
}

export default async function HukamnamaPage() {
  let data: HukamnamaResponse | null = null;
  let error = false;

  try {
    data = await getHukamnama();
  } catch (e) {
    error = true;
  }

  const dateInfo = data?.date.nanakshahi.english;
  const dateString = dateInfo ? `${dateInfo.month} ${dateInfo.date}, ${dateInfo.year}` : "Today";

  return (
    <main className="min-h-screen bg-offwhite flex flex-col font-sans">
      
      {/* FIXED NAV: Added 'z-50' to keep it on top. 
         Removed transparency/blur to stop the "color change" glitch.
         It is now solid Navy.
      */}
      <nav className="sticky top-0 z-50 bg-navy w-full py-4 px-6 flex justify-between items-center shadow-md">
        <Link href="/" className="font-bold text-white flex items-center gap-2 hover:text-kesri transition group">
          <span className="text-kesri group-hover:-translate-x-1 transition-transform">←</span> 
          Back Home
        </Link>
        <div className="text-right">
          <span className="block text-gold tracking-widest uppercase text-xs font-bold">
            {dateString}
          </span>
          <span className="text-xs text-slate-300">Live from Darbar Sahib</span>
        </div>
      </nav>

      <div className="flex-grow max-w-4xl mx-auto w-full p-4 md:p-8">
        
        {error || !data ? (
           <div className="text-center mt-20 p-8 bg-white rounded-xl border border-red-100 shadow-sm">
             <p className="text-slate-800">Unable to load the Hukamnama right now.</p>
           </div>
        ) : (
          <div className="bg-white shadow-2xl rounded-2xl overflow-hidden border-t-8 border-kesri">
            
            {/* FIXED HEADER: 
               Changed background to 'bg-slate-50' for subtle contrast.
               Changed Text to 'text-black' (was navy) for maximum darkness.
            */}
            <div className="bg-slate-50 p-8 text-center border-b border-slate-200">
              <h1 className="text-3xl text-black font-serif font-bold mb-2">
                {data.hukamnamainfo.raag.unicode}
              </h1>
              <p className="text-slate-600 text-sm uppercase tracking-wider font-bold">
                Ang {data.hukamnamainfo.pageno}
              </p>
            </div>

            <div className="p-6 md:p-12 space-y-10">
              {data.hukamnama.map((item) => (
                <div key={item.line.id} className="text-center space-y-4">
                  
                  {/* Main Shabad Lines */}
                  <h2 className="text-2xl md:text-4xl text-black font-bold leading-relaxed font-serif">
                    {item.line.gurmukhi.unicode}
                  </h2>
                  
                  {/* Translation */}
                  <p className="text-slate-700 text-lg md:text-xl italic font-medium">
                    {item.line.translation.english.default}
                  </p>
                  
                  <div className="w-16 h-px bg-slate-300 mx-auto mt-6"></div>
                </div>
              ))}
            </div>

          </div>
        )}
      </div>
    </main>
  );
}