// Fills the local Firebase emulators with Seva events in every state, for
// trying the pages out without touching the real project (README, "Testing
// Seva locally"). Start the emulators first (`npm run emulators`), then:
//
//   npm run seed:seva
//
// It empties both emulators, then makes four Google accounts (sign in as any
// of them from the emulator's sign-in page), each event, and a few sign-ups
// and reports. Everything goes through the emulators' own admin access
// (Bearer owner), which they accept only locally.

const PROJECT = 'demo-sikhai';
const FIRESTORE = 'http://127.0.0.1:8080';
const AUTH = 'http://127.0.0.1:9099';
const DOCS = `${FIRESTORE}/v1/projects/${PROJECT}/databases/(default)/documents`;
const OWNER = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' };

const HOUR = 3600e3;
const DAY = 24 * HOUR;

async function call(url: string, init: RequestInit = {}): Promise<unknown> {
    const res = await fetch(url, { ...init, headers: { ...OWNER, ...init.headers } });
    if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${url}: ${res.status} ${await res.text()}`);
    const text = await res.text();
    return text ? JSON.parse(text) : null;
}

type Value = string | number | boolean | Date | null;
const encode = (v: Value) =>
    v === null ? { nullValue: null }
        : v instanceof Date ? { timestampValue: v.toISOString() }
            : typeof v === 'boolean' ? { booleanValue: v }
                : typeof v === 'number' ? { integerValue: String(v) }
                    : { stringValue: v };

const write = (path: string, data: Record<string, Value>) =>
    call(`${DOCS}/${path}`, {
        method: 'PATCH',
        body: JSON.stringify({ fields: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, encode(v)])) }),
    });

const randomId = () => Array.from(crypto.getRandomValues(new Uint8Array(20)), (b) => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[b % 62]).join('');

// A Google account in the Auth emulator, as its sign-in page would make it.
async function googleAccount(sub: string, name: string): Promise<string> {
    const idToken = JSON.stringify({ sub, email: `${sub}@example.com`, email_verified: true, name });
    const out = await call(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=demo-key`, {
        method: 'POST',
        body: JSON.stringify({ requestUri: 'http://localhost', postBody: `id_token=${encodeURIComponent(idToken)}&providerId=google.com`, returnSecureToken: true }),
    }) as { localId: string };
    return out.localId;
}

// The venue's clock time `days` from today, as an instant (good enough for
// sample data: whole hours, zones without a change in the next weeks).
function at(days: number, hour: number, offsetHours: number): Date {
    const d = new Date(Date.now() + days * DAY);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hour) - offsetHours * HOUR);
}

type Sample = {
    title: string; category: string; description?: string; venue: string; address?: string; city: string; region?: string;
    // null: anyone can sign up; 0: no sign-up.
    country: string; timeZone: string; startsAt: Date; endsAt: Date; spots: number | null; organizer: string; contact?: string;
    status?: 'open' | 'cancelled'; cancelNote?: string; hidden?: boolean;
};

