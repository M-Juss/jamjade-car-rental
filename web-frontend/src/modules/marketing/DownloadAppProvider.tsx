"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import DownloadAppModal from "@/modules/marketing/DownloadAppModal";

type DownloadAppContextValue = {
  openDownloadApp: () => void;
};

const DownloadAppContext = createContext<DownloadAppContextValue | null>(null);

export function DownloadAppProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const openDownloadApp = useCallback(() => setIsOpen(true), []);

  return (
    <DownloadAppContext.Provider value={{ openDownloadApp }}>
      {children}
      <DownloadAppModal open={isOpen} onOpenChange={setIsOpen} />
    </DownloadAppContext.Provider>
  );
}

export function useDownloadApp() {
  const context = useContext(DownloadAppContext);
  if (!context) {
    throw new Error("useDownloadApp must be used within a DownloadAppProvider");
  }
  return context;
}
