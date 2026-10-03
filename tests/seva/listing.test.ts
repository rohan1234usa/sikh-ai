import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cityKey, facetsOf, filterOptions, filtersToSearch, groupByDay, matches, parseFilters, upcoming } from '@/lib/seva/listing';
import { zonedTimeToUtc } from '@/lib/seva/time';
import { event } from './helpers';

const at = (date: string, time: string, tz: string) => zonedTimeToUtc(date, time, tz)!.ms;
const H = 3600e3;

test('one city however it was typed', () => {
    assert.equal(cityKey(' Surrey '), 'surrey');
    assert.equal(cityKey('SURREY'), 'surrey');
    assert.equal(cityKey('New   Delhi'), 'new delhi');
    // ਸ਼ composed and decomposed are one city.
    assert.equal(cityKey('ਸ਼ਹਿਰ'), cityKey('ਸ਼ਹਿਰ'.normalize('NFD')));
});

test('the board shows what is not over, soonest first, under way first, then by the venue\'s day', () => {
    const now = at('2026-10-10', '12:00', 'America/Los_Angeles');
    const events = [
        event({ id: 'a'.repeat(20), title: 'Delhi', timeZone: 'Asia/Kolkata', startsAt: at('2026-10-11', '19:00', 'Asia/Kolkata'), endsAt: at('2026-10-11', '21:00', 'Asia/Kolkata') }),
        event({ id: 'b'.repeat(20), title: 'Fremont evening', startsAt: at('2026-10-10', '18:00', 'America/Los_Angeles'), endsAt: at('2026-10-10', '21:00', 'America/Los_Angeles') }),
        event({ id: 'c'.repeat(20), title: 'Under way', startsAt: now - H, endsAt: now + H }),
        event({ id: 'd'.repeat(20), title: 'Over', startsAt: now - 3 * H, endsAt: now - H }),
        event({ id: 'e'.repeat(20), title: 'Cancelled', status: 'cancelled', startsAt: now + H, endsAt: now + 2 * H }),
    ];
    const list = upcoming(events, now);
    assert.deepEqual(list.map((e) => e.title), ['Under way', 'Fremont evening', 'Delhi']);
    const { now: under, days } = groupByDay(list, now);
    assert.deepEqual(under.map((e) => e.title), ['Under way']);
    assert.deepEqual(days.map((d) => [d.key, d.events.map((e) => e.title)]), [['2026-10-10', ['Fremont evening']], ['2026-10-11', ['Delhi']]]);
});

test('filters offer only what has events, with counts, narrowing in turn', () => {
    const facets = [
        event({ country: 'CA', city: 'Surrey', category: 'langar' }),
        event({ country: 'CA', city: ' surrey', category: 'kirtan' }),
        event({ country: 'CA', city: 'Brampton', category: 'langar' }),
        event({ country: 'IN', city: 'Amritsar', category: 'langar' }),
    ].map(facetsOf);
    const all = filterOptions(facets, { country: '', city: '', category: '' });
    assert.deepEqual(all.countries.map((o) => [o.value, o.count]), [['CA', 3], ['IN', 1]]);
    const ca = filterOptions(facets, { country: 'CA', city: '', category: '' });
    assert.deepEqual(ca.cities.map((o) => [o.value, o.label, o.count]), [['surrey', 'Surrey', 2], ['brampton', 'Brampton', 1]]);
    const surrey = filterOptions(facets, { country: 'CA', city: 'surrey', category: '' });
    assert.deepEqual(surrey.categories.map((o) => [o.value, o.count]), [['langar', 1], ['kirtan', 1]]);
    assert.equal(facets.filter((f) => matches(f, { country: 'CA', city: 'surrey', category: 'langar' })).length, 1);
});

test('filters travel in the address, and anything else in it is ignored', () => {
    const f = parseFilters('?country=ca&city=Surrey&category=langar&utm=x');
    assert.deepEqual(f, { country: 'CA', city: 'surrey', category: 'langar' });
    assert.equal(filtersToSearch(f), '?country=CA&city=surrey&category=langar');
    assert.deepEqual(parseFilters('?country=Canada&category=party'), { country: '', city: '', category: '' });
    assert.equal(filtersToSearch({ country: '', city: '', category: '' }), '');
});
