import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  increment,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { TrendingSearch, ZeroResultQuery } from "@shared/schema";

const ANALYTICS_COLLECTION = "searchAnalytics";
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export async function logSearch(rawQuery: string, resultsCount: number): Promise<void> {
  const q = rawQuery.toLowerCase().trim();
  if (!q) return;

  const hasResults = resultsCount > 0;
  const docRef = doc(collection(db, ANALYTICS_COLLECTION), encodeDocId(q));

  try {
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      await updateDoc(docRef, {
        count: increment(1),
        lastSearched: serverTimestamp(),
        resultsCount,
        hasResults,
      });
    } else {
      await setDoc(docRef, {
        query: q,
        count: 1,
        lastSearched: serverTimestamp(),
        resultsCount,
        hasResults,
      });
    }
  } catch {
    // fire-and-forget — silently swallow errors so search UX is never blocked
  }
}

export async function getTrendingSearches(limitCount: number = 10): Promise<TrendingSearch[]> {
  try {
    const sevenDaysAgo = Timestamp.fromMillis(Date.now() - SEVEN_DAYS_MS);

    // Fetch by count desc — single-field index auto-created by Firestore, no composite index needed.
    // Filter hasResults and recency client-side to avoid needing a composite index.
    const q = query(
      collection(db, ANALYTICS_COLLECTION),
      orderBy("count", "desc"),
      limit(limitCount * 3)
    );

    const snap = await getDocs(q);

    return snap.docs
      .map((d) => d.data())
      .filter(
        (d) =>
          d.hasResults === true &&
          d.lastSearched instanceof Timestamp &&
          d.lastSearched.toMillis() >= sevenDaysAgo.toMillis()
      )
      .slice(0, limitCount)
      .map((d) => ({ query: d.query as string, count: d.count as number }));
  } catch {
    return [];
  }
}

export async function getZeroResultQueries(limitCount: number = 20): Promise<ZeroResultQuery[]> {
  try {
    const q = query(
      collection(db, ANALYTICS_COLLECTION),
      where("hasResults", "==", false),
      orderBy("count", "desc"),
      limit(limitCount)
    );

    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        query: data.query as string,
        count: data.count as number,
        lastSearched: data.lastSearched,
      };
    });
  } catch {
    return [];
  }
}

export async function getAnalyticsSummary(): Promise<{
  totalUnique: number;
  todayCount: number;
  zeroResultRate: number;
  topTrending: TrendingSearch[];
}> {
  try {
    const allSnap = await getDocs(collection(db, ANALYTICS_COLLECTION));
    const all = allSnap.docs.map((d) => d.data());

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayTimestamp = Timestamp.fromDate(todayStart);

    const todayCount = all.filter((d) => {
      const ts = d.lastSearched as Timestamp;
      return ts && ts.toMillis && ts.toMillis() >= todayTimestamp.toMillis();
    }).length;

    const zeroResultCount = all.filter((d) => d.hasResults === false).length;
    const zeroResultRate = all.length > 0 ? (zeroResultCount / all.length) * 100 : 0;

    const topTrending = await getTrendingSearches(5);

    return {
      totalUnique: all.length,
      todayCount,
      zeroResultRate,
      topTrending,
    };
  } catch {
    return { totalUnique: 0, todayCount: 0, zeroResultRate: 0, topTrending: [] };
  }
}

export async function getAllAnalyticsEntries(): Promise<
  Array<{ query: string; count: number; hasResults: boolean; lastSearched: Timestamp | null }>
> {
  try {
    const snap = await getDocs(
      query(collection(db, ANALYTICS_COLLECTION), orderBy("count", "desc"), limit(200))
    );
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        query: data.query as string,
        count: data.count as number,
        hasResults: data.hasResults as boolean,
        lastSearched: (data.lastSearched as Timestamp) ?? null,
      };
    });
  } catch {
    return [];
  }
}

function encodeDocId(q: string): string {
  return q.replace(/\//g, "_SLASH_").replace(/\./g, "_DOT_").substring(0, 128);
}
