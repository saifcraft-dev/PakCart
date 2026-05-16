import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { settingsFirestoreService, type ProfitRule } from "@/services/settingsFirestoreService";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, Save, Plus, Trash2, TrendingUp, Info, Calculator,
  ChevronRight, AlertCircle, CheckCircle2, Zap, BarChart3, RefreshCw
} from "lucide-react";
import SEO from "@/components/SEO";

const TIER_COLORS = [
  { bg: "bg-violet-50 border-violet-200", badge: "bg-violet-100 text-violet-700", dot: "bg-violet-500", text: "text-violet-700" },
  { bg: "bg-blue-50 border-blue-200",   badge: "bg-blue-100 text-blue-700",   dot: "bg-blue-500",   text: "text-blue-700"   },
  { bg: "bg-emerald-50 border-emerald-200", badge: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500", text: "text-emerald-700" },
  { bg: "bg-amber-50 border-amber-200", badge: "bg-amber-100 text-amber-700", dot: "bg-amber-500",  text: "text-amber-700"  },
  { bg: "bg-rose-50 border-rose-200",   badge: "bg-rose-100 text-rose-700",   dot: "bg-rose-500",   text: "text-rose-700"   },
  { bg: "bg-cyan-50 border-cyan-200",   badge: "bg-cyan-100 text-cyan-700",   dot: "bg-cyan-500",   text: "text-cyan-700"   },
];

function getTierColor(index: number) {
  return TIER_COLORS[index % TIER_COLORS.length];
}

function calcMarginPct(cost: number, profit: number): string {
  if (!cost || cost === 0) return "0";
  return ((profit / cost) * 100).toFixed(1);
}

function getRangeLabel(rule: ProfitRule, index: number, sorted: ProfitRule[]): string {
  const from = index === 0 ? 0 : sorted[index - 1].maxCostPrice + 1;
  return `Rs. ${from.toLocaleString()} – Rs. ${rule.maxCostPrice.toLocaleString()}`;
}

export default function AdminProfitRules() {
  const { toast } = useToast();
  const [rules, setRules] = useState<ProfitRule[] | null>(null);
  const [simulatorCost, setSimulatorCost] = useState<string>("");
  const [hasUnsaved, setHasUnsaved] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["settings", "profitRules"],
    queryFn: () => settingsFirestoreService.getProfitRules(),
  });

  const effectiveRules: ProfitRule[] = rules ?? settings?.rules ?? [];
  const sortedRules = [...effectiveRules].sort((a, b) => a.maxCostPrice - b.maxCostPrice);

  const saveMutation = useMutation({
    mutationFn: (newRules: ProfitRule[]) => settingsFirestoreService.saveProfitRules(newRules),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "profitRules"] });
      setRules(null);
      setHasUnsaved(false);
      toast({ title: "Rules saved!", description: "Your pricing rules are now live across all products." });
    },
    onError: (error: any) => {
      toast({ title: "Error saving rules", description: error.message, variant: "destructive" });
    },
  });

  const handleRuleChange = (index: number, field: keyof ProfitRule, value: string) => {
    const updated = effectiveRules.map((r, i) =>
      i === index ? { ...r, [field]: Number(value) } : r
    );
    setRules(updated);
    setHasUnsaved(true);
  };

  const handleAddRule = () => {
    const sorted = [...effectiveRules].sort((a, b) => a.maxCostPrice - b.maxCostPrice);
    const lastMax = sorted[sorted.length - 1]?.maxCostPrice ?? 0;
    const lastProfit = sorted[sorted.length - 1]?.profit ?? 0;
    setRules([...effectiveRules, { maxCostPrice: lastMax + 1000, profit: lastProfit + 100 }]);
    setHasUnsaved(true);
  };

  const handleRemoveRule = (index: number) => {
    setRules(effectiveRules.filter((_, i) => i !== index));
    setHasUnsaved(true);
  };

  const handleDiscard = () => {
    setRules(null);
    setHasUnsaved(false);
  };

  const handleSave = () => {
    const sorted = [...effectiveRules].sort((a, b) => a.maxCostPrice - b.maxCostPrice);
    saveMutation.mutate(sorted);
  };

  const simulatorResult = useMemo(() => {
    const cost = parseFloat(simulatorCost);
    if (!simulatorCost || isNaN(cost) || cost < 0) return null;
    const profit = settingsFirestoreService.calculateProfit(cost, sortedRules);
    const selling = cost + profit;
    const matchedIndex = sortedRules.findIndex(r => cost <= r.maxCostPrice);
    return { cost, profit, selling, matchedIndex };
  }, [simulatorCost, sortedRules]);

  const maxProfit = Math.max(...sortedRules.map(r => r.profit), 1);

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
              Automatically set selling prices based on product cost ranges.
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
              <p><strong>How it works:</strong> When you add a product with a cost price, the system automatically finds the right tier and fills in the profit. Rules are matched from lowest to highest — the first tier whose ceiling covers the cost price wins.</p>
              <p className="text-blue-600 dark:text-blue-400">Example: Cost Rs. 850 → matches "Up to Rs. 1,000" tier → profit applied automatically.</p>
            </div>
          </div>
        </div>

        {/* Live Simulator */}
        <Card className="border-2 border-dashed border-primary/30 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calculator className="h-4 w-4 text-primary" />
              Live Price Simulator
            </CardTitle>
            <CardDescription>Enter any cost price to instantly preview the selling price your rules will produce.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              <div className="relative flex-1 max-w-xs">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">Rs.</span>
                <Input
                  type="number"
                  min={0}
                  placeholder="Enter cost price"
                  value={simulatorCost}
                  onChange={e => setSimulatorCost(e.target.value)}
                  className="pl-10 font-mono"
                  data-testid="input-simulator-cost"
                />
              </div>

              {simulatorResult ? (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-background border">
                    <span className="text-muted-foreground">Cost</span>
                    <span className="font-semibold">Rs. {simulatorResult.cost.toLocaleString()}</span>
                  </div>
                  <Plus className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 border border-green-200">
                    <span className="text-green-700">Profit</span>
                    <span className="font-semibold text-green-700">Rs. {simulatorResult.profit.toLocaleString()}</span>
                    <span className="text-green-500 text-xs">({calcMarginPct(simulatorResult.cost, simulatorResult.profit)}%)</span>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground">
                    <Zap className="h-3.5 w-3.5" />
                    <span className="font-bold">Rs. {simulatorResult.selling.toLocaleString()}</span>
                  </div>
                  {simulatorResult.matchedIndex >= 0 && (
                    <div className="flex items-center gap-1">
                      <div className={`h-2 w-2 rounded-full ${getTierColor(simulatorResult.matchedIndex).dot}`} />
                      <span className="text-xs text-muted-foreground">Tier {simulatorResult.matchedIndex + 1}</span>
                    </div>
                  )}
                </div>
              ) : simulatorCost ? (
                <p className="text-sm text-muted-foreground italic">Enter a valid cost price…</p>
              ) : (
                <p className="text-sm text-muted-foreground">← Type a cost price to simulate</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Rules Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                Pricing Tiers
              </CardTitle>
              <CardDescription className="mt-1">
                Rules sorted lowest to highest. The first matching ceiling wins.
              </CardDescription>
            </div>
            <Badge variant="secondary" className="font-mono">{sortedRules.length} tier{sortedRules.length !== 1 ? "s" : ""}</Badge>
          </CardHeader>

          <CardContent className="space-y-3">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {/* Column Headers */}
                <div className="grid grid-cols-[24px_1fr_1fr_80px_auto] gap-3 items-center text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1 pb-1 border-b">
                  <span></span>
                  <span>Cost ceiling (Rs.)</span>
                  <span>Profit to add (Rs.)</span>
                  <span className="text-center">Margin %</span>
                  <span></span>
                </div>

                {sortedRules.map((rule, index) => {
                  const tier = getTierColor(index);
                  const midCost = index === 0
                    ? Math.floor(rule.maxCostPrice * 0.75)
                    : Math.floor((sortedRules[index - 1].maxCostPrice + rule.maxCostPrice) / 2);
                  const marginPct = calcMarginPct(midCost, rule.profit);
                  const isHighlighted = simulatorResult?.matchedIndex === index;
                  const originalIndex = effectiveRules.findIndex(r => r === rule) >= 0
                    ? effectiveRules.findIndex(r => r === rule)
                    : index;

                  return (
                    <div
                      key={index}
                      data-testid={`profit-rule-row-${index}`}
                      className={`grid grid-cols-[24px_1fr_1fr_80px_auto] gap-3 items-center rounded-xl border p-3 transition-all ${
                        isHighlighted
                          ? "ring-2 ring-primary border-primary/30 bg-primary/5"
                          : `${tier.bg}`
                      }`}
                    >
                      {/* Tier dot */}
                      <div className="flex flex-col items-center gap-1">
                        <div className={`h-3 w-3 rounded-full ${tier.dot}`} />
                        <span className="text-[10px] font-bold text-muted-foreground leading-none">{index + 1}</span>
                      </div>

                      {/* Cost ceiling input */}
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium pointer-events-none">Rs.</span>
                        <Input
                          type="number"
                          min={0}
                          value={rule.maxCostPrice}
                          onChange={e => handleRuleChange(originalIndex, "maxCostPrice", e.target.value)}
                          data-testid={`input-max-price-${index}`}
                          placeholder="e.g. 1000"
                          className="pl-10 h-9 font-mono text-sm bg-white/80"
                        />
                      </div>

                      {/* Profit input */}
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium pointer-events-none">+Rs.</span>
                        <Input
                          type="number"
                          min={0}
                          value={rule.profit}
                          onChange={e => handleRuleChange(originalIndex, "profit", e.target.value)}
                          data-testid={`input-profit-${index}`}
                          placeholder="e.g. 100"
                          className="pl-12 h-9 font-mono text-sm bg-white/80 text-green-700"
                        />
                      </div>

                      {/* Margin % */}
                      <div className="flex flex-col items-center gap-1">
                        <span className={`text-sm font-bold ${tier.text}`}>{marginPct}%</span>
                        <div className="w-full bg-black/10 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full ${tier.dot}`}
                            style={{ width: `${Math.min((rule.profit / maxProfit) * 100, 100)}%` }}
                          />
                        </div>
                      </div>

                      {/* Delete */}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveRule(originalIndex)}
                        data-testid={`button-remove-rule-${index}`}
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                        disabled={effectiveRules.length <= 1}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  );
                })}

                {/* Visual bar chart */}
                <div className="mt-2 p-4 rounded-xl bg-muted/40 border space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Profit distribution across tiers</p>
                  <div className="space-y-2">
                    {sortedRules.map((rule, i) => {
                      const tier = getTierColor(i);
                      const pct = maxProfit > 0 ? (rule.profit / maxProfit) * 100 : 0;
                      return (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <div className={`h-2 w-2 rounded-full shrink-0 ${tier.dot}`} />
                          <span className="text-muted-foreground w-20 shrink-0">Up to {(rule.maxCostPrice / 1000).toFixed(0)}K</span>
                          <div className="flex-1 bg-black/10 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all duration-500 ${tier.dot}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className={`font-semibold w-16 text-right ${tier.text}`}>Rs. {rule.profit.toLocaleString()}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex flex-wrap items-center gap-3 pt-2 border-t">
                  <Button
                    variant="outline"
                    onClick={handleAddRule}
                    data-testid="button-add-rule"
                    className="gap-2 h-9"
                  >
                    <Plus className="h-4 w-4" />
                    Add Tier
                  </Button>

                  {hasUnsaved && (
                    <Button
                      variant="ghost"
                      onClick={handleDiscard}
                      data-testid="button-discard-rules"
                      className="gap-2 h-9 text-muted-foreground"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Discard
                    </Button>
                  )}

                  <Button
                    onClick={handleSave}
                    data-testid="button-save-rules"
                    disabled={saveMutation.isPending}
                    className="gap-2 h-9 ml-auto"
                  >
                    {saveMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    {saveMutation.isPending ? "Saving…" : "Save Rules"}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Summary table */}
        {!isLoading && sortedRules.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                Rule Summary Table
              </CardTitle>
              <CardDescription>Full breakdown of all active pricing tiers with example calculations.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Tier</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Cost Range</th>
                      <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Profit Added</th>
                      <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Example Selling Price</th>
                      <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Margin %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRules.map((rule, i) => {
                      const tier = getTierColor(i);
                      const exampleCost = i === 0
                        ? Math.floor(rule.maxCostPrice * 0.75)
                        : Math.floor((sortedRules[i - 1].maxCostPrice + rule.maxCostPrice) / 2);
                      const selling = exampleCost + rule.profit;
                      const margin = calcMarginPct(exampleCost, rule.profit);
                      const isHighlighted = simulatorResult?.matchedIndex === i;
                      return (
                        <tr
                          key={i}
                          className={`border-b last:border-0 transition-colors ${
                            isHighlighted ? "bg-primary/10" : "hover:bg-muted/30"
                          }`}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className={`h-2.5 w-2.5 rounded-full ${tier.dot}`} />
                              <span className={`font-semibold text-xs px-2 py-0.5 rounded-full ${tier.badge}`}>Tier {i + 1}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                            {getRangeLabel(rule, i, sortedRules)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="font-semibold text-green-700">+Rs. {rule.profit.toLocaleString()}</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="font-mono text-xs text-muted-foreground">Rs. {exampleCost.toLocaleString()} + {rule.profit} = </span>
                            <span className="font-bold text-primary">Rs. {selling.toLocaleString()}</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className={`font-semibold ${tier.text}`}>{margin}%</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
