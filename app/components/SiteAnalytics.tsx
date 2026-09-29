'use client';

import { useSyncExternalStore } from 'react';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { analyticsBeforeSend, analyticsState, subscribeAnalyticsChoice } from '@/lib/analytics';

const counted = () => analyticsState() === 'on';
// The server, and the page while it hydrates, can't know the visitor's
// choice: nothing loads until it's been read, just after.
const notYet = () => false;

// Vercel Web Analytics (visits) and Speed Insights (page speed), both Vercel's
// own, without cookies, and served from this site's address. Neither loads for
// a visitor who switched counting off on /privacy or whose browser sends
// Global Privacy Control; switched off mid-visit, the page views stop with the
// component and Speed Insights' beforeSend drops what its script still
// measures. Every event's address goes through lib/analytics.ts first, so a
// share link's ID never leaves the page.
export default function SiteAnalytics({ webAnalytics, speedInsights }: { webAnalytics: boolean; speedInsights: boolean }) {
    const on = useSyncExternalStore(subscribeAnalyticsChoice, counted, notYet);
    if (!on) return null;
    return (
        <>
            {webAnalytics && <Analytics beforeSend={analyticsBeforeSend} />}
            {speedInsights && <SpeedInsights beforeSend={analyticsBeforeSend} />}
        </>
    );
}
