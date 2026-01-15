import React from 'react';

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