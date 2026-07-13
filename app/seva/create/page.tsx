'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { db } from '@/lib/firebase';
import { collection, addDoc } from 'firebase/firestore';

export default function CreateSevaPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    location: '',
    date: '',
    needed: '',
    category: 'Langar',
    description: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await addDoc(collection(db, "seva_events"), {
        title: formData.title,
        location: formData.location,
        date: formData.date,
        needed: Number(formData.needed),
        attendees: [],
        category: formData.category,
        description: formData.description,
        createdAt: new Date()
      });

      router.push('/seva');

    } catch (err) {
      console.error("Error adding document: ", err);
      setError('Something went wrong creating the event. Please try again.');
      setLoading(false);
    }
  };

  return (
    <main className="flex-1 p-6 py-8">
      <div className="max-w-xl mx-auto bg-surface-raised rounded-xl shadow-lg border border-edge overflow-hidden">

        {/* Header */}
        <div className="bg-navy dark:bg-navy-light p-6 text-white flex justify-between items-center">
          <h1 className="text-xl font-bold">Post New Seva</h1>
          <Link href="/seva" className="text-sm text-slate-300 hover:text-white hover:underline transition">
            Cancel
          </Link>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-8 space-y-6">

          <div>
            <label htmlFor="title" className="block text-sm font-bold text-ink mb-2">Event Title</label>
            <input
              id="title" name="title" required
              className="w-full p-3 rounded-lg border border-edge focus:border-kesri focus:ring-1 focus:ring-kesri transition text-ink bg-surface-raised"
              placeholder="e.g. Weekend Langar Prep"
              onChange={handleChange}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="category" className="block text-sm font-bold text-ink mb-2">Category</label>
              <select
                id="category" name="category"
                className="w-full p-3 rounded-lg border border-edge bg-surface-raised text-ink"
                onChange={handleChange}
              >
                <option value="Langar">Langar</option>
                <option value="Service">Service</option>
                <option value="Education">Education</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label htmlFor="needed" className="block text-sm font-bold text-ink mb-2">Volunteers Needed</label>
              <input
                id="needed" name="needed" type="number" required min="1"
                className="w-full p-3 rounded-lg border border-edge text-ink bg-surface-raised"
                placeholder="e.g. 5"
                onChange={handleChange}
              />
            </div>
          </div>

          <div>
            <label htmlFor="location" className="block text-sm font-bold text-ink mb-2">Location (Gurudwara)</label>
            <input
              id="location" name="location" required
              className="w-full p-3 rounded-lg border border-edge text-ink bg-surface-raised"
              placeholder="e.g. Gurudwara Singh Sabha"
              onChange={handleChange}
            />
          </div>

          <div>
            <label htmlFor="date" className="block text-sm font-bold text-ink mb-2">Date & Time</label>
            <input
              id="date" name="date" required
              className="w-full p-3 rounded-lg border border-edge text-ink bg-surface-raised"
              placeholder="e.g. Sat, Jan 20 • 4:00 AM"
              onChange={handleChange}
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-bold text-ink mb-2">
              Description <span className="font-normal text-ink-faint">(optional)</span>
            </label>
            <textarea
              id="description" name="description" rows={3}
              className="w-full p-3 rounded-lg border border-edge text-ink bg-surface-raised resize-none"
              placeholder="What will volunteers be doing?"
              onChange={handleChange}
            />
          </div>

          {error && (
            <p role="alert" className="text-sm font-medium text-red-600 dark:text-red-400">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-navy text-white dark:bg-kesri dark:text-navy font-bold py-4 rounded-lg hover:bg-navy-light dark:hover:bg-kesri-hover transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Posting...' : 'Create Seva Event'}
          </button>
        </form>

      </div>
    </main>
  );
}
