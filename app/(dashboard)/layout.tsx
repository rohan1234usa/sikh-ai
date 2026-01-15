import React from 'react';

export const dynamic = 'force-dynamic';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <section className="dashboard-container">
      <main>{children}</main>
    </section>
  );
}