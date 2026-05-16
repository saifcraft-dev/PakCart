import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface ProfitRule {
  maxCostPrice: number;
  profit: number;
}

export interface ProfitRulesSettings {
  rules: ProfitRule[];
  categoryRules?: { [categoryId: string]: ProfitRule[] };
  updatedAt?: any;
}

const SETTINGS_COLLECTION = "settings";
const PROFIT_RULES_DOC = "profitRules";

const DEFAULT_RULES: ProfitRule[] = [
  { maxCostPrice: 1000, profit: 100 },
  { maxCostPrice: 2000, profit: 200 },
  { maxCostPrice: 3000, profit: 300 },
  { maxCostPrice: 4000, profit: 400 },
];

export const settingsFirestoreService = {
  async getProfitRules(): Promise<ProfitRulesSettings> {
    try {
      const docRef = doc(db, SETTINGS_COLLECTION, PROFIT_RULES_DOC);
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        const data = snapshot.data();
        const rules: ProfitRule[] = (data.rules ?? []).map((r: any) => ({
          maxCostPrice: r.maxCostPrice ?? r.maxWholesalePrice ?? 0,
          profit: r.profit ?? 0,
        }));
        const categoryRules: { [categoryId: string]: ProfitRule[] } = {};
        if (data.categoryRules) {
          for (const [catId, catRulesRaw] of Object.entries(data.categoryRules)) {
            categoryRules[catId] = (catRulesRaw as any[]).map((r: any) => ({
              maxCostPrice: r.maxCostPrice ?? 0,
              profit: r.profit ?? 0,
            }));
          }
        }
        return { ...data, rules, categoryRules } as ProfitRulesSettings;
      }
      return { rules: DEFAULT_RULES, categoryRules: {} };
    } catch (error: any) {
      console.error("Error getting profit rules:", error);
      return { rules: DEFAULT_RULES, categoryRules: {} };
    }
  },

  async saveProfitRules(rules: ProfitRule[], categoryRules?: { [categoryId: string]: ProfitRule[] }): Promise<void> {
    try {
      const docRef = doc(db, SETTINGS_COLLECTION, PROFIT_RULES_DOC);
      await setDoc(docRef, { rules, categoryRules: categoryRules ?? {}, updatedAt: serverTimestamp() });
    } catch (error: any) {
      console.error("Error saving profit rules:", error);
      throw error;
    }
  },

  calculateProfit(costPrice: number, rules: ProfitRule[]): number {
    const sorted = [...rules].sort((a, b) => a.maxCostPrice - b.maxCostPrice);
    for (const rule of sorted) {
      if (costPrice <= rule.maxCostPrice) {
        return rule.profit;
      }
    }
    return sorted[sorted.length - 1]?.profit ?? 0;
  },

  calculateProfitForCategory(
    costPrice: number,
    categoryId: string | undefined | null,
    settings: ProfitRulesSettings
  ): number {
    if (categoryId && settings.categoryRules?.[categoryId]?.length) {
      return this.calculateProfit(costPrice, settings.categoryRules[categoryId]);
    }
    return this.calculateProfit(costPrice, settings.rules);
  },
};
