'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { MapPinIcon, CalendarIcon, UserGroupIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';

interface SevaEvent {
  id: string;
  title: string;
  location: string;
  date: string;
  needed: number;
  category: string;
  description?: string;
  attendees: string[]; // Array of user IDs
}

// Chip styles owned by the UI, keyed by category — not trusted from Firestore
const CATEGORY_STYLES: Record<string, string> = {
  Langar: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950/50 dark:text-orange-400 dark:border-orange-900",
  Service: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-900",
  Education: "bg-green-100 text-green-700 border-green-200 dark:bg-green-950/50 dark:text-green-400 dark:border-green-900",
  Other: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
};

type Notice = { kind: 'info' | 'error'; text: string };

export default function SevaPage() {
  const [events, setEvents] = useState<SevaEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<Notice | null>(null);
  const { user, signIn } = useAuth();

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

  // Once the user signs in, the sign-in prompt is no longer relevant
  useEffect(() => {
    if (user) setNotice(prev => (prev?.kind === 'info' ? null : prev));
  }, [user]);

  const handleJoin = async (eventId: string) => {
    if (!user) {
      setNotice({ kind: 'info', text: 'You must be signed in to join a Seva event.' });
      return;
    }

    // Optimistic update
    setEvents(prev => prev.map(event =>
      event.id === eventId
        ? { ...event, attendees: [...event.attendees, user.uid] }
        : event
    ));

    try {
      // arrayUnion prevents duplicates automatically
      const eventRef = doc(db, "seva_events", eventId);
      await updateDoc(eventRef, {
        attendees: arrayUnion(user.uid)
      });
    } catch (error) {
      console.error("Error joining event:", error);
      // Roll back the optimistic update
      setEvents(prev => prev.map(event =>
        event.id === eventId
          ? { ...event, attendees: event.attendees.filter(uid => uid !== user.uid) }
          : event
      ));
      setNotice({ kind: 'error', text: 'Something went wrong joining the event. Please try again.' });
    }
  };

  return (
    <main className="flex-1">

      <div className="bg-navy text-white py-12 px-6 text-center">
        <h1 className="text-3xl md:text-4xl font-bold mb-4">
          Serve with <span className="text-kesri">Humility</span>
        </h1>
        <p className="text-slate-300 max-w-xl mx-auto">
          &ldquo;Vich duniya sev kamaiye, ta dargah baisan paiye.&rdquo;
        </p>
        {user && (
          <Link
            href="/seva/create"
            className="inline-block mt-6 bg-kesri text-navy text-sm font-bold px-5 py-2.5 rounded-lg hover:bg-kesri-hover transition-colors shadow-md shadow-kesri/20"
          >
            + Post Event
          </Link>
        )}
      </div>

      <div className="max-w-6xl mx-auto p-6 -mt-8">

        {notice && (
          <div
            role={notice.kind === 'error' ? 'alert' : 'status'}
            className={`mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 text-sm font-medium shadow-sm ${notice.kind === 'error'
              ? 'bg-red-50 border-red-200 text-red-700 dark:bg-red-950/40 dark:border-red-900 dark:text-red-400'
              : 'bg-surface-raised border-edge text-ink'}`}
          >
            <span>{notice.text}</span>
            <span className="flex items-center gap-2">
              {notice.kind === 'info' && !user && (
                <button
                  onClick={async () => { await signIn(); }}
                  className="bg-kesri text-navy font-bold px-4 py-1.5 rounded-lg hover:bg-kesri-hover transition-colors"
                >
                  Sign In
                </button>
              )}
              <button
                onClick={() => setNotice(null)}
                aria-label="Dismiss notice"
                className="p-1.5 rounded-lg hover:bg-edge/60 transition-colors"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            </span>
          </div>
        )}

        {loading && <div className="text-center py-10 text-ink">Loading...</div>}

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">

          {events.map((event) => {
            const volunteerCount = event.attendees.length;
            const isFull = volunteerCount >= event.needed;
            const hasJoined = user ? event.attendees.includes(user.uid) : false;
            const chipStyle = CATEGORY_STYLES[event.category] ?? CATEGORY_STYLES.Other;

            return (
              <div key={event.id} className="bg-surface-raised rounded-xl shadow-lg border border-edge overflow-hidden hover:shadow-2xl transition-all motion-safe:hover:-translate-y-1 group">

                <div className="p-6 border-b border-edge">
                  <div className="flex justify-between items-start mb-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${chipStyle}`}>
                      {event.category}
                    </span>
                    <span className="text-ink-faint text-xs font-semibold">
                      {Math.max(0, event.needed - volunteerCount)} spots left
                    </span>
                  </div>
                  <h2 className="text-xl font-bold text-ink group-hover:text-accent-text transition-colors">
                    {event.title}
                  </h2>
                  {event.description && (
                    <p className="mt-2 text-sm text-ink-muted line-clamp-2">
                      {event.description}
                    </p>
                  )}
                </div>

                <div className="p-6 space-y-4 bg-surface/60">
                  <div className="flex items-center gap-3 text-sm text-ink-muted">
                    <CalendarIcon className="w-5 h-5 text-accent-text" aria-hidden="true" />
                    {event.date}
                  </div>
                  <div className="flex items-center gap-3 text-sm text-ink-muted">
                    <MapPinIcon className="w-5 h-5 text-accent-text" aria-hidden="true" />
                    {event.location}
                  </div>
                  <div className="flex items-center gap-3 text-sm text-ink-muted">
                    <UserGroupIcon className="w-5 h-5 text-accent-text" aria-hidden="true" />
                    <div className="w-full bg-edge rounded-full h-2">
                      <div
                        className="bg-kesri h-2 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, (volunteerCount / event.needed) * 100)}%` }}
                      ></div>
                    </div>
                    <span>{volunteerCount}/{event.needed}</span>
                  </div>
                </div>

                <div className="p-4 bg-surface-raised border-t border-edge">
                  <button
                    onClick={() => handleJoin(event.id)}
                    disabled={isFull || hasJoined}
                    className={`w-full py-3 rounded-lg border-2 font-bold transition-all uppercase text-xs tracking-widest
                      ${hasJoined
                        ? "bg-green-100 border-green-500 text-green-700 dark:bg-green-950 dark:border-green-700 dark:text-green-400 cursor-default"
                        : isFull
                          ? "bg-edge/50 border-edge text-ink-faint cursor-not-allowed"
                          : "border-ink text-ink hover:bg-ink hover:text-surface-raised"
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
