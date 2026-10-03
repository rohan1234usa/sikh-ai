import type { EventFields, SevaEvent } from '@/lib/seva/model';
import type { EventDraft } from '@/lib/seva/validate';

export const ID = 'Ev3ntIdAbCdEfGhIj12x'; // a 20-character auto id, as the SDK makes
export const KEY = 'VoLuNtEeRkEy00000001';

// 2026-10-10, 6 to 9 pm in Fremont (UTC-7 then).
export const SIX_PM_LA = Date.UTC(2026, 9, 11, 1, 0);
export const NINE_PM_LA = Date.UTC(2026, 9, 11, 4, 0);

export const fields = (over: Partial<EventFields> = {}): EventFields => ({
    title: 'Langar seva',
    category: 'langar',
    description: 'Help make and serve langar.',
    startsAt: SIX_PM_LA,
    endsAt: NINE_PM_LA,
    timeZone: 'America/Los_Angeles',
    venue: 'Gurdwara Sahib Fremont',
    address: '300 Gurdwara Rd',
    city: 'Fremont',
    region: 'CA',
    country: 'US',
    organizer: 'Youth committee',
    contact: '',
    spots: 20,
    ...over,
});

export const event = (over: Partial<SevaEvent> = {}): SevaEvent => ({
    ...fields(),
    id: ID,
    status: 'open',
    cancelNote: '',
    hidden: false,
    volunteerCount: 3,
    createdAt: Date.UTC(2026, 8, 1),
    updatedAt: Date.UTC(2026, 8, 1),
    ...over,
});

export const draft = (over: Partial<EventDraft> = {}): EventDraft => ({
    title: 'Langar seva',
    category: 'langar',
    description: 'Help make and serve langar.',
    date: '2026-10-10',
    startTime: '18:00',
    endTime: '21:00',
    multiDay: false,
    endDate: '',
    timeZone: 'America/Los_Angeles',
    venue: 'Gurdwara Sahib Fremont',
    address: '300 Gurdwara Rd',
    city: 'Fremont',
    region: 'CA',
    country: 'US',
    spots: '20',
    organizer: 'Youth committee',
    contact: '',
    ...over,
});

// Before the event, for validation.
export const NOW = Date.UTC(2026, 9, 1);
