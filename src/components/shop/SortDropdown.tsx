"use client";
import { useEffect, useState } from "react";
import Dropdown from "../ui/Dropdown";
import { ArrowUpDown } from "lucide-react";
import { type CatalogSortValue } from "@/lib/catalogQueryParams";

type Props = {
  value?: CatalogSortValue;
  onChange?: (v: CatalogSortValue) => void;
};

export default function SortDropdown({ value: externalValue, onChange: externalOnChange }: Props = {}) {
  const [value, setValue] = useState(externalValue ?? "featured");

  useEffect(() => {
    if (externalValue !== undefined && externalValue !== value) {
      setValue(externalValue);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalValue]);

  const options = [
    { value: "featured", label: "Featured" },
    { value: "low-to-high", label: "Price: Low to High" },
    { value: "high-to-low", label: "Price: High to Low" },
    { value: "newest", label: "Newest" },
    { value: "best-selling", label: "Best Selling" }
  ];

  function handleChange(v: string) {
    const nextValue = v as CatalogSortValue;
    setValue(nextValue);
    externalOnChange?.(nextValue);
  }

  return (
    <Dropdown
      label="Sort products"
      options={options}
      value={value}
      onChange={handleChange}
      leadingIcon={<ArrowUpDown size={15} strokeWidth={2} />}
    />
  );
}
