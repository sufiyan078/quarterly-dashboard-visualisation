"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { ParsedWorkbookResult } from "../types/inventory";

interface InventoryDataContextType {
  parsedResult: ParsedWorkbookResult | null;
  setParsedResult: (result: ParsedWorkbookResult | null) => void;
  isParsing: boolean;
  setIsParsing: (val: boolean) => void;
}

const InventoryDataContext = createContext<InventoryDataContextType | undefined>(undefined);

export function InventoryDataProvider({ children }: { children: ReactNode }) {
  const [parsedResult, setParsedResultState] = useState<ParsedWorkbookResult | null>(null);
  const [isParsing, setIsParsing] = useState(false);

  // Load from sessionStorage on initial mount client-side
  useEffect(() => {
    try {
      const cached = sessionStorage.getItem("inv_parsed_result");
      if (cached) {
        setParsedResultState(JSON.parse(cached));
      }
    } catch (e) {
      console.error("Failed to load parsedResult from sessionStorage:", e);
    }
  }, []);

  const setParsedResult = (result: ParsedWorkbookResult | null) => {
    setParsedResultState(result);
    try {
      if (result) {
        sessionStorage.setItem("inv_parsed_result", JSON.stringify(result));
      } else {
        sessionStorage.removeItem("inv_parsed_result");
      }
    } catch (e) {
      console.error("Failed to save parsedResult to sessionStorage:", e);
    }
  };

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
