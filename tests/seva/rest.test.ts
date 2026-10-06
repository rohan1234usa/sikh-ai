import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeDocument, decodeQueryResponse, decodeValue, documentsBase, startOfUtcDay, upcomingQuery } from '@/lib/seva/rest';
import { parseEvent } from '@/lib/seva/event';
import { ID, event } from './helpers';

test('every REST value type comes back plain', () => {
    assert.equal(decodeValue({ nullValue: null }), null);
    assert.equal(decodeValue({ booleanValue: false }), false);
    assert.equal(decodeValue({ stringValue: 'ਸੇਵਾ' }), 'ਸੇਵਾ');
    assert.equal(decodeValue({ integerValue: '20' }), 20);
    assert.equal(decodeValue({ integerValue: '9007199254740993' }), undefined, 'past a safe integer');
    assert.equal(decodeValue({ doubleValue: 2.5 }), 2.5);
    assert.equal(decodeValue({ doubleValue: 'NaN' }), undefined);
    assert.equal(decodeValue({ timestampValue: '2026-10-11T01:00:00.000123Z' }), '2026-10-11T01:00:00.000123Z');
    assert.deepEqual(decodeValue({ arrayValue: {} }), []);
    assert.deepEqual(decodeValue({ arrayValue: { values: [{ integerValue: '1' }] } }), [1]);
    assert.deepEqual(decodeValue({ mapValue: {} }), {});
    assert.deepEqual(decodeValue({ mapValue: { fields: { a: { stringValue: 'b' } } } }), { a: 'b' });
    assert.equal(decodeValue({ bytesValue: 'AAA=' }), undefined);
    assert.equal(decodeValue('nonsense'), undefined);
});

test('a REST document parses as the event the app wrote', () => {
    const e = event();
    const doc = {
        name: `projects/p/databases/(default)/documents/seva_events/${ID}`,
        updateTime: '2026-09-01T00:00:05.5Z',
        fields: {
            v: { integerValue: '1' }, title: { stringValue: e.title }, category: { stringValue: e.category },
            description: { stringValue: e.description }, startsAt: { timestampValue: new Date(e.startsAt).toISOString() },
            endsAt: { timestampValue: new Date(e.endsAt).toISOString() }, timeZone: { stringValue: e.timeZone },
            venue: { stringValue: e.venue }, address: { stringValue: e.address }, city: { stringValue: e.city },
            region: { stringValue: e.region }, country: { stringValue: e.country }, organizer: { stringValue: e.organizer },
            contact: { stringValue: '' }, spots: { integerValue: '20' }, volunteerCount: { integerValue: '3' },
            status: { stringValue: 'open' }, cancelNote: { stringValue: '' }, hidden: { booleanValue: false },
            createdAt: { timestampValue: new Date(e.createdAt).toISOString() }, updatedAt: { timestampValue: new Date(e.updatedAt).toISOString() },
        },
    };
    const decoded = decodeDocument(doc)!;
    assert.equal(decoded.id, ID);
    assert.equal(decoded.updateTime, Date.parse('2026-09-01T00:00:05.5Z'));
    assert.deepEqual(parseEvent(decoded.id, decoded.data), e);

    // No limit is a REST null; no sign-up, 0; and a document without the
    // field isn't an event.
    const withSpots = (spots: object | undefined, count = '3') => {
        const { spots: _spots, ...rest } = doc.fields;
        return decodeDocument({ ...doc, fields: { ...rest, ...(spots ? { spots } : {}), volunteerCount: { integerValue: count } } })!;
    };
    assert.deepEqual(parseEvent(ID, withSpots({ nullValue: null }).data), event({ spots: null }));
    assert.deepEqual(parseEvent(ID, withSpots({ integerValue: '0' }, '0').data), event({ spots: 0, volunteerCount: 0 }));
    assert.equal(parseEvent(ID, withSpots(undefined).data), null);
});

test('a query answer is its documents; an empty one is none; an error is no answer', () => {
    assert.deepEqual(decodeQueryResponse([{ readTime: '2026-10-01T00:00:00Z' }]), []);
    const docs = decodeQueryResponse([{ document: { name: 'a/b/seva_events/x', fields: {} }, readTime: 'r' }, { document: { name: 'a/b/seva_events/y', fields: {} } }]);
    assert.deepEqual(docs?.map((d) => d.id), ['x', 'y']);
    assert.equal(decodeQueryResponse([{ error: { code: 400 } }]), null);
    assert.equal(decodeQueryResponse({ error: { code: 403 } }), null);
});

test('the upcoming query asks for visible, open events not over by the start of the UTC day, a page at most', () => {
    const since = startOfUtcDay(Date.UTC(2026, 9, 2, 17, 30));
    assert.equal(since, Date.UTC(2026, 9, 2));
    const q = upcomingQuery(since).structuredQuery;
    assert.equal(q.limit, 100);
    assert.deepEqual(q.where.compositeFilter.filters.map((f) => [f.fieldFilter.field.fieldPath, f.fieldFilter.op]), [
        ['hidden', 'EQUAL'], ['status', 'EQUAL'], ['endsAt', 'GREATER_THAN_OR_EQUAL'],
    ]);
    assert.equal(q.where.compositeFilter.filters[2].fieldFilter.value.timestampValue, '2026-10-02T00:00:00.000Z');
    assert.deepEqual(q.orderBy, [{ field: { fieldPath: 'endsAt' }, direction: 'ASCENDING' }]);
    assert.equal(documentsBase('p', ''), 'https://firestore.googleapis.com/v1/projects/p/databases/(default)/documents');
    assert.equal(documentsBase('demo-sikhai', '127.0.0.1:8080'), 'http://127.0.0.1:8080/v1/projects/demo-sikhai/databases/(default)/documents');
});
