import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SEVA_TEXT } from '@/lib/seva/limits';
import { textLength, validateCancelNote, validateEventDraft, validateJoin, validateReport, westernDigits } from '@/lib/seva/validate';
import { NOW, SIX_PM_LA, NINE_PM_LA, draft } from './helpers';

const errorsOf = (over: Parameters<typeof draft>[0], ctx: Partial<Parameters<typeof validateEventDraft>[1]> = {}) => {
    const r = validateEventDraft(draft(over), { now: NOW, ...ctx });
    return r.ok ? {} : r.errors;
};

test('a filled-in form becomes the event as stored: trimmed, composed, times as instants', () => {
    const r = validateEventDraft(draft({ title: '  Langar seva ', city: ' Fremont' }), { now: NOW });
    assert.ok(r.ok);
    assert.equal(r.fields.title, 'Langar seva');
    assert.equal(r.fields.city, 'Fremont');
    assert.equal(r.fields.startsAt, SIX_PM_LA);
    assert.equal(r.fields.endsAt, NINE_PM_LA);
    assert.equal(r.fields.spots, 20);
});

test('each text field is held to the limits the rules use, counted in code points', () => {
    // ਸਿੱ is three code points: a letter, a vowel sign and an addak.
    assert.equal(textLength('ਸਿੱ'), 3);
    assert.equal(textLength('🙏'), 1);
    for (const key of ['title', 'venue', 'city', 'organizer'] as const) {
        const [min, max] = SEVA_TEXT[key];
        assert.equal(errorsOf({ [key]: '' })[key], 'required', key);
        assert.equal(errorsOf({ [key]: 'ਸ'.repeat(max + 1) })[key], 'tooLong', key);
        assert.equal(errorsOf({ [key]: 'ਸ'.repeat(max) })[key], undefined, key);
        if (min > 1) assert.equal(errorsOf({ [key]: 'ਸ'.repeat(min - 1) })[key], 'tooShort', key);
    }
    assert.equal(errorsOf({ title: '   ' }).title, 'required', 'spaces alone are empty');
    assert.equal(errorsOf({ description: 'x'.repeat(2001) }).description, 'tooLong');
    assert.equal(errorsOf({ address: '' }).address, undefined, 'the street is optional');
});

test('volunteers needed is a whole number from 1 to 500, in either script of digits', () => {
    assert.equal(westernDigits('੨੫'), '25');
    const r = validateEventDraft(draft({ spots: '੫' }), { now: NOW });
    assert.ok(r.ok && r.fields.spots === 5);
    for (const bad of ['0', '501', '5.5', 'five', '-2']) assert.equal(errorsOf({ spots: bad }).spots, 'invalid', bad);
    assert.equal(errorsOf({ spots: '' }).spots, 'required');
    assert.equal(errorsOf({ spots: '2' }, { editing: { startsAt: SIX_PM_LA, endsAt: NINE_PM_LA, volunteerCount: 3 } }).spots, 'belowJoined');
});

test('the times hang together: ends after it starts, within a week, not already started', () => {
    assert.equal(errorsOf({ endTime: '17:00' }).endTime, 'endBeforeStart');
    assert.equal(errorsOf({ multiDay: true, endDate: '2026-10-09', endTime: '21:00' }).endDate, 'endBeforeStart');
    assert.equal(errorsOf({ multiDay: true, endDate: '2026-10-18', endTime: '21:00' }).endDate, 'tooLongEvent');
    const twoDays = validateEventDraft(draft({ multiDay: true, endDate: '2026-10-11', endTime: '14:00' }), { now: NOW });
    assert.ok(twoDays.ok);
    assert.equal(errorsOf({}, { now: SIX_PM_LA + 1 }).startTime, 'startPast');
    assert.equal(errorsOf({ date: '2027-10-10' }).date, 'tooFarAhead');
    assert.equal(errorsOf({ date: '10/10/2026' }).date, 'invalid');
    assert.equal(errorsOf({ timeZone: 'Somewhere/Else' }).timeZone, 'invalid');
    assert.equal(errorsOf({ country: 'ZZ' }).country, 'required');
    assert.equal(errorsOf({ category: 'party' }).category, 'required');
});

