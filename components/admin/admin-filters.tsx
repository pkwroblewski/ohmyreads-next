"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buildAdminQuery, type AdminParams } from "@/lib/admin/search-params";

/**
 * The filter controls for the admin list pages. Each one writes its value into
 * the URL, so the server component re-renders with new data and the filter
 * state survives a reload, a share, and the back button.
 *
 * They take the current params as a prop rather than calling
 * `useSearchParams()`: the server page has already parsed them, and passing
 * them down keeps these islands free of the Suspense boundary that hook
 * otherwise requires.
 */

interface AdminSearchInputProps {
  pathname: string;
  params: AdminParams;
  placeholder?: string;
  /** Param to write. Defaults to `search`. */
  name?: string;
}

export function AdminSearchInput({
  pathname,
  params,
  placeholder = "Search...",
  name = "search",
}: AdminSearchInputProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [value, setValue] = useState(params[name] ?? "");

  // Debounce so a typed query is one navigation, not one per keystroke. The
  // 300ms matches the debounce the client-fetching version used.
  useEffect(() => {
    const current = params[name] ?? "";
    if (value === current) return;

    const timer = setTimeout(() => {
      startTransition(() => {
        // Any change to the query resets to page 1 — page 4 of the old result
        // set is meaningless against the new one.
        router.replace(
          `${pathname}${buildAdminQuery(params, { [name]: value, page: undefined })}`,
          { scroll: false }
        );
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [value, params, name, pathname, router]);

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="pl-9"
      />
      {isPending && (
        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
      )}
    </div>
  );
}

interface AdminSelectFilterProps {
  pathname: string;
  params: AdminParams;
  /** Param this select writes. */
  name: string;
  value: string;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
  /**
   * Value treated as "no filter": selecting it removes the param instead of
   * writing it, so the default state leaves a clean URL.
   */
  defaultValue?: string;
  /** Whether changing this filter should return to page 1. Default true. */
  resetsPage?: boolean;
}

export function AdminSelectFilter({
  pathname,
  params,
  name,
  value,
  options,
  placeholder,
  className = "w-[150px]",
  defaultValue,
  resetsPage = true,
}: AdminSelectFilterProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const onValueChange = (next: string) => {
    startTransition(() => {
      router.replace(
        `${pathname}${buildAdminQuery(params, {
          [name]: next === defaultValue ? undefined : next,
          ...(resetsPage ? { page: undefined } : {}),
        })}`,
        { scroll: false }
      );
    });
  };

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
