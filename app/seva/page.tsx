'use client'; 

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation'; // For redirecting
import { MapPinIcon, CalendarIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import { db } from '@/lib/firebase'; 
import { collection, getDocs, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext'; // Get User

interface SevaEvent {
  id: string;
  title: string;
  location: string;
  date: string;
  needed: number;
  category: string;
  color: string;
  attendees: string[]; // CHANGED: Now an array of User IDs
}

export default function SevaPage() {
  const [events, setEvents] = useState<SevaEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth(); // Get current logged in user
  const router = useRouter();

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "seva_events"));
        const eventsData = querySnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            // Handle legacy data: if 'attendees' doesn't exist yet, make it empty
            attendees: data.attendees || [] 
          };
        }) as SevaEvent[];
        setEvents(eventsData);
      } catch (error) {
        console.error("Error fetching seva events: ", error);
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, []);

  const handleJoin = async (eventId: string) => {
    // 1. Check if User is Logged In
    if (!user) {
      const confirmLogin = window.confirm("You must be signed in to join a Seva event. Would you like to sign in now?");
      if (confirmLogin) {
        router.push('/'); // Redirect to home to sign in
      }
      return;
    }

    // 2. Optimistic Update (Update UI instantly)
    setEvents(prev => prev.map(event => {
      if (event.id === eventId) {
        return { 
          ...event, 
          attendees: [...event.attendees, user.uid] // Add user ID to local state
        };
      }
      return event;
    }));

    try {
      // 3. Update Firebase with arrayUnion (Prevents duplicates automatically)
      const eventRef = doc(db, "seva_events", eventId);
      await updateDoc(eventRef, {
        attendees: arrayUnion(user.uid)
      });
    } catch (error) {
      console.error("Error joining event:", error);
      alert("Something went wrong. Please try again.");
    }
  };

  return (
    <main className="min-h-screen bg-offwhite font-sans">
      
      <nav className="bg-navy text-white py-4 px-6 flex justify-between items-center shadow-lg sticky top-0 z-10">
        <Link href="/" className="font-bold flex items-center gap-2 hover:text-kesri transition">
          <span className="text-kesri">←</span> Back Home
        </Link>
        <h1 className="text-lg font-bold tracking-wide">Seva Opportunities</h1>
        {/* Only show Post Event if logged in (Optional) */}
        {user && (
          <Link href="/seva/create">
            <button className="bg-kesri text-navy text-sm font-bold px-4 py-2 rounded-lg hover:bg-white hover:text-kesri transition-all shadow-md shadow-kesri/20">
              + Post Event
            </button>
          </Link>
        )}
      </nav>

      <div className="bg-navy text-white py-12 px-6 text-center">
        <h2 className="text-3xl md:text-4xl font-bold mb-4">
          Serve with <span className="text-kesri">Humility</span>
        </h2>
        <p className="text-slate-300 max-w-xl mx-auto">
          "Vich duniya sev kamaiye, ta dargah baisan paiye."
        </p>
      </div>

      <div className="max-w-6xl mx-auto p-6 -mt-8">
        
        {loading && <div className="text-center py-10 text-navy">Loading...</div>}

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {events.map((event) => {
            const volunteerCount = event.attendees.length;
            const isFull = volunteerCount >= event.needed;
            // CHECK: Is the current user's ID in the list?
            const hasJoined = user ? event.attendees.includes(user.uid) : false;

            return (
              <div key={event.id} className="bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden hover:shadow-2xl transition-all hover:-translate-y-1 group">
                
                <div className="p-6 border-b border-slate-100">
                  <div className="flex justify-between items-start mb-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${event.color}`}>
                      {event.category}
                    </span>
                    <span className="text-slate-400 text-xs font-semibold">
                      {Math.max(0, event.needed - volunteerCount)} spots left
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-navy group-hover:text-kesri transition-colors">
                    {event.title}
                  </h3>
                </div>

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
                        className="bg-kesri h-2 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, (volunteerCount / event.needed) * 100)}%` }}
                      ></div>
                    </div>
                    <span>{volunteerCount}/{event.needed}</span>
                  </div>
                </div>

                <div className="p-4 bg-white border-t border-slate-100">
                  <button 
                    onClick={() => handleJoin(event.id)}
                    disabled={isFull || hasJoined}
                    className={`w-full py-3 rounded-lg border-2 font-bold transition-all uppercase text-xs tracking-widest
                      ${hasJoined 
                        ? "bg-green-100 border-green-500 text-green-700 cursor-default" 
                        : isFull 
                          ? "bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed"
                          : "border-navy text-navy hover:bg-navy hover:text-white"
                      }
                    `}
                  >
                    {hasJoined ? "Joined! Waheguru" : isFull ? "Full - Waheguru" : "Join Seva"}
                  </button>
                </div>

              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}