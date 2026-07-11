"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";
import { ParsedWorkbookResult } from "../types/inventory";

interface InventoryDataContextType {
  parsedResult: ParsedWorkbookResult | null;
  setParsedResult: (result: ParsedWorkbookResult | null) => void;
  isParsing: boolean;
  setIsParsing: (val: boolean) => void;
}

const InventoryDataContext = createContext<InventoryDataContextType | undefined>(undefined);

export function InventoryDataProvider({ children }: { children: ReactNode }) {
  const [parsedResult, setParsedResult] = useState<ParsedWorkbookResult | null>(null);
  const [isParsing, setIsParsing] = useState(false);

  return (
    <InventoryDataContext.Provider
      value={{
        parsedResult,
        setParsedResult,
        isParsing,
        setIsParsing,
      }}
    >
      {children}
    </InventoryDataContext.Provider>
  );
}

export function useInventoryData() {
  const context = useContext(InventoryDataContext);
  if (context === undefined) {
    throw new Error("useInventoryData must be used within an InventoryDataProvider");
  }
  return context;
}
