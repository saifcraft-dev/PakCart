import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { settingsFirestoreService, type ProfitRule, type ProfitRulesSettings } from "@/services/settingsFirestoreService";
import { categoryFirestoreService } from "@/services/categoryFirestoreService";
import { type Category } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2, Save, Plus, Trash2, TrendingUp, Info, Calculator,
  ChevronRight, AlertCircle, CheckCircle2, Zap, BarChart3, RefreshCw,
  Globe, Tag, X, FolderOpen
} from "lucide-react";
import SEO from "@/components/SEO";

const TIER_COLORS = [
  { bg: "bg-violet-50 border-violet-200", badge: "bg-violet-100 text-violet-700", dot: "bg-violet-500", text: "text-violet-700" },
  { bg: "bg-blue-50 border-blue-200",     badge: "bg-blue-100 text-blue-700",     dot: "bg-blue-500",   text: "text-blue-700"   },
  { bg: "bg-emerald-50 border-emerald-200", badge: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500", text: "text-emerald-700" },
  { bg: "bg-amber-50 border-amber-200",   badge: "bg-amber-100 text-amber-700",   dot: "bg-amber-500",  text: "text-amber-700"  },
  { bg: "bg-rose-50 border-rose-200",     badge: "bg-rose-100 text-rose-700",     dot: "bg-rose-500",   text: "text-rose-700"   },
  { bg: "bg-cyan-50 border-cyan-200",     badge: "bg-cyan-100 text-cyan-700",     dot: "bg-cyan-500",   text: "text-cyan-700"   },
];

function getTier(i: number) { return TIER_COLORS[i % TIER_COLORS.length]; }
function marginPct(cost: number, profit: number) {
  if (!cost) return "0";
  return ((profit / cost) * 100).toFixed(1);
}
function rangeLabel(rule: ProfitRule, i: number, sorted: ProfitRule[]) {
  const from = i === 0 ? 0 : sorted[i - 1].maxCostPrice + 1;
  return `Rs. ${from.toLocaleString()} – Rs. ${rule.maxCostPrice.toLocaleString()}`;
}

const DEFAULT_NEW_RULES: ProfitRule[] = [
  { maxCostPrice: 1000, profit: 150 },
  { maxCostPrice: 2000, profit: 300 },
  { maxCostPrice: 3000, profit: 450 },
];

// ─── Rules Editor sub-component ──────────────────────────────────────────────
function RulesEditor({
  rules,
  onChange,
  simulatorCatId,
}: {
  rules: ProfitRule[];
  onChange: (updated: ProfitRule[]) => void;
  simulatorCatId?: string | null;
}) {
  const [simCost, setSimCost] = useState("");
  const sorted = [...rules].sort((a, b) => a.maxCostPrice - b.maxCostPrice);
  const maxProfit = Math.max(...sorted.map(r => r.profit), 1);

  const simResult = useMemo(() => {
    const cost = parseFloat(simCost);
    if (!simCost || isNaN(cost) || cost < 0) return null;
    const profit = settingsFirestoreService.calculateProfit(cost, sorted);
    const matchedIndex = sorted.findIndex(r => cost <= r.maxCostPrice);
    return { cost, profit, selling: cost + profit, matchedIndex };
  }, [simCost, sorted]);

  const handleChange = (index: number, field: keyof ProfitRule, value: string) => {
    onChange(rules.map((r, i) => i === index ? { ...r, [field]: Number(value) } : r));
  };

  const handleAdd = () => {
    const last = sorted[sorted.length - 1];
    onChange([...rules, { maxCostPrice: (last?.maxCostPrice ?? 0) + 1000, profit: (last?.profit ?? 0) + 100 }]);
  };

  const handleRemove = (index: number) => {
    onChange(rules.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      {/* Simulator */}
      <div className="rounded-xl border border-primary/25 bg-primary/5 p-4 space-y-3">
        <p className="text-xs font-semibold text-primary flex items-center gap-1.5 uppercase tracking-wide">
          <Calculator className="h-3.5 w-3.5" /> Live Price Simulator
        </p>
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative w-44">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">Rs.</span>
            <Input
              type="number" min={0} placeholder="Enter cost price"
              value={simCost} onChange={e => setSimCost(e.target.value)}
              className="pl-10 h-9 font-mono text-sm"
              data-testid="input-simulator-cost"
            />
          </div>
          {simResult ? (
            <div className="flex flex-wrap items-center gap-1.5 text-sm">
              <span className="px-2.5 py-1 rounded-lg bg-background border text-xs font-mono">
                Rs. {simResult.cost.toLocaleString()}
              </span>
              <Plus className="h-3 w-3 text-muted-foreground" />
              <span className="px-2.5 py-1 rounded-lg bg-green-50 border border-green-200 text-green-700 text-xs font-mono">
                +Rs. {simResult.profit.toLocaleString()} ({marginPct(simResult.cost, simResult.profit)}%)
              </span>
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
              <span className="px-2.5 py-1 rounded-lg bg-primary text-primary-foreground text-xs font-bold flex items-center gap-1">
                <Zap className="h-3 w-3" /> Rs. {simResult.selling.toLocaleString()}
              </span>
              {simResult.matchedIndex >= 0 && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <div className={`h-2 w-2 rounded-full ${getTier(simResult.matchedIndex).dot}`} />
                  Tier {simResult.matchedIndex + 1}
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">← Type a cost price to simulate</p>
          )}
        </div>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[20px_1fr_1fr_72px_auto] gap-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground px-1 pb-1 border-b">
        <span />
        <span>Cost ceiling (Rs.)</span>
        <span>Profit to add (Rs.)</span>
        <span className="text-center">Margin</span>
        <span />
      </div>

      {/* Rule rows */}
      {sorted.map((rule, index) => {
        const tier = getTier(index);
        const isHighlighted = simResult?.matchedIndex === index;
        const originalIndex = rules.findIndex(r => r === rule);
        const midCost = index === 0
          ? Math.floor(rule.maxCostPrice * 0.75)
          : Math.floor((sorted[index - 1].maxCostPrice + rule.maxCostPrice) / 2);

        return (
          <div
            key={index}
            data-testid={`profit-rule-row-${index}`}
            className={`grid grid-cols-[20px_1fr_1fr_72px_auto] gap-3 items-center rounded-xl border p-3 transition-all ${
              isHighlighted ? "ring-2 ring-primary border-primary/30 bg-primary/5" : tier.bg
            }`}
          >
            <div className="flex flex-col items-center gap-0.5">
              <div className={`h-2.5 w-2.5 rounded-full ${tier.dot}`} />
              <span className="text-[9px] font-bold text-muted-foreground">{index + 1}</span>
            </div>

            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">Rs.</span>
              <Input
                type="number" min={0} value={rule.maxCostPrice}
                onChange={e => handleChange(originalIndex, "maxCostPrice", e.target.value)}
                data-testid={`input-max-price-${index}`}
                className="pl-10 h-9 font-mono text-sm bg-white/80"
              />
            </div>

            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">+Rs.</span>
              <Input
                type="number" min={0} value={rule.profit}
                onChange={e => handleChange(originalIndex, "profit", e.target.value)}
                data-testid={`input-profit-${index}`}
                className="pl-12 h-9 font-mono text-sm bg-white/80 text-green-700"
              />
            </div>

            <div className="flex flex-col items-center gap-1">
              <span className={`text-xs font-bold ${tier.text}`}>{marginPct(midCost, rule.profit)}%</span>
              <div className="w-full bg-black/10 rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full ${tier.dot} transition-all duration-500`}
                  style={{ width: `${Math.min((rule.profit / maxProfit) * 100, 100)}%` }}
                />
              </div>
            </div>

            <Button
              variant="ghost" size="icon"
              onClick={() => handleRemove(originalIndex)}
              data-testid={`button-remove-rule-${index}`}
              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
              disabled={rules.length <= 1}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        );
      })}

      {/* Bar chart */}
      {sorted.length > 0 && (
        <div className="p-3 rounded-xl bg-muted/40 border space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Profit distribution</p>
          {sorted.map((rule, i) => {
            const tier = getTier(i);
            const pct = maxProfit > 0 ? (rule.profit / maxProfit) * 100 : 0;
            return (
              <div key={i} className="flex items-center gap-2 text-xs">
                <div className={`h-2 w-2 rounded-full shrink-0 ${tier.dot}`} />
                <span className="text-muted-foreground w-16 shrink-0">≤ {(rule.maxCostPrice / 1000).toFixed(0)}K</span>
                <div className="flex-1 bg-black/10 rounded-full h-1.5">
                  <div className={`h-1.5 rounded-full transition-all duration-500 ${tier.dot}`} style={{ width: `${pct}%` }} />
                </div>
                <span className={`font-semibold w-14 text-right ${tier.text}`}>Rs. {rule.profit.toLocaleString()}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Add tier button */}
      <Button variant="outline" onClick={handleAdd} data-testid="button-add-rule" className="gap-2 h-9">
        <Plus className="h-4 w-4" /> Add Tier
      </Button>

      {/* Summary table */}
      {sorted.length > 0 && (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tier</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cost Range</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Profit Added</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Example Selling</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Margin %</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((rule, i) => {
                const tier = getTier(i);
                const exCost = i === 0 ? Math.floor(rule.maxCostPrice * 0.75) : Math.floor((sorted[i - 1].maxCostPrice + rule.maxCostPrice) / 2);
                const isHighlighted = simResult?.matchedIndex === i;
                return (
                  <tr key={i} className={`border-b last:border-0 transition-colors ${isHighlighted ? "bg-primary/10" : "hover:bg-muted/30"}`}>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${tier.badge}`}>Tier {i + 1}</span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{rangeLabel(rule, i, sorted)}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-green-700">+Rs. {rule.profit.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right">
                      <span className="text-xs text-muted-foreground font-mono">Rs. {exCost.toLocaleString()} + {rule.profit} = </span>
                      <span className="font-bold text-primary">Rs. {(exCost + rule.profit).toLocaleString()}</span>
                    </td>
                    <td className={`px-4 py-2.5 text-right font-semibold ${tier.text}`}>{marginPct(exCost, rule.profit)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AdminProfitRules() {
  const { toast } = useToast();

  // Active tab: "global" or a categoryId string
  const [activeTab, setActiveTab] = useState<string>("global");
  // Local edits: { global: ProfitRule[], [catId]: ProfitRule[] }
  const [localRules, setLocalRules] = useState<{ [key: string]: ProfitRule[] } | null>(null);
  const [hasUnsaved, setHasUnsaved] = useState(false);
  const [addCatOpen, setAddCatOpen] = useState(false);
  const [selectedNewCat, setSelectedNewCat] = useState<string>("");

  const { data: settings, isLoading } = useQuery({
    queryKey: ["settings", "profitRules"],
    queryFn: () => settingsFirestoreService.getProfitRules(),
  });

  const { data: allCategories = [], isLoading: catsLoading } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: () => categoryFirestoreService.getAllCategories(),
  });

  // Effective rules (local edits override server data)
  const effectiveGlobal: ProfitRule[] = localRules?.["global"] ?? settings?.rules ?? [];
  const effectiveCategoryRules: { [catId: string]: ProfitRule[] } =
    localRules
      ? Object.fromEntries(Object.entries(localRules).filter(([k]) => k !== "global"))
      : (settings?.categoryRules ?? {});

  const activeCategoryIds = Object.keys(effectiveCategoryRules);

  const saveMutation = useMutation({
    mutationFn: () => {
      const globalSorted = [...effectiveGlobal].sort((a, b) => a.maxCostPrice - b.maxCostPrice);
      const catRulesSorted: { [catId: string]: ProfitRule[] } = {};
      for (const [catId, rules] of Object.entries(effectiveCategoryRules)) {
        catRulesSorted[catId] = [...rules].sort((a, b) => a.maxCostPrice - b.maxCostPrice);
      }
      return settingsFirestoreService.saveProfitRules(globalSorted, catRulesSorted);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "profitRules"] });
      setLocalRules(null);
      setHasUnsaved(false);
      toast({ title: "Rules saved!", description: "All pricing rules are now live." });
    },
    onError: (error: any) => {
      toast({ title: "Error saving", description: error.message, variant: "destructive" });
    },
  });

  const updateRules = (key: string, updated: ProfitRule[]) => {
    setLocalRules(prev => {
      const base = prev ?? buildLocalBase();
      return { ...base, [key]: updated };
    });
    setHasUnsaved(true);
  };

  const buildLocalBase = () => {
    const base: { [key: string]: ProfitRule[] } = { global: effectiveGlobal };
    for (const [catId, rules] of Object.entries(effectiveCategoryRules)) {
      base[catId] = rules;
    }
    return base;
  };

  const handleAddCategory = () => {
    if (!selectedNewCat) return;
    updateRules(selectedNewCat, [...DEFAULT_NEW_RULES]);
    setActiveTab(selectedNewCat);
    setAddCatOpen(false);
    setSelectedNewCat("");
  };

  const handleRemoveCategory = (catId: string) => {
    setLocalRules(prev => {
      const base = prev ?? buildLocalBase();
      const next = { ...base };
      delete next[catId];
      return next;
    });
    setHasUnsaved(true);
    if (activeTab === catId) setActiveTab("global");
  };

  const handleDiscard = () => {
    setLocalRules(null);
    setHasUnsaved(false);
  };

  // Categories not yet overridden
  const availableCategories = allCategories.filter(c => !activeCategoryIds.includes(String(c.id)));
  const getCategoryName = (catId: string) => allCategories.find(c => String(c.id) === catId)?.name ?? catId;

  const activeRules: ProfitRule[] =
    activeTab === "global"
      ? effectiveGlobal
      : (effectiveCategoryRules[activeTab] ?? []);

  return (
    <>
      <SEO title="Profit Rules - Admin" />
      <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              Profit Rules
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Set global pricing tiers, then override them per product category.
            </p>
          </div>
          {hasUnsaved && (
            <Badge variant="outline" className="border-amber-400 text-amber-600 bg-amber-50 gap-1.5 self-start sm:self-auto">
              <AlertCircle className="h-3.5 w-3.5" />
              Unsaved changes
            </Badge>
          )}
        </div>

        {/* How it works */}
        <div className="rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800 p-4">
          <div className="flex gap-3">
            <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
              <p><strong>How it works:</strong> The <strong>Global</strong> rules apply to all products by default. If a category has its own rules, those override the global ones for products in that category. If no category rule matches a cost price tier, it falls back to global.</p>
              <p className="text-blue-600 text-xs">Example: "Watches" category has higher margins → products in Watches use the Watches rules; everything else uses Global.</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Card>
          <CardHeader className="pb-0">
            <div className="flex flex-wrap items-center gap-2 border-b pb-4">
              {/* Global tab */}
              <button
                onClick={() => setActiveTab("global")}
                data-testid="tab-global"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === "global"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover:bg-muted/80 text-muted-foreground"
                }`}
              >
                <Globe className="h-3.5 w-3.5" />
                Global (Default)
              </button>

              {/* Category tabs */}
              {activeCategoryIds.map(catId => (
                <div key={catId} className="relative group">
                  <button
                    onClick={() => setActiveTab(catId)}
                    data-testid={`tab-cat-${catId}`}
                    className={`flex items-center gap-1.5 pl-3 pr-8 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      activeTab === catId
                        ? "bg-emerald-600 text-white"
                        : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200"
                    }`}
                  >
                    <Tag className="h-3.5 w-3.5" />
                    {getCategoryName(catId)}
                  </button>
                  <button
                    onClick={() => handleRemoveCategory(catId)}
                    data-testid={`button-remove-cat-${catId}`}
                    className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-current hover:scale-110"
                    title={`Remove ${getCategoryName(catId)} override`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}

              {/* Add category override button */}
              {!addCatOpen ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAddCatOpen(true)}
                  data-testid="button-add-category-override"
                  className="gap-1.5 h-8 border-dashed text-muted-foreground"
                  disabled={availableCategories.length === 0}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Category Override
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <Select value={selectedNewCat} onValueChange={setSelectedNewCat}>
                    <SelectTrigger className="h-8 w-48 text-sm" data-testid="select-new-category">
                      <SelectValue placeholder="Pick a category…" />
                    </SelectTrigger>
                    <SelectContent>
                      {catsLoading ? (
                        <SelectItem value="loading" disabled>Loading…</SelectItem>
                      ) : availableCategories.length === 0 ? (
                        <SelectItem value="none" disabled>All categories covered</SelectItem>
                      ) : (
                        availableCategories.map(cat => (
                          <SelectItem key={String(cat.id)} value={String(cat.id)}>
                            {cat.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <Button size="sm" onClick={handleAddCategory} disabled={!selectedNewCat} className="h-8" data-testid="button-confirm-add-category">
                    Add
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setAddCatOpen(false); setSelectedNewCat(""); }} className="h-8">
                    Cancel
                  </Button>
                </div>
              )}
            </div>

            {/* Tab title */}
            <div className="pt-4">
              {activeTab === "global" ? (
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-base">Global Rules</CardTitle>
                  <Badge variant="secondary" className="text-xs">Default fallback</Badge>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-emerald-600" />
                  <CardTitle className="text-base">{getCategoryName(activeTab)} Rules</CardTitle>
                  <Badge className="text-xs bg-emerald-100 text-emerald-700 border-emerald-200">Category override</Badge>
                  <span className="text-xs text-muted-foreground ml-1">— overrides Global for products in this category</span>
                </div>
              )}
            </div>
          </CardHeader>

          <CardContent className="pt-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : activeRules.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
                <FolderOpen className="h-10 w-10 text-muted-foreground/40" />
                <p className="text-muted-foreground text-sm">No rules yet for this category.</p>
                <Button variant="outline" onClick={() => updateRules(activeTab, [...DEFAULT_NEW_RULES])} className="gap-2">
                  <Plus className="h-4 w-4" /> Add starter rules
                </Button>
              </div>
            ) : (
              <RulesEditor
                rules={activeRules}
                onChange={updated => updateRules(activeTab, updated)}
              />
            )}
          </CardContent>
        </Card>

        {/* Save / Discard bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span>
              {activeCategoryIds.length > 0
                ? `${activeCategoryIds.length} category override${activeCategoryIds.length > 1 ? "s" : ""} + Global rules`
                : "Global rules only — add category overrides above"}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {hasUnsaved && (
              <Button variant="ghost" onClick={handleDiscard} className="gap-2 h-9 text-muted-foreground" data-testid="button-discard-rules">
                <RefreshCw className="h-3.5 w-3.5" /> Discard
              </Button>
            )}
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !hasUnsaved}
              className="gap-2 h-9"
              data-testid="button-save-rules"
            >
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saveMutation.isPending ? "Saving…" : "Save All Rules"}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
