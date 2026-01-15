import Link from 'next/link';
import { MapPinIcon, CalendarIcon, UserGroupIcon } from '@heroicons/react/24/outline';

// Mock Data: This is what our Database will eventually look like
const EVENTS = [
  {
    id: 1,
    title: "Weekend Langar Prep",
    location: "Gurudwara Singh Sabha, London",
    date: "Sat, Jan 20 • 4:00 AM",
    volunteers: 12,
    needed: 20,
    category: "Langar",
    color: "bg-orange-100 text-orange-700 border-orange-200"
  },
  {
    id: 2,
    title: "Shoe Service (Jora Ghar)",
    location: "Central Gurudwara, New York",
    date: "Sun, Jan 21 • 9:00 AM",
    volunteers: 4,
    needed: 8,
    category: "Service",
    color: "bg-blue-100 text-blue-700 border-blue-200"
  },
  {
    id: 3,
    title: "Kirtan Class Setup",
    location: "Khalsa School, Toronto",
    date: "Fri, Jan 19 • 5:00 PM",
    volunteers: 2,
    needed: 5,
    category: "Education",
    color: "bg-green-100 text-green-700 border-green-200"
  }
];

export default function SevaPage() {
  return (
    <main className="min-h-screen bg-offwhite font-sans">
      
      {/* Navigation */}
      <nav className="bg-navy text-white py-4 px-6 flex justify-between items-center shadow-lg sticky top-0 z-10">
        <Link href="/" className="font-bold flex items-center gap-2 hover:text-kesri transition">
          <span className="text-kesri">←</span> Back Home
        </Link>
        <h1 className="text-lg font-bold tracking-wide">Seva Opportunities</h1>
        <button className="bg-kesri text-navy text-sm font-bold px-4 py-2 rounded-lg hover:bg-white hover:text-kesri transition-all shadow-md shadow-kesri/20">
          + Post Event
        </button>
      </nav>

      {/* Hero Header */}
      <div className="bg-navy text-white py-12 px-6 text-center">
        <h2 className="text-3xl md:text-4xl font-bold mb-4">
          Serve with <span className="text-kesri">Humility</span>
        </h2>
        <p className="text-slate-300 max-w-xl mx-auto">
          "Vich duniya sev kamaiye, ta dargah baisan paiye." <br/>
          <span className="italic text-slate-500 text-sm">(In the midst of this world, do seva; then you shall find a seat of honor in the Court of the Lord.)</span>
        </p>
      </div>

      {/* Event Grid */}
      <div className="max-w-6xl mx-auto p-6 -mt-8">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {EVENTS.map((event) => (
            <div key={event.id} className="bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden hover:shadow-2xl transition-all hover:-translate-y-1 group">
              
              {/* Card Header */}
              <div className="p-6 border-b border-slate-100">
                <div className="flex justify-between items-start mb-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${event.color}`}>
                    {event.category}
                  </span>
                  <span className="text-slate-400 text-xs font-semibold">
                    {event.needed - event.volunteers} spots left
                  </span>
                </div>
                <h3 className="text-xl font-bold text-navy group-hover:text-kesri transition-colors">
                  {event.title}
                </h3>
              </div>

              {/* Card Details */}
              <div className="p-6 space-y-4 bg-slate-50/50">
                
                <div className="flex items-center gap-3 text-sm text-slate-600">
                  <CalendarIcon className="w-5 h-5 text-kesri" />
                  {event.date}
                </div>
                
                <div className="flex items-center gap-3 text-sm text-slate-600">
                  <MapPinIcon className="w-5 h-5 text-kesri" />
                  {event.location}
                </div>

                <div className="flex items-center gap-3 text-sm text-slate-600">
                  <UserGroupIcon className="w-5 h-5 text-kesri" />
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-kesri h-2 rounded-full" 
                      style={{ width: `${(event.volunteers / event.needed) * 100}%` }}
                    ></div>
                  </div>
                  <span>{event.volunteers}/{event.needed}</span>
                </div>

              </div>

              {/* Action Button */}
              <div className="p-4 bg-white border-t border-slate-100">
                <button className="w-full py-3 rounded-lg border-2 border-navy text-navy font-bold hover:bg-navy hover:text-white transition-all uppercase text-xs tracking-widest">
                  Join Seva
                </button>
              </div>

            </div>
          ))}

        </div>
      </div>
    </main>
  );
}