import { useState } from "react";
import { Drawer } from "./Drawer";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Drawer open={open} onClose={() => setOpen(false)} onOpen={() => setOpen(true)} />
      <main className="flex-1 min-h-screen overflow-y-auto pt-14 lg:pt-14 lg:pl-64">
        {children}
      </main>
    </div>
  );
}
