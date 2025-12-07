export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 border-r">
        {/* Sidebar content */}
      </aside>

      {/* Main content */}
      <main className="flex-1">{children}</main>
    </div>
  );
}