test('an edit may leave a past time alone, but not move one into the past', () => {
    const editing = { startsAt: SIX_PM_LA, endsAt: NINE_PM_LA, volunteerCount: 3 };
    const later = NINE_PM_LA + 3600e3;
    assert.ok(validateEventDraft(draft({ description: 'Thank you all' }), { now: later, editing }).ok, 'unchanged times');
    assert.equal(errorsOf({ endTime: '21:30' }, { now: later, editing }).endTime, 'ended');
    assert.ok(validateEventDraft(draft({ date: '2026-10-17' }), { now: later, editing }).ok, 'moved into the future');
});

test('joining asks for a name, and shares only what is ticked', () => {
    const r = validateJoin({ name: ' Amar ', shareEmail: false, email: 'a@example.com', sharePhone: true, phone: '+1 (510) 555-0100' });
    assert.ok(r.ok);
    assert.deepEqual(r.fields, { name: 'Amar', email: '', phone: '+1 (510) 555-0100' });
    const both = validateJoin({ name: 'Amar', shareEmail: true, email: 'a@example.com', sharePhone: false, phone: '555' });
    assert.ok(both.ok && both.fields.email === 'a@example.com' && both.fields.phone === '');
    const bad = validateJoin({ name: ' ', shareEmail: false, email: '', sharePhone: true, phone: 'call me' });
    assert.ok(!bad.ok);
    assert.deepEqual(bad.errors, { name: 'required', phone: 'invalid' });
    const empty = validateJoin({ name: 'Amar', shareEmail: false, email: '', sharePhone: true, phone: '' });
    assert.ok(!empty.ok && empty.errors.phone === 'required');
});

test('a report needs a reason, and a word for "something else"; a cancel note has a limit', () => {
    assert.deepEqual(validateReport({ reason: 'spam', note: '' }), { ok: true, fields: { reason: 'spam', note: '' } });
    assert.deepEqual(validateReport({ reason: '', note: '' }), { ok: false, errors: { reason: 'required' } });
    assert.deepEqual(validateReport({ reason: 'other', note: ' ' }), { ok: false, errors: { note: 'required' } });
    assert.deepEqual(validateReport({ reason: 'spam', note: 'x'.repeat(501) }), { ok: false, errors: { note: 'tooLong' } });
    assert.deepEqual(validateCancelNote(' Moved to Sunday '), { ok: true, note: 'Moved to Sunday' });
    assert.deepEqual(validateCancelNote('x'.repeat(301)), { ok: false, error: 'tooLong' });
});

test('an event goes back into the form as it was typed, and a week later for Post again', async () => {
    const { draftFromEvent, postAgainDraft, parseDraft } = await import('@/lib/seva/draft');
    const r = validateEventDraft(draft(), { now: NOW });
    assert.ok(r.ok);
    assert.deepEqual(draftFromEvent(r.fields), draft());
    const again = postAgainDraft(r.fields, NOW);
    assert.deepEqual([again.date, again.startTime, again.endTime], ['2026-10-17', '18:00', '21:00']);
    // Across the end of summer time in Los Angeles (1 November): still 6 pm.
    const late = validateEventDraft(draft({ date: '2026-10-31' }), { now: NOW });
    assert.ok(late.ok);
    assert.deepEqual([postAgainDraft(late.fields, NOW).date, postAgainDraft(late.fields, NOW).startTime], ['2026-11-07', '18:00']);
    // One from weeks ago comes forward whole weeks, to the first still to come.
    const weeksLater = postAgainDraft(r.fields, Date.UTC(2026, 9, 30));
    assert.deepEqual([weeksLater.date, weeksLater.startTime], ['2026-10-31', '18:00']);
    // Overnight comes back as a later end day.
    const overnight = validateEventDraft(draft({ multiDay: true, endDate: '2026-10-11', endTime: '02:00' }), { now: NOW });
    assert.ok(overnight.ok);
    assert.deepEqual([draftFromEvent(overnight.fields).multiDay, draftFromEvent(overnight.fields).endDate], [true, '2026-10-11']);
    // A kept draft keeps only the form's fields.
    assert.deepEqual(parseDraft({ title: 'x', multiDay: 'yes', extra: 1 }), { ...parseDraft({}), title: 'x' });
});
