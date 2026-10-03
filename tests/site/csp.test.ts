import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contentSecurityPolicy } from '@/lib/csp';
import { parsePolicy } from '../helpers/csp';

test('the production policy locks down framing, plugins, base and form targets, and reports', () => {
    const p = parsePolicy(contentSecurityPolicy({ dev: false, preview: false, firebaseAuthDomain: 'sikhai.firebaseapp.com' }));
    assert.deepEqual(p.get('frame-ancestors'), ["'none'"]);
    assert.deepEqual(p.get('object-src'), ["'none'"]);
    assert.deepEqual(p.get('base-uri'), ["'self'"]);
    assert.deepEqual(p.get('form-action'), ["'self'"]);
    assert.deepEqual(p.get('report-uri'), ['/api/csp-report']);
    assert.deepEqual(p.get('report-to'), ['csp']);
    assert.ok(!p.get('script-src')!.includes("'unsafe-eval'"));
    // Sign-in's helper iframe, and nothing else, may be framed.
    assert.deepEqual(p.get('frame-src'), ['https://sikhai.firebaseapp.com']);
    // Firebase can load and connect.
    assert.ok(p.get('script-src')!.includes('https://apis.google.com'));
    assert.ok(p.get('connect-src')!.includes('https://*.googleapis.com'));
    assert.ok(!p.get('connect-src')!.some((s) => s.includes('vercel.live')), 'no preview toolbar in production');
});

test('in production, the only other hosts are Firebase: nothing else sees a visit', () => {
    // /privacy names every service a visitor's browser talks to. A host added
    // to the policy means a new one, and a line there.
    const p = parsePolicy(contentSecurityPolicy({ dev: false, preview: false, firebaseAuthDomain: 'sikhai.firebaseapp.com' }));
    const hosts = [...new Set([...p.values()].flat().filter((s) => s.includes('://')))].sort();
    assert.deepEqual(hosts, ['https://*.googleapis.com', 'https://apis.google.com', 'https://sikhai.firebaseapp.com']);
    assert.deepEqual(p.get('img-src'), ["'self'", 'data:', 'blob:'], 'no tracking pixels');
});

test('next dev and previews get only what they need on top', () => {
    const dev = parsePolicy(contentSecurityPolicy({ dev: true, preview: false }));
    assert.ok(dev.get('script-src')!.includes("'unsafe-eval'"));
    assert.ok(dev.get('connect-src')!.includes('ws:'));
    // Web Analytics' and Speed Insights' debug scripts, which only log.
    assert.ok(dev.get('script-src')!.includes('https://va.vercel-scripts.com'));
    assert.deepEqual(dev.get('frame-src'), ["'none'"], 'no auth domain configured: nothing may be framed');
    const preview = parsePolicy(contentSecurityPolicy({ dev: false, preview: true }));
    assert.ok(preview.get('script-src')!.includes('https://vercel.live'));
    assert.ok(preview.get('frame-src')!.includes('https://vercel.live'));
    assert.ok(!preview.get('script-src')!.includes("'unsafe-eval'"));
});

test('the Firebase emulators are reachable only under next dev, and only when asked for', () => {
    const local = parsePolicy(contentSecurityPolicy({ dev: true, preview: false, emulators: true }));
    assert.ok(local.get('connect-src')!.includes('http://127.0.0.1:8080'));
    assert.ok(local.get('connect-src')!.includes('http://127.0.0.1:9099'));
    assert.deepEqual(local.get('frame-src'), ['http://127.0.0.1:9099']);
    for (const p of [
        contentSecurityPolicy({ dev: false, preview: false, emulators: true }),
        contentSecurityPolicy({ dev: true, preview: false }),
    ]) {
        assert.ok(!p.includes('127.0.0.1'));
    }
});
