import { createContext, useContext, useState, useEffect } from "react";
import { useLocation } from "wouter";

interface DrawerContextType {
  open: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
}

const DrawerContext = createContext<DrawerContextType>({
  open: false,
  openDrawer: () => {},
  closeDrawer: () => {},
});

export function DrawerProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [location] = useLocation();

  useEffect(() => {
    setOpen(false);
  }, [location]);

  return (
    <DrawerContext.Provider value={{ open, openDrawer: () => setOpen(true), closeDrawer: () => setOpen(false) }}>
      {children}
    </DrawerContext.Provider>
  );
}

export const useDrawer = () => useContext(DrawerContext);