async function main() {
    await call(`${FIRESTORE}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
    await call(`${AUTH}/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' });

    const [hana, amar, bina, olive] = await Promise.all([
        googleAccount('hana', 'Hana Kaur'), googleAccount('amar', 'Amar Singh'),
        googleAccount('bina', 'Bina Kaur'), googleAccount('olive', 'Olive Admin'),
    ]);
    await write(`admins/${olive}`, { role: 'owner' });

    const now = Date.now();
    const samples: Sample[] = [
        { title: 'Langar seva for Sunday diwan', category: 'langar', description: 'Help prepare and serve langar after the Sunday diwan.\nBring a head covering; aprons are provided.', venue: 'Gurdwara Sahib Fremont', address: '300 Gurdwara Rd', city: 'Fremont', region: 'CA', country: 'US', timeZone: 'America/Los_Angeles', startsAt: at(1, 18, -7), endsAt: at(1, 21, -7), spots: 20, organizer: 'Fremont youth committee', contact: 'seva@example.org' },
        { title: 'Shoe room and grounds clean-up', category: 'gurdwara', venue: 'Gurdwara Dashmesh Darbar', address: '12885 85 Ave', city: 'Surrey', region: 'BC', country: 'CA', timeZone: 'America/Vancouver', startsAt: at(3, 9, -7), endsAt: at(3, 13, -7), spots: 2, organizer: 'Surrey sevadars' },
        { title: 'Evening kirtan: help with setup and sound', category: 'kirtan', venue: 'Sri Guru Singh Sabha', address: '2-8 Park Ave', city: 'Southall', country: 'GB', timeZone: 'Europe/London', startsAt: at(5, 18, 1), endsAt: at(5, 21, 1), spots: 6, organizer: 'Southall Sangat' },
        { title: 'Khalsa school: Punjabi class helpers', category: 'teaching', description: 'Help the teachers with the youngest class.', venue: 'Gurdwara Sikh Sangat', city: 'Brampton', region: 'ON', country: 'CA', timeZone: 'America/Toronto', startsAt: at(8, 10, -4), endsAt: at(8, 12, -4), spots: 5, organizer: 'Khalsa school team' },
        { title: 'ਲੰਗਰ ਦੀ ਸੇਵਾ', category: 'langar', description: 'ਸ੍ਰੀ ਹਰਿਮੰਦਰ ਸਾਹਿਬ ਵਿਖੇ ਲੰਗਰ ਦੀ ਸੇਵਾ।', venue: 'ਗੁਰੂ ਰਾਮਦਾਸ ਲੰਗਰ ਹਾਲ', city: 'Amritsar', region: 'Punjab', country: 'IN', timeZone: 'Asia/Kolkata', startsAt: at(2, 5, 5.5), endsAt: at(2, 9, 5.5), spots: 50, organizer: 'ਸੇਵਾ ਜਥਾ' },
        { title: 'Food drive at the community centre', category: 'community', venue: 'Fremont community centre', city: 'Fremont', region: 'CA', country: 'US', timeZone: 'America/Los_Angeles', startsAt: new Date(now - HOUR), endsAt: new Date(now + 2 * HOUR), spots: 10, organizer: 'Fremont youth committee' },
        { title: 'Ending in a few minutes', category: 'other', venue: 'Gurdwara Sahib Fremont', city: 'Fremont', region: 'CA', country: 'US', timeZone: 'America/Los_Angeles', startsAt: new Date(now - HOUR), endsAt: new Date(now + 3 * 60e3), spots: 4, organizer: 'Test' },
        { title: 'Nagar Kirtan preparations', category: 'gurpurab', description: 'Three days of preparations for the Nagar Kirtan.', venue: 'Gurdwara Sahib Fremont', city: 'Fremont', region: 'CA', country: 'US', timeZone: 'America/Los_Angeles', startsAt: at(10, 18, -7), endsAt: at(12, 14, -7), spots: 40, organizer: 'Gurpurab committee' },
        { title: 'Gurpurab decorations', category: 'gurpurab', venue: 'Gurdwara Sahib Fremont', city: 'Fremont', region: 'CA', country: 'US', timeZone: 'America/Los_Angeles', startsAt: at(4, 10, -7), endsAt: at(4, 14, -7), spots: 8, organizer: 'Gurpurab committee', status: 'cancelled', cancelNote: 'Moved to next Sunday' },
        { title: 'Buy cheap watches here', category: 'other', venue: 'Online', city: 'Nowhere', country: 'US', timeZone: 'UTC', startsAt: at(6, 10, 0), endsAt: at(6, 11, 0), spots: 100, organizer: 'Spammer', hidden: true },
        { title: 'Last week’s langar', category: 'langar', venue: 'Gurdwara Sahib Fremont', city: 'Fremont', region: 'CA', country: 'US', timeZone: 'America/Los_Angeles', startsAt: new Date(now - 6 * DAY), endsAt: new Date(now - 6 * DAY + 3 * HOUR), spots: 10, organizer: 'Fremont youth committee' },
        { title: 'Gurpurab langar: all hands welcome', category: 'langar', description: 'Cooking and serving for the gurpurab. Come for as long as you can.', venue: 'Gurdwara Sahib Fremont', address: '300 Gurdwara Rd', city: 'Fremont', region: 'CA', country: 'US', timeZone: 'America/Los_Angeles', startsAt: at(9, 8, -7), endsAt: at(9, 16, -7), spots: null, organizer: 'Gurpurab committee' },
        { title: 'Sukhmani Sahib path at the Gurdwara', category: 'kirtan', description: 'I’ll be doing the path that morning. Join in if you can.', venue: 'Gurdwara Sahib Fremont', city: 'Fremont', region: 'CA', country: 'US', timeZone: 'America/Los_Angeles', startsAt: at(6, 7, -7), endsAt: at(6, 9, -7), spots: 0, organizer: 'Hana Kaur' },
    ];

    const ids: string[] = [];
    for (const s of samples) {
        const id = randomId();
        ids.push(id);
        const created = new Date(now - 2 * DAY);
        await write(`seva_events/${id}`, {
            v: 1, title: s.title, category: s.category, description: s.description ?? '', startsAt: s.startsAt, endsAt: s.endsAt,
            timeZone: s.timeZone, venue: s.venue, address: s.address ?? '', city: s.city, region: s.region ?? '', country: s.country,
            organizer: s.organizer, contact: s.contact ?? '', spots: s.spots, volunteerCount: 0, status: s.status ?? 'open',
            cancelNote: s.cancelNote ?? '', hidden: s.hidden ?? false, createdAt: created, updatedAt: created,
        });
        await write(`users/${hana}/seva_hosting/${id}`, { createdAt: created });
    }

    // Sign-ups: the count kept in step, as the rules would.
    const signUp = async (uid: string, eventIndex: number, name: string, email = '', phone = '') => {
        const key = randomId();
        const joinedAt = new Date(now - DAY);
        await write(`seva_events/${ids[eventIndex]}/volunteers/${key}`, { name, email, phone, joinedAt });
        await write(`users/${uid}/seva_signups/${ids[eventIndex]}`, { volunteerId: key, joinedAt });
    };
    await signUp(amar, 0, 'Amar Singh', 'amar@example.com', '+1 510 555 0100');
    await signUp(bina, 0, 'Bina Kaur');
    await signUp(amar, 1, 'Amar Singh');
    await signUp(bina, 1, 'Bina Kaur', 'bina@example.com');
    await signUp(amar, 8, 'Amar Singh');
    await signUp(amar, 11, 'Amar Singh', 'amar@example.com');
    await signUp(bina, 11, 'Bina Kaur');
    const counts: Record<number, number> = { 0: 2, 1: 2, 8: 1, 11: 2 };
    for (const [i, n] of Object.entries(counts)) {
        await call(`${DOCS}/seva_events/${ids[Number(i)]}?updateMask.fieldPaths=volunteerCount`, {
            method: 'PATCH', body: JSON.stringify({ fields: { volunteerCount: { integerValue: String(n) } } }),
        });
    }

    const report = (uid: string, i: number, reason: string, note = '') =>
        write(`seva_reports/${ids[i]}_${uid}`, { eventId: ids[i], reason, note, createdAt: new Date(now - HOUR) });
    await report(amar, 9, 'spam');
    await report(bina, 9, 'spam', 'Selling watches');
    await report(bina, 2, 'wrong_details', 'The address is the old building');

    console.log('Seeded the emulators:');
    console.log(`  accounts: hana (hosts every event) ${hana}, amar ${amar}, bina ${bina}, olive (admin) ${olive}`);
    const signups = (s: Sample) => (s.spots === null ? ' (no limit)' : s.spots === 0 ? ' (no sign-up)' : '');
    samples.forEach((s, i) => console.log(`  /seva/${ids[i]}  ${s.title}${signups(s)}${s.hidden ? ' (hidden)' : ''}${s.status === 'cancelled' ? ' (cancelled)' : ''}`));
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    console.error('Are the emulators running? npm run emulators');
    process.exit(1);
});
