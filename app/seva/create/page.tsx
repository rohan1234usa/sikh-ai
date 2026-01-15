'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { db } from '@/lib/firebase';
import { collection, addDoc } from 'firebase/firestore';

export default function CreateSevaPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

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

    try {
      let colorClass = "bg-blue-100 text-blue-700 border-blue-200";
      if (formData.category === 'Langar') colorClass = "bg-orange-100 text-orange-700 border-orange-200";
      if (formData.category === 'Education') colorClass = "bg-green-100 text-green-700 border-green-200";

      await addDoc(collection(db, "seva_events"), {
        title: formData.title,
        location: formData.location,
        date: formData.date,
        needed: Number(formData.needed),
        volunteers: 0,
        category: formData.category,
        color: colorClass,
        createdAt: new Date()
      });

      router.push('/seva');
      
    } catch (error) {
      console.error("Error adding document: ", error);
      alert("Error creating event. Check console.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-offwhite font-sans p-6">
      <div className="max-w-xl mx-auto bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden">
        
        {/* Header */}
        <div className="bg-navy p-6 text-white flex justify-between items-center">
          <h1 className="text-xl font-bold">Post New Seva</h1>
          {/* Made Cancel button explicitly white/gray so it pops against Navy */}
          <Link href="/seva" className="text-sm text-slate-300 hover:text-white hover:underline transition">
            Cancel
          </Link>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          
          <div>
            {/* Added text-navy explicitly */}
            <label className="block text-sm font-bold text-navy mb-2">Event Title</label>
            <input 
              name="title" required
              className="w-full p-3 rounded-lg border border-slate-200 focus:outline-none focus:border-kesri focus:ring-1 focus:ring-kesri transition text-navy bg-white"
              placeholder="e.g. Weekend Langar Prep"
              onChange={handleChange}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-navy mb-2">Category</label>
              <select 
                name="category" 
                className="w-full p-3 rounded-lg border border-slate-200 bg-white text-navy"
                onChange={handleChange}
              >
                <option value="Langar">Langar</option>
                <option value="Service">Service</option>
                <option value="Education">Education</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-navy mb-2">Volunteers Needed</label>
              <input 
                name="needed" type="number" required min="1"
                className="w-full p-3 rounded-lg border border-slate-200 text-navy bg-white"
                placeholder="e.g. 5"
                onChange={handleChange}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-navy mb-2">Location (Gurudwara)</label>
            <input 
              name="location" required
              className="w-full p-3 rounded-lg border border-slate-200 text-navy bg-white"
              placeholder="e.g. Gurudwara Singh Sabha"
              onChange={handleChange}
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-navy mb-2">Date & Time</label>
            <input 
              name="date" required
              className="w-full p-3 rounded-lg border border-slate-200 text-navy bg-white"
              placeholder="e.g. Sat, Jan 20 • 4:00 AM"
              onChange={handleChange}
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-navy text-white font-bold py-4 rounded-lg hover:bg-opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Posting...' : 'Create Seva Event'}
          </button>
        </form>

      </div>
    </main>
  );
}