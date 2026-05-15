import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  startAfter,
  type QueryConstraint,
  type QueryDocumentSnapshot,
  type DocumentData,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { SearchResult, SearchOptions, Suggestion, SmartSuggestion } from "@shared/schema";
import { getTrendingSearches } from "@/services/searchAnalyticsService";

const SEARCH_INDEX_COLLECTION = "searchIndex";
const CATEGORIES_COLLECTION = "categories";
const RECENT_SEARCHES_KEY = "pakCart_recentSearches";
const MAX_RECENT_SEARCHES = 5;

interface RawIndexEntry {
  productId: string;
  name: string;
  nameLower: string;
  nameTokens: string[];
  categoryName: string;
  categorySlug: string;
  parentCategoryName: string;
  price: number;
  primaryImage: string;
  slug: string;
  labels: string[];
  inStock: boolean;
  active: boolean;
  rating: number;
  reviewCount: number;
  searchScore: number;
}

export interface PagedSearchResult {
  results: SearchResult[];
  cursor: QueryDocumentSnapshot<DocumentData> | null;
}

function getLongestWord(words: string[]): string {
  return words.reduce((a, b) => (a.length >= b.length ? a : b), "");
}

function computeRelevanceScore(
  entry: Pick<RawIndexEntry, "searchScore" | "nameLower" | "nameTokens">,
  queryLower: string,
  queryWords: string[]
): number {
  let score = entry.searchScore;

  if (entry.nameLower === queryLower) score += 100;
  else if (entry.nameLower.startsWith(queryLower)) score += 50;

  for (const word of queryWords) {
    if (entry.nameTokens.includes(word)) score += 10;
  }

  return score;
}

function countMatchedKeywords(nameTokens: string[], queryWords: string[]): number {
  return queryWords.filter((word) =>
    nameTokens.some((token) => token === word || token.startsWith(word))
  ).length;
}

function getKeywordTier(matchCount: number): number {
  if (matchCount >= 5) return 1;
  if (matchCount >= 3) return 2;
  return 3;
}

