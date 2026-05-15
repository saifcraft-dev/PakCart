import { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getSuggestions,
  getPopularSearches,
  getRecentSearches,
  saveRecentSearch,
  clearRecentSearchesStorage,
} from "@/services/searchService";
import type { Suggestion } from "@shared/schema";

function sanitizeInput(raw: string): string {
  return raw
    .replace(/[<>{}[\]\\^`|]/g, "")
    .substring(0, 100);
}

export function useSearch() {
  const [query, setQueryRaw] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>(() =>
    getRecentSearches()
  );
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);

  const queryClient = useQueryClient();

  const setQuery = useCallback((val: string) => {
    setQueryRaw(sanitizeInput(val));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
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
    prefetchDropdown,
    popularSearches,
    recentSearches,
    clearRecentSearches,
    saveSearch,
    selectedSuggestionIndex,
    setSelectedSuggestionIndex,
  };
}
