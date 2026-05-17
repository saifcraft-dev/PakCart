import { useEffect, useRef, useId, useState } from "react";
import {
  Search,
  X,
  Clock,
  TrendingUp,
  ShoppingBag,
  AlertCircle,
  Tag,
  ArrowUpRight,
  Sparkles,
  Loader2,
} from "lucide-react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useSearch } from "@/hooks/use-search";
import { getOptimizedImageUrl } from "@/lib/cloudinary";
import { cn } from "@/lib/utils";
import { generateSmartSearchQuery } from "@/services/ai";
import { logSearch } from "@/services/searchAnalyticsService";

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SearchOverlay({ isOpen, onClose }: SearchOverlayProps) {
  const [, setLocation] = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);
  const overlayId = useId();
  const listboxId = `search-listbox-${overlayId}`;
  const liveRegionId = `search-live-${overlayId}`;
  const [isAISearching, setIsAISearching] = useState(false);

  const {
    query,
    setQuery,
    suggestions,
    isLoadingSuggestions,
    isSuggestionsError,
    popularSearches,
    recentSearches,
    clearRecentSearches,
    saveSearch,
    selectedSuggestionIndex,
    setSelectedSuggestionIndex,
    prefetchDropdown,
  } = useSearch();

  const isDropdownOpen =
    isOpen &&
    (query.length >= 1 || recentSearches.length > 0 || popularSearches.length > 0);

  const showSuggestions =
    query.length >= 2 && !isLoadingSuggestions && !isSuggestionsError && suggestions.length > 0;
  const showRecentSearches = query.length === 0 && recentSearches.length > 0;
  const showPopular = query.length === 0 && popularSearches.length > 0;

  const totalOptions = showSuggestions
    ? suggestions.length
    : showRecentSearches
    ? recentSearches.length
    : 0;

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 80);
      prefetchDropdown();
    } else {
      setQuery("");
      setSelectedSuggestionIndex(-1);
    }
  }, [isOpen, prefetchDropdown, setQuery, setSelectedSuggestionIndex]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedSuggestionIndex((i) => Math.min(i + 1, totalOptions - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedSuggestionIndex((i) => Math.max(i - 1, -1));
      } else if (e.key === "Enter") {
        if (selectedSuggestionIndex >= 0) {
          e.preventDefault();
          if (showSuggestions && suggestions[selectedSuggestionIndex]) {
            handleSuggestionClick(suggestions[selectedSuggestionIndex]);
          } else if (showRecentSearches && recentSearches[selectedSuggestionIndex]) {
            navigateToSearch(recentSearches[selectedSuggestionIndex]);
          }
        } else if (query.trim()) {
          e.preventDefault();
          navigateToSearch(query.trim());
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    isOpen,
    onClose,
    query,
    selectedSuggestionIndex,
    suggestions,
    recentSearches,
    showSuggestions,
    showRecentSearches,
    totalOptions,
  ]);

  const navigateToSearch = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    saveSearch(trimmed);
    setLocation(`/products?q=${encodeURIComponent(trimmed)}`);
    onClose();
  };

  const handleAISmartSearch = async () => {
    if (!query.trim() || isAISearching) return;
    setIsAISearching(true);
    try {
      const parsed = await generateSmartSearchQuery(query.trim());
      const aiQuery = parsed.keywords.join(" ");
      if (aiQuery) {
        const params = new URLSearchParams({ q: aiQuery });
        if (parsed.suggestedCategory) params.set("category", parsed.suggestedCategory);
        setLocation(`/products?${params.toString()}`);
        onClose();
      }
    } catch {
      navigateToSearch(query.trim());
    } finally {
      setIsAISearching(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) navigateToSearch(query.trim());
  };

  const handleSuggestionClick = (s: { text: string; type: string; slug?: string }) => {
    saveSearch(s.text);
    if (s.type === "product" && s.slug) {
      logSearch(query.trim() || s.text, 1);
      setLocation(`/products/${s.slug}`);
      onClose();
    } else if (s.type === "category" && s.slug) {
      logSearch(query.trim() || s.text, 1);
      setLocation(`/collections/${s.slug}`);
      onClose();
    } else {
      navigateToSearch(s.text);
    }
  };

  const thumbnailUrl = (url: string | undefined) =>
    url
      ? getOptimizedImageUrl(url, { width: 56, height: 56, crop: "fill", quality: "auto:low" })
      : null;

  const liveMessage = isLoadingSuggestions
    ? "Loading suggestions…"
    : suggestions.length > 0 && query.length >= 2
    ? `${suggestions.length} suggestion${suggestions.length !== 1 ? "s" : ""} available`
    : "";

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-40"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ y: -16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -16, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="fixed top-0 left-0 right-0 z-50 flex flex-col"
            style={{ maxHeight: "90dvh" }}
            data-testid="search-overlay"
          >
            {/* Top accent line */}
            <div className="h-[3px] shrink-0 bg-gradient-to-r from-green-500 to-emerald-400" />

            {/* Main card */}
            <div className="bg-white shadow-[0_8px_40px_rgba(0,0,0,0.12)] flex flex-col overflow-hidden">

              {/* Input section */}
              <div className="px-4 sm:px-8 pt-5 pb-4 shrink-0 max-w-3xl mx-auto w-full">

                {/* Live region */}
                <div
                  id={liveRegionId}
                  role="status"
                  aria-live="polite"
                  aria-atomic="true"
                  className="sr-only"
                >
                  {liveMessage}
                </div>

                <form onSubmit={handleSearch} role="search">
                  <div className="relative flex items-center">

                    {/* Left search icon */}
                    <div className="absolute left-4 pointer-events-none z-10">
                      <Search className="h-5 w-5 text-gray-400" aria-hidden="true" />
                    </div>

                    {/* Input */}
                    <input
                      ref={inputRef}
                      type="text"
                      role="combobox"
                      aria-expanded={isDropdownOpen}
                      aria-controls={listboxId}
                      aria-autocomplete="list"
                      aria-activedescendant={
                        selectedSuggestionIndex >= 0
                          ? `search-option-${selectedSuggestionIndex}`
                          : undefined
                      }
                      value={query}
                      onChange={(e) => {
                        setQuery(e.target.value);
                        setSelectedSuggestionIndex(-1);
                      }}
                      placeholder="Search bags, watches, slippers…"
                      className={cn(
                        "w-full",
                        "pl-12",
                        query.length > 0 ? "pr-28 sm:pr-36" : "pr-16",
                        "text-[15px] text-gray-800 font-normal",
                        "bg-gray-50/80 border border-gray-200 rounded-2xl",
                        "placeholder:text-gray-400 outline-none transition-all duration-200",
                        "focus:bg-white focus:border-green-400 focus:ring-3 focus:ring-green-100",
                        "shadow-sm"
                      )}
                      style={{ height: "52px" }}
                      data-testid="search-overlay-input"
                      autoComplete="off"
                      spellCheck={false}
                      inputMode="search"
                      enterKeyHint="search"
                    />

                    {/* Right controls */}
                    <div className="absolute right-2 flex items-center gap-1">
                      {query.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setQuery("");
                            setSelectedSuggestionIndex(-1);
                            inputRef.current?.focus();
                          }}
                          className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                          aria-label="Clear search"
                          data-testid="search-overlay-clear"
                        >
                          <X className="h-4 w-4" aria-hidden="true" />
                        </button>
                      )}

                      <button
                        type="submit"
                        aria-label="Search PakCart"
                        className="h-9 px-4 flex items-center gap-2 justify-center rounded-xl bg-green-600 hover:bg-green-700 active:scale-95 text-white text-sm font-semibold transition-all duration-150"
                        data-testid="search-overlay-submit"
                      >
                        <Search className="h-3.5 w-3.5 sm:hidden" aria-hidden="true" />
                        <span className="hidden sm:block">Search</span>
                        <span className="sm:hidden sr-only">Search</span>
                      </button>
                    </div>
                  </div>
                </form>
              </div>

              {/* Divider */}
              {isDropdownOpen && (
                <div className="h-px bg-gray-100 mx-4 sm:mx-8 shrink-0" />
              )}

              {/* Dropdown content */}
              <div
                id={listboxId}
                role="listbox"
                aria-label="Search suggestions"
                className={cn(
                  "overflow-y-auto overscroll-contain px-4 sm:px-8 max-w-3xl mx-auto w-full",
                  !isDropdownOpen && "hidden"
                )}
                style={{ maxHeight: "calc(90dvh - 90px)" }}
              >

                {/* Active query ≥ 2 chars */}
                {query.length >= 2 && (
                  <div className="py-3">
                    {isLoadingSuggestions && (
                      <div className="py-10 flex items-center justify-center gap-2.5 text-sm text-gray-400">
                        <Loader2 className="h-4 w-4 animate-spin text-green-500" aria-hidden="true" />
                        <span>Searching…</span>
                      </div>
                    )}

                    {isSuggestionsError && !isLoadingSuggestions && (
                      <div className="mt-2 py-3 flex items-center gap-2.5 text-sm text-amber-600 bg-amber-50 px-4 rounded-xl">
                        <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                        Couldn&apos;t load suggestions. Please try again.
                      </div>
                    )}

                    {showSuggestions && (
                      <div className="space-y-0.5">
                        {suggestions.map((s, idx) => {
                          const thumb = thumbnailUrl(s.image);
                          const isSelected = selectedSuggestionIndex === idx;
                          const isProduct = s.type === "product";
                          return (
                            <button
                              key={s.slug ? `${s.type}-${s.slug}` : `${s.type}-${s.text}`}
                              id={`search-option-${idx}`}
                              type="button"
                              role="option"
                              aria-selected={isSelected}
                              onClick={() => handleSuggestionClick(s)}
                              onMouseEnter={() => setSelectedSuggestionIndex(idx)}
                              className={cn(
                                "w-full flex items-center gap-3.5 px-3 py-2.5 rounded-xl transition-all text-left group",
                                isSelected
                                  ? "bg-green-50"
                                  : "hover:bg-gray-50"
                              )}
                              data-testid={`search-suggestion-${s.type}-${idx}`}
                            >
                              {/* Thumbnail */}
                              {isProduct ? (
                                thumb ? (
                                  <img
                                    src={thumb}
                                    alt=""
                                    aria-hidden="true"
                                    className="h-10 w-10 rounded-xl object-cover shrink-0 bg-gray-100 ring-1 ring-gray-200"
                                    loading="lazy"
                                    width={40}
                                    height={40}
                                  />
                                ) : (
                                  <span
                                    className="h-10 w-10 rounded-xl bg-gray-100 flex items-center justify-center shrink-0"
                                    aria-hidden="true"
                                  >
                                    <ShoppingBag className="h-4 w-4 text-gray-400" />
                                  </span>
                                )
                              ) : (
                                <span
                                  className="h-10 w-10 rounded-xl bg-green-50 flex items-center justify-center shrink-0 ring-1 ring-green-100"
                                  aria-hidden="true"
                                >
                                  <Tag className="h-4 w-4 text-green-600" />
                                </span>
                              )}

                              {/* Text */}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-800 truncate">
                                  {s.text}
                                </p>
                                <p className="text-xs text-gray-400 mt-0.5">
                                  {isProduct ? "Product" : "Category"}
                                </p>
                              </div>

                              <ArrowUpRight
                                className={cn(
                                  "h-4 w-4 shrink-0 transition-all duration-150",
                                  isSelected
                                    ? "text-green-500"
                                    : "text-gray-300 group-hover:text-gray-400"
                                )}
                                aria-hidden="true"
                              />
                            </button>
                          );
                        })}

                        {/* See all results */}
                        <button
                          type="button"
                          onClick={() => navigateToSearch(query.trim())}
                          className="w-full flex items-center justify-between gap-3 mt-1 px-4 py-3 rounded-xl bg-gray-50 hover:bg-green-50 border border-gray-100 hover:border-green-100 transition-all group"
                          data-testid="search-see-all-results"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-7 h-7 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
                              <Search className="h-3.5 w-3.5 text-green-600" aria-hidden="true" />
                            </div>
                            <span className="text-sm font-medium text-gray-700 truncate">
                              See all results for{" "}
                              <span className="font-semibold text-green-700">&ldquo;{query}&rdquo;</span>
                            </span>
                          </div>
                          <ArrowUpRight
                            className="h-4 w-4 text-gray-400 shrink-0 group-hover:text-green-500 transition-colors"
                            aria-hidden="true"
                          />
                        </button>
                      </div>
                    )}

                    {/* No suggestions */}
                    {!isLoadingSuggestions &&
                      !isSuggestionsError &&
                      suggestions.length === 0 &&
                      query.length >= 2 && (
                        <div className="py-10 text-center">
                          <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                            <Search className="h-6 w-6 text-gray-400" aria-hidden="true" />
                          </div>
                          <p className="text-sm font-semibold text-gray-700 mb-1">
                            No results for &ldquo;{query}&rdquo;
                          </p>
                          <p className="text-xs text-gray-400 mb-5">
                            Try a different keyword or let AI find the best match
                          </p>
                          <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={handleAISmartSearch}
                              disabled={isAISearching}
                              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition-all shadow-sm active:scale-95 disabled:opacity-60"
                              data-testid="search-ai-smart"
                            >
                              {isAISearching ? (
                                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                              ) : (
                                <Sparkles className="h-4 w-4" aria-hidden="true" />
                              )}
                              {isAISearching ? "Searching…" : "Try AI Smart Search"}
                            </button>
                            <button
                              type="button"
                              onClick={() => navigateToSearch(query.trim())}
                              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 text-sm font-medium transition-colors active:scale-95"
                              data-testid="search-no-results-browse"
                            >
                              Browse all products
                            </button>
                          </div>
                        </div>
                      )}
                  </div>
                )}

                {/* 1-char hint */}
                {query.length === 1 && (
                  <p className="text-sm text-gray-400 text-center py-8">
                    Keep typing to see suggestions…
                  </p>
                )}

                {/* Empty state: recents + popular */}
                {query.length === 0 && (
                  <div className="py-5 space-y-5">

                    {showRecentSearches && (
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-400 uppercase tracking-widest">
                            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                            Recent Searches
                          </span>
                          <button
                            type="button"
                            onClick={clearRecentSearches}
                            className="text-xs text-gray-400 hover:text-red-500 transition-colors font-medium"
                            data-testid="search-clear-recents"
                          >
                            Clear all
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {recentSearches.map((term, idx) => {
                            const isSelected = selectedSuggestionIndex === idx;
                            return (
                              <button
                                key={term}
                                id={`search-option-${idx}`}
                                type="button"
                                role="option"
                                aria-selected={isSelected}
                                onClick={() => navigateToSearch(term)}
                                onMouseEnter={() => setSelectedSuggestionIndex(idx)}
                                className={cn(
                                  "flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium border transition-all active:scale-95",
                                  isSelected
                                    ? "bg-green-600 text-white border-green-600"
                                    : "bg-white text-gray-600 border-gray-200 hover:border-green-300 hover:text-green-700 hover:bg-green-50"
                                )}
                                data-testid={`search-recent-${idx}`}
                              >
                                <Clock className="h-3 w-3 shrink-0 opacity-60" aria-hidden="true" />
                                <span className="max-w-[140px] sm:max-w-none truncate">{term}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {showPopular && (
                      <div>
                        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-3">
                          <TrendingUp className="h-3.5 w-3.5 text-green-500" aria-hidden="true" />
                          Trending Now
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {popularSearches.map((term) => (
                            <button
                              key={term}
                              type="button"
                              onClick={() => navigateToSearch(term)}
                              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium bg-white text-gray-700 border border-gray-200 hover:border-green-400 hover:text-green-700 hover:bg-green-50 transition-all duration-150 active:scale-95"
                              data-testid={`search-popular-${term.toLowerCase().replace(/\s+/g, "-")}`}
                            >
                              <ArrowUpRight className="h-3 w-3 text-green-500 shrink-0" aria-hidden="true" />
                              <span className="max-w-[160px] sm:max-w-none truncate">{term}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {!showRecentSearches && !showPopular && (
                      <p className="text-sm text-gray-400 text-center py-6">
                        Start typing to search products…
                      </p>
                    )}
                  </div>
                )}

              </div>

            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
