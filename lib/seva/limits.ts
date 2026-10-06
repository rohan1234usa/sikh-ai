// The numbers and lists firestore.rules holds Seva's documents to, in one
// place for the form, the plans and the tests. The rules can't import this,
// so tests/seva/limits.test.ts reads them as text and checks they agree.
//
// Lengths are [min, max] in characters as the rules count them: code points,
// so a Gurmukhi syllable with a vowel sign is two (textLength() in
// ./validate.ts). Text is stored trimmed.

export const SEVA_EVENT_VERSION = 1;

export const SEVA_CATEGORIES = ['langar', 'gurdwara', 'gurpurab', 'kirtan', 'teaching', 'community', 'other'] as const;
export const SEVA_STATUSES = ['open', 'cancelled'] as const;
export const SEVA_REPORT_REASONS = ['spam', 'not_seva', 'offensive', 'wrong_details', 'other'] as const;

export const SEVA_TEXT = {
    title: [3, 100],
    description: [0, 2000],
    timeZone: [1, 64],
    venue: [2, 120],
    address: [0, 200],
    city: [1, 80],
    region: [0, 80],
    organizer: [2, 80],
    contact: [0, 200],
    cancelNote: [0, 300],
} as const;

export const SEVA_VOLUNTEER_TEXT = {
    name: [1, 80],
    email: [0, 120],
    phone: [0, 40],
} as const;

export const SEVA_REPORT_NOTE = [0, 500] as const;

// Volunteers an event asks for, when it sets a limit. Without one its spots
// are null; an event that takes no sign-ups has 0 (./model.ts).
export const SEVA_SPOTS = [1, 500] as const;

// An event lasts at most a week, and is posted at most a year ahead.
export const SEVA_MAX_DAYS_LONG = 7;
export const SEVA_MAX_DAYS_AHEAD = 366;

// The most events one query may ask for: the board's whole page.
export const SEVA_PAGE_MAX = 100;

// Reports an admin dismisses per batch. Each delete reads the admin's own
// document, and a batch may read 20.
export const SEVA_ADMIN_BATCH = 10;

// Sign-ups a host clears per batch, winding an event down: each delete reads
// the host's note, and the event twice (whether it's there, and its state).
export const SEVA_HOST_CLEAR_BATCH = 5;
