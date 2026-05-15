import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  searchProducts,
  getSuggestions,
  getPopularSearches,
  getRecentSearches,
  saveRecentSearch,
  clearRecentSearchesStorage,
} from "@/services/searchService";
import { logSearch } from "@/services/searchAnalyticsService";
import { useToast } from "@/hooks/use-toast";
import type { SearchResult, SearchOptions, Suggestion } from "@shared/schema";

function sanitizeInput(raw: string): string {
  return raw
    .replace(/[<>{}[\]\\^`|]/g, "")
    .substring(0, 100);
}

export function useSearch() {
  const [query, setQueryRaw] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isLoadingResults, setIsLoadingResults] = useState(false);
  const [isSearchError, setIsSearchError] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>(() =>
    getRecentSearches()
  );
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const searchIdRef = useRef(0);
  const lastSearchTimeRef = useRef(0);

  const setQuery = useCallback((val: string) => {
    setQueryRaw(sanitizeInput(val));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
      setSelectedSuggestionIndex(-1);
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  const {
    data: suggestions = [],
    isLoading: isLoadingSuggestions,
    isError: isSuggestionsError,
  } = useQuery<Suggestion[]>({
    queryKey: ["search-suggestions", debouncedQuery],
    queryFn: () => getSuggestions(debouncedQuery),
    enabled: debouncedQuery.length >= 2,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * Math.pow(2, attempt), 5000),
  });

  const { data: popularSearches = [] } = useQuery<string[]>({
    queryKey: ["search-popular"],
    queryFn: getPopularSearches,
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * Math.pow(2, attempt), 5000),
  });

  const prefetchDropdown = useCallback(() => {
    queryClient.prefetchQuery({
      queryKey: ["search-popular"],
      queryFn: getPopularSearches,
      staleTime: 10 * 60_000,
    });
  }, [queryClient]);

  const performSearch = useCallback(
    async (searchQuery: string, options?: SearchOptions) => {
      const q = searchQuery.trim();
      if (!q) return;

      const now = Date.now();
      if (now - lastSearchTimeRef.current < 500) return;
      lastSearchTimeRef.current = now;

      const requestId = ++searchIdRef.current;

      setIsLoadingResults(true);
      setIsSearchError(false);
      setIsDropdownOpen(false);
      saveRecentSearch(q);
      setRecentSearches(getRecentSearches());

      const t0 = performance.now();

      try {
        const results = await searchProducts(q, options);

        if (requestId !== searchIdRef.current) return;

        setSearchResults(results);
        setIsSearchError(false);

        if (import.meta.env.DEV) {
          const elapsed = (performance.now() - t0).toFixed(0);
          console.log(`[Search perf] "${q}" → ${results.length} results in ${elapsed}ms`);
        }

        logSearch(q, results.length);
      } catch (err: unknown) {
        if (requestId !== searchIdRef.current) return;

        setIsSearchError(true);

        const code = (err as { code?: string })?.code;
        if (code === "resource-exhausted") {
          toast({
            title: "High traffic",
            description:
              "PakCart search is experiencing high traffic. Please try again in a moment.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Search unavailable",
            description:
              "Search is temporarily unavailable. Please check your connection.",
            variant: "destructive",
          });
        }

        if (import.meta.env.DEV) console.error("[Search] error:", err);
      } finally {
        if (requestId === searchIdRef.current) {
          setIsLoadingResults(false);
        }
      }
    },
    [toast]
  );

  const clearRecentSearches = useCallback(() => {
    clearRecentSearchesStorage();
    setRecentSearches([]);
  }, []);

  const saveSearch = useCallback((q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    saveRecentSearch(trimmed);
    setRecentSearches(getRecentSearches());
  }, []);

  return {
    query,
    setQuery,
    debouncedQuery,
    suggestions,
    isLoadingSuggestions,
    isSuggestionsError,
    searchResults,
    isLoadingResults,
    isSearchError,
    performSearch,
    prefetchDropdown,
    popularSearches,
    recentSearches,
    clearRecentSearches,
    saveSearch,
    selectedSuggestionIndex,
    setSelectedSuggestionIndex,
    isDropdownOpen,
    setIsDropdownOpen,
  };
}
