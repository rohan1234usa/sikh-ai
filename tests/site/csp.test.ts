import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contentSecurityPolicy } from '@/lib/csp';

const parse = (policy: string) => new Map(policy.split('; ').map((d) => {
    const [name, ...sources] = d.split(' ');
    return [name, sources] as const;
}));

test('the production policy locks down framing, plugins, base and form targets, and reports', () => {
    const p = parse(contentSecurityPolicy({ dev: false, preview: false, firebaseAuthDomain: 'sikhai.firebaseapp.com' }));
    assert.deepEqual(p.get('frame-ancestors'), ["'none'"]);
    assert.deepEqual(p.get('object-src'), ["'none'"]);
    assert.deepEqual(p.get('base-uri'), ["'self'"]);
    assert.deepEqual(p.get('form-action'), ["'self'"]);
    assert.deepEqual(p.get('report-uri'), ['/api/csp-report']);
    assert.deepEqual(p.get('report-to'), ['csp']);
    assert.ok(!p.get('script-src')!.includes("'unsafe-eval'"));
    // Sign-in's helper iframe, and nothing else, may be framed.
    assert.deepEqual(p.get('frame-src'), ['https://sikhai.firebaseapp.com']);
    // Analytics and Firebase can load and connect.
    assert.ok(p.get('script-src')!.includes('https://*.googletagmanager.com'));
    assert.ok(p.get('script-src')!.includes('https://apis.google.com'));
    assert.ok(p.get('connect-src')!.includes('https://*.googleapis.com'));
    assert.ok(!p.get('connect-src')!.some((s) => s.includes('vercel.live')), 'no preview toolbar in production');
});

test('next dev and previews get only what they need on top', () => {
    const dev = parse(contentSecurityPolicy({ dev: true, preview: false }));
    assert.ok(dev.get('script-src')!.includes("'unsafe-eval'"));
    assert.ok(dev.get('connect-src')!.includes('ws:'));
    assert.deepEqual(dev.get('frame-src'), ["'none'"], 'no auth domain configured: nothing may be framed');
    const preview = parse(contentSecurityPolicy({ dev: false, preview: true }));
    assert.ok(preview.get('script-src')!.includes('https://vercel.live'));
    assert.ok(preview.get('frame-src')!.includes('https://vercel.live'));
    assert.ok(!preview.get('script-src')!.includes("'unsafe-eval'"));
});
