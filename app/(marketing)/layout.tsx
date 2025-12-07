export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Navbar slot */}
      <header className="border-b">
        <nav className="container mx-auto px-4 py-4">
          {/* Navbar content */}
        </nav>
      </header>

      {/* Main content */}
      <main className="flex-1">{children}</main>

      {/* Footer slot */}
      <footer className="border-t">
        <div className="container mx-auto px-4 py-4">
          {/* Footer content */}
        </div>
      </footer>
    </div>
  );
}

