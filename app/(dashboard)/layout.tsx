export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <section className="dashboard-container">
      {/* You can add a Sidebar or Navbar here later */}
      <main>{children}</main>
    </section>
  );
}