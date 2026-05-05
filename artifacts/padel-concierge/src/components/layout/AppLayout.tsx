export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen overflow-y-auto pt-14 lg:pl-64">
      {children}
    </main>
  );
}
