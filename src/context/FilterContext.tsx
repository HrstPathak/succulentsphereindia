"use client";

import React, { createContext, useContext, useState } from "react";

export const PRICE_MIN = 0;
export const PRICE_MAX = 5000;

export interface SearchFilters {
  collections: string[];
  plantType: string[];
  careLevel: string[];
  potSize: string[];
  potMaterial: string[];
  availability: boolean;
  priceRange: {
    min: number;
    max: number;
  };
}

interface FilterContextType {
  filters: SearchFilters;
  setFilters: (filters: SearchFilters) => void;
}

const FilterContext = createContext<FilterContextType | undefined>(undefined);

export function FilterProvider({ children }: { children: React.ReactNode }) {
  const [filters, setFilters] = useState<SearchFilters>({
    collections: [],
    plantType: [],
    careLevel: [],
    potSize: [],
    potMaterial: [],
    availability: false,
    priceRange: { min: PRICE_MIN, max: PRICE_MAX },
  });

  return (
    <FilterContext.Provider value={{ filters, setFilters }}>
      {children}
    </FilterContext.Provider>
  );
}

export function useFilters() {
  const context = useContext(FilterContext);
  if (!context) {
    throw new Error("useFilters must be used within FilterProvider");
  }
  return context;
}
