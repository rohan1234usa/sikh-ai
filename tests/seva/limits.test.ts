// firestore.rules can't import lib/seva/limits.ts, so it repeats the numbers;
// this reads the rules as text and holds the two to each other, without the
// emulator (tests/rules checks what the numbers do).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
    SEVA_CATEGORIES,
    SEVA_MAX_DAYS_AHEAD,
    SEVA_MAX_DAYS_LONG,
    SEVA_PAGE_MAX,
    SEVA_REPORT_NOTE,
    SEVA_REPORT_REASONS,
    SEVA_SPOTS,
    SEVA_STATUSES,
    SEVA_TEXT,
    SEVA_VOLUNTEER_TEXT,
} from '@/lib/seva/limits';

const rules = readFileSync('firestore.rules', 'utf8');
const listIn = (re: RegExp) => {
    const m = re.exec(rules);
    assert.ok(m, String(re));
    return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
};

test("each text field's length is the same in the rules", () => {
    for (const [field, [min, max]] of Object.entries(SEVA_TEXT)) {
        assert.ok(rules.includes(`sevaText(d.${field}, ${min}, ${max})`), `event ${field}: ${min}–${max}`);
    }
    for (const [field, [min, max]] of Object.entries(SEVA_VOLUNTEER_TEXT)) {
        assert.ok(rules.includes(`sevaText(d.${field}, ${min}, ${max})`), `volunteer ${field}: ${min}–${max}`);
    }
    assert.ok(rules.includes(`sevaText(d.note, ${SEVA_REPORT_NOTE[0]}, ${SEVA_REPORT_NOTE[1]})`), 'report note');
});

test('the numbers and the lists are the same in the rules', () => {
    assert.ok(rules.includes(`d.spots >= ${SEVA_SPOTS[0]} && d.spots <= ${SEVA_SPOTS[1]}`), 'spots');
    // With no set limit, sign-ups stop at the most a limit can be.
    assert.ok(rules.includes(`d.spots == null && d.volunteerCount <= ${SEVA_SPOTS[1]}`), 'no set limit');
    assert.ok(rules.includes(`before.spots == null && after.volunteerCount <= ${SEVA_SPOTS[1]}`), 'joining with no set limit');
    assert.ok(rules.includes(`d.startsAt + duration.value(${SEVA_MAX_DAYS_LONG}, 'd')`), 'longest event');
    assert.ok(rules.includes(`request.time + duration.value(${SEVA_MAX_DAYS_AHEAD}, 'd')`), 'furthest ahead');
    assert.ok(rules.includes(`request.query.limit <= ${SEVA_PAGE_MAX}`), 'page');
    assert.deepEqual(listIn(/d\.category in \[([^\]]+)\]/), [...SEVA_CATEGORIES]);
    assert.deepEqual(listIn(/d\.status in \[([^\]]+)\]/), [...SEVA_STATUSES]);
    assert.deepEqual(listIn(/d\.reason in \[([^\]]+)\]/), [...SEVA_REPORT_REASONS]);
});
