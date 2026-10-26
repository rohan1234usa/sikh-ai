// The clock that keeps due counts moving while a page stays open (#66 I2):
// useMinute's subscription and reading (app/components/useMinute.ts), and the
// rule useLiveNow applies to them (app/components/learn/useLearnProgress.ts).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { liveTime } from '@/app/components/learn/useLearnProgress';
import { subscribeMinute, thisMinute } from '@/app/components/useMinute';

const MINUTE = Date.UTC(2026, 9, 24, 20, 1);

test('due counts use the later of the progress read (or last change) and the minute', () => {
    assert.equal(liveTime(null, MINUTE), null, 'nothing before progress is read');
    assert.equal(liveTime(MINUTE - 60_000, null), MINUTE - 60_000, 'before the clock first reads');
    assert.equal(liveTime(MINUTE - 60_000, MINUTE), MINUTE, 'a page left open moves on');
    // A card missed 20 seconds into a minute is due at that moment; the
    // minute, rounded down, must not hide it.
    assert.equal(liveTime(MINUTE + 20_000, MINUTE), MINUTE + 20_000);
});

test('the minute is read every 15 seconds, at once when a hidden tab is shown, and never after unsubscribing', (t) => {
    t.mock.timers.enable({ apis: ['setInterval', 'Date'], now: MINUTE - 10_000 });
    const page = new EventTarget();
    Object.defineProperty(globalThis, 'document', { value: page, configurable: true });
    t.after(() => { delete (globalThis as { document?: unknown }).document; });

    let reads = 0;
    const stop = subscribeMinute(() => { reads++; });
    assert.equal(thisMinute(), MINUTE - 60_000, 'rounded down to the minute');
    t.mock.timers.tick(15_000);
    assert.equal(reads, 1);
    assert.equal(thisMinute(), MINUTE, 'and the next one, once it has begun');
    page.dispatchEvent(new Event('visibilitychange'));
    assert.equal(reads, 2, 'a tab shown again reads it at once');

    stop();
    t.mock.timers.tick(60_000);
    page.dispatchEvent(new Event('visibilitychange'));
    assert.equal(reads, 2, 'nothing after unsubscribing');
});