function sanitizeQuery(raw: string): string {
  return raw
    .trim()
    .replace(/[<>{}[\]\\^`|]/g, "")
    .substring(0, 100);
}

/**
 * Build plural/singular variants for a single token word.
 * Used to widen the Firestore array-contains-any search so that
 * e.g. "bags" matches products whose nameTokens contain "bag",
 * and "watch" matches products with "watches".
 */
function buildWordVariants(word: string): string[] {
  const v = new Set<string>([word]);

  if (word.endsWith("es") && word.length > 3) {
    v.add(word.slice(0, -2)); // "watches" → "watch"
    v.add(word.slice(0, -1)); // "watches" → "watche" (edge-case singulars)
  }
  if (word.endsWith("s") && word.length > 2) {
    v.add(word.slice(0, -1)); // "bags" → "bag"
  }
  if (!word.endsWith("s")) {
    v.add(word + "s");  // "bag" → "bags"
    v.add(word + "es"); // "watch" → "watches"
  }

  return [...v].slice(0, 10); // Firestore array-contains-any max is 10
}

export async function searchProducts(
  rawQuery: string,
  options: SearchOptions = {}
): Promise<SearchResult[]> {
  const { results } = await searchProductsPage(rawQuery, { ...options, pageSize: options.limit ?? 20 });
  return results;
}

export async function searchProductsPage(
  rawQuery: string,
  options: SearchOptions & {
    cursor?: QueryDocumentSnapshot<DocumentData> | null;
    pageSize?: number;
  } = {}
): Promise<PagedSearchResult> {
  const {
    pageSize = 20,
    sortBy = "relevance",
    categorySlug,
    minPrice,
    maxPrice,
    inStockOnly = false,
    cursor,
  } = options;

  const queryLower = sanitizeQuery(rawQuery).toLowerCase();
  if (!queryLower) return { results: [], cursor: null };

  const queryWords = queryLower.split(/\s+/).filter((w) => w.length > 0);
  const anchorWord = getLongestWord(queryWords);
  const anchorVariants = buildWordVariants(anchorWord);

  const baseConstraints: QueryConstraint[] = [
    where("nameTokens", "array-contains-any", anchorVariants),
    where("active", "==", true),
  ];

  if (categorySlug) {
    baseConstraints.push(where("categorySlug", "==", categorySlug));
  }

  if (sortBy === "price_asc") {
    baseConstraints.push(orderBy("price", "asc"));
  } else if (sortBy === "price_desc") {
    baseConstraints.push(orderBy("price", "desc"));
  } else {
    baseConstraints.push(orderBy("searchScore", "desc"));
  }

  if (cursor) {
    baseConstraints.push(startAfter(cursor));
  }

  baseConstraints.push(limit(pageSize * 5));

  const q = query(collection(db, SEARCH_INDEX_COLLECTION), ...baseConstraints);
  const snap = await getDocs(q);

  let entries = snap.docs.map((d) => ({
    doc: d,
    data: d.data() as RawIndexEntry,
  }));

  if (inStockOnly) {
    entries = entries.filter(({ data }) => data.inStock);
  }

  if (minPrice !== undefined) {
    entries = entries.filter(({ data }) => data.price >= minPrice);
  }
  if (maxPrice !== undefined) {
    entries = entries.filter(({ data }) => data.price <= maxPrice);
  }

  const results: (SearchResult & { _doc: QueryDocumentSnapshot<DocumentData>; _keywordTier: number })[] =
    entries.map(({ doc, data }) => {
      const matchedCount = countMatchedKeywords(data.nameTokens, queryWords);
      return {
        _doc: doc,
        _keywordTier: getKeywordTier(matchedCount),
        productId: data.productId,
        name: data.name,
        slug: data.slug,
        price: data.price,
        primaryImage: data.primaryImage,
        categoryName: data.categoryName,
        categorySlug: data.categorySlug,
        rating: data.rating,
        reviewCount: data.reviewCount,
        labels: data.labels,
        inStock: data.inStock,
        relevanceScore: computeRelevanceScore(data, queryLower, queryWords),
      };
    });

  if (sortBy === "relevance") {
    results.sort((a, b) => {
      const tierDiff = a._keywordTier - b._keywordTier;
      if (tierDiff !== 0) return tierDiff;
      return b.relevanceScore - a.relevanceScore;
    });
  } else if (sortBy === "rating") {
    results.sort((a, b) => {
      const tierDiff = a._keywordTier - b._keywordTier;
      if (tierDiff !== 0) return tierDiff;
      return b.rating - a.rating;
    });
  }

  const pageResults = results.slice(0, pageSize);
  const lastDoc =
    pageResults.length === pageSize
      ? pageResults[pageResults.length - 1]._doc
      : null;

  const cleanResults: SearchResult[] = pageResults.map(
    ({ _doc: _unused, _keywordTier: _tier, ...rest }) => rest
  );

  return { results: cleanResults, cursor: lastDoc };
}

function buildQueryVariants(queryLower: string): Set<string> {
  const variants = new Set<string>([queryLower]);
  if (queryLower.endsWith("s") && queryLower.length > 2) {
    variants.add(queryLower.slice(0, -1));
  } else {
    variants.add(queryLower + "s");
  }
  if (queryLower.endsWith("es") && queryLower.length > 3) {
    variants.add(queryLower.slice(0, -2));
  }
  return variants;
}

function matchesQuery(text: string, variants: Set<string>): boolean {
  const t = text.toLowerCase();
  for (const v of variants) if (t.includes(v)) return true;
  return false;
}

export async function getSuggestions(rawQuery: string): Promise<Suggestion[]> {
  const queryLower = rawQuery.toLowerCase().trim();
  if (queryLower.length < 2) return [];

  const queryWords = queryLower.split(/\s+/).filter((w) => w.length > 0);
  const anchorWord = getLongestWord(queryWords);
  const anchorVariants = buildWordVariants(anchorWord);
  const queryVariants = buildQueryVariants(queryLower);
  const emptyDocs: QueryDocumentSnapshot<DocumentData>[] = [];

  const indexQuery = query(
    collection(db, SEARCH_INDEX_COLLECTION),
    where("nameTokens", "array-contains-any", anchorVariants),
    where("active", "==", true),
    orderBy("searchScore", "desc"),
    limit(30)
  );

  const categoryQuery = query(
    collection(db, CATEGORIES_COLLECTION),
    limit(30)
  );

  const [indexSnap, categorySnap] = await Promise.all([
    getDocs(indexQuery).catch(() => ({ docs: emptyDocs })),
    getDocs(categoryQuery).catch(() => ({ docs: emptyDocs })),
  ]);

  type ScoredSuggestion = Suggestion & { _score: number };

  const productSuggestions: Suggestion[] = (
    indexSnap.docs
      .map((d): ScoredSuggestion | null => {
        const data = d.data() as RawIndexEntry;
        const name: string = data.name ?? "";
        if (!matchesQuery(name, queryVariants)) return null;
        const isBestSeller = Array.isArray(data.labels) && data.labels.includes("Best Seller");
        const score =
          computeRelevanceScore(data, queryLower, queryWords) +
          (isBestSeller ? 50 : 0) +
          (data.inStock ? 20 : 0);
        return {
          text: name,
          type: "product" as const,
          slug: data.slug,
          image: data.primaryImage ?? "",
          _score: score,
        };
      })
      .filter((s): s is ScoredSuggestion => s !== null)
      .sort((a, b) => b._score - a._score)
      .slice(0, 5)
      .map(({ _score: _s, ...s }) => s)
  );

  const categorySuggestions: Suggestion[] = categorySnap.docs
    .filter((d) => matchesQuery(d.data().name ?? "", queryVariants))
    .map((d) => {
      const data = d.data();
      return {
        text: data.name as string,
        type: "category" as const,
        slug: data.slug as string,
      };
    })
    .slice(0, 3);

  return [...productSuggestions, ...categorySuggestions].slice(0, 7);
}

export async function getPopularSearches(): Promise<string[]> {
  try {
    const trending = await getTrendingSearches(8);
    if (trending.length >= 3) {
      return trending.map((t) => t.query);
    }
  } catch {
    // fall through to category fallback
  }

  const snap = await getDocs(collection(db, CATEGORIES_COLLECTION)).catch(
    () => ({ docs: [] as QueryDocumentSnapshot<DocumentData>[] })
  );

  return snap.docs
    .map((d) => d.data().name as string)
    .filter(Boolean)
    .slice(0, 8);
}

export function getRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_RECENT_SEARCHES) : [];
  } catch {
    return [];
  }
}

export function saveRecentSearch(rawQuery: string): void {
  const q = rawQuery.trim();
  if (!q) return;
  try {
    const existing = getRecentSearches();
    const filtered = existing.filter(
      (s) => s.toLowerCase() !== q.toLowerCase()
    );
    const updated = [q, ...filtered].slice(0, MAX_RECENT_SEARCHES);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
  } catch {
    // ignore localStorage errors in restricted environments
  }
}

export function clearRecentSearchesStorage(): void {
  try {
    localStorage.removeItem(RECENT_SEARCHES_KEY);
  } catch {
    // ignore
  }
}

// ── Levenshtein distance — pure TypeScript, no libraries ──────────────────────
export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (__, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

// ── Smart No-Results Fallback ─────────────────────────────────────────────────
export async function getSmartSuggestions(failedQuery: string): Promise<SmartSuggestion> {
  const q = failedQuery.toLowerCase().trim();
  const words = q.split(/\s+/).filter((w) => w.length > 0);
  const anchorVariants = words[0] ? buildWordVariants(words[0]) : [];

  const [trending, relatedSnap, categoriesSnap] = await Promise.allSettled([
    getTrendingSearches(5),
    anchorVariants.length > 0
      ? getDocs(
          query(
            collection(db, SEARCH_INDEX_COLLECTION),
            where("nameTokens", "array-contains-any", anchorVariants),
            where("active", "==", true),
            orderBy("searchScore", "desc"),
            limit(8)
          )
        )
      : Promise.resolve({ docs: [] as QueryDocumentSnapshot<DocumentData>[] }),
    getDocs(collection(db, CATEGORIES_COLLECTION)),
  ]);

  const trendingNow =
    trending.status === "fulfilled"
      ? trending.value.map((t) => t.query)
      : [];

  const relatedProducts: SearchResult[] =
    relatedSnap.status === "fulfilled"
      ? (relatedSnap.value as { docs: QueryDocumentSnapshot<DocumentData>[] }).docs.map((d) => {
          const data = d.data() as RawIndexEntry;
          return {
            productId: data.productId,
            name: data.name,
            slug: data.slug,
            price: data.price,
            primaryImage: data.primaryImage,
            categoryName: data.categoryName,
            categorySlug: data.categorySlug,
            rating: data.rating,
            reviewCount: data.reviewCount,
            labels: data.labels,
            inStock: data.inStock,
            relevanceScore: data.searchScore,
          };
        })
      : [];

  const relatedCategories: Array<{ id: string; name: string; slug: string }> = [];
  if (categoriesSnap.status === "fulfilled") {
    for (const d of (categoriesSnap.value as { docs: QueryDocumentSnapshot<DocumentData>[] }).docs) {
      const data = d.data();
      const catName: string = (data.name ?? "").toLowerCase();
      if (words.some((w) => catName.includes(w))) {
        relatedCategories.push({
          id: d.id,
          name: data.name as string,
          slug: data.slug as string,
        });
      }
    }
  }

  let correctedQuery: string | undefined;
  for (const t of trendingNow) {
    const dist = levenshteinDistance(q, t);
    if (dist <= 2 && dist > 0) {
      correctedQuery = t;
      break;
    }
  }

  return { correctedQuery, relatedProducts, relatedCategories, trendingNow };
}
