import { useState, useEffect, useMemo } from "react";
import { useSearch } from "wouter";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { useCategories } from "@/hooks/use-categories";
import { productFirestoreService } from "@/services/productFirestoreService";

const PRICE_RANGES = [
  { label: "Under Rs. 1,000", min: 0, max: 1000 },
  { label: "Rs. 1,000 - Rs. 3,000", min: 1000, max: 3000 },
  { label: "Rs. 3,000 - Rs. 5,000", min: 3000, max: 5000 },
  { label: "Rs. 5,000 - Rs. 10,000", min: 5000, max: 10000 },
  { label: "Over Rs. 10,000", min: 10000, max: Infinity },
];

interface FiltersProps {
  onFilterChange: (filters: FilterState) => void;
}

export interface FilterState {
  categories: string[];
  priceRange: string | null;
  inStockOnly: boolean;
}

export function Filters({ onFilterChange }: FiltersProps) {
  const search = useSearch();
  const urlCategoryId = useMemo(() => {
    const params = new URLSearchParams(search);
    return params.get("category") || params.get("categoryId");
  }, [search]);

  const [selectedCategories, setSelectedCategories] = useState<string[]>(() => {
    const params = new URLSearchParams(window.location.search);
    const cat = params.get("category") || params.get("categoryId");
    return cat ? [cat] : [];
  });
  const [selectedPriceRange, setSelectedPriceRange] = useState<string | null>(null);
  const [inStockOnly, setInStockOnly] = useState(false);

  // Synchronize state when URL parameter changes (e.g. navigating between category pages)
  useEffect(() => {
    if (urlCategoryId) {
      setSelectedCategories(prev =>
        prev.length === 1 && prev[0] === urlCategoryId ? prev : [urlCategoryId]
      );
    }
  }, [urlCategoryId]);

  // Use the shared hook for categories to ensure synchronization
  const { categories: allCategories } = useCategories();

  const { data: allProducts } = useQuery({
    queryKey: ["products-for-filters"],
    queryFn: () => productFirestoreService.getAllProducts({ limit: 1000 })
  });

  const categories = allCategories?.map((category) => ({
    id: category.id,
    name: category.name,
    count: allProducts?.filter((p) => p.categoryId === category.id).length || 0,
  })) || [];

  useEffect(() => {
    onFilterChange({
      categories: selectedCategories,
      priceRange: selectedPriceRange,
      inStockOnly,
    });
  }, [selectedCategories, selectedPriceRange, inStockOnly]);

  const handleCategoryChange = (categoryId: string) => {
    const category = allCategories?.find(c => c.id === categoryId);
    const subCategoryIds = allCategories?.filter(c => c.parentCategoryId === categoryId).map(c => c.id) || [];
    
    setSelectedCategories((prev) => {
      const isSelected = prev.includes(categoryId);
      let newSelection: string[];

      if (isSelected) {
        // Deselect parent and all its subcategories
        newSelection = prev.filter((c) => c !== categoryId && !subCategoryIds.includes(c));
      } else {
        // Select parent and all its subcategories
        const toAdd = [categoryId, ...subCategoryIds];
        newSelection = [...new Set([...prev, ...toAdd])];
      }
      return newSelection;
    });
  };

  const handleClearAll = () => {
    setSelectedCategories([]);
    setSelectedPriceRange(null);
    setInStockOnly(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Filters</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClearAll}
          className="h-8 px-2 text-xs"
        >
          Clear All
        </Button>
      </div>

      <Accordion type="multiple" defaultValue={["categories", "price", "availability"]}>
        <AccordionItem value="categories">
          <AccordionTrigger>Categories</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-2 pt-2">
              {categories.map((category) => (
                <div key={category.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`cat-${category.id}`}
                    checked={selectedCategories.includes(category.id)}
                    onCheckedChange={() => handleCategoryChange(category.id)}
                  />
                  <Label
                    htmlFor={`cat-${category.id}`}
                    className="text-sm font-normal flex-1 cursor-pointer"
                  >
                    {category.name}
                  </Label>
                  <span className="text-xs text-muted-foreground">({category.count})</span>
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="price">
          <AccordionTrigger>Price Range</AccordionTrigger>
          <AccordionContent>
            <RadioGroup
              value={selectedPriceRange || ""}
              onValueChange={setSelectedPriceRange}
              className="space-y-2 pt-2"
            >
              {PRICE_RANGES.map((range) => (
                <div key={range.label} className="flex items-center space-x-2">
                  <RadioGroupItem value={range.label} id={`price-${range.label}`} />
                  <Label
                    htmlFor={`price-${range.label}`}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {range.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="availability">
          <AccordionTrigger>Availability</AccordionTrigger>
          <AccordionContent>
            <div className="flex items-center space-x-2 pt-2">
              <Checkbox
                id="in-stock"
                checked={inStockOnly}
                onCheckedChange={(checked) => setInStockOnly(checked as boolean)}
              />
              <Label htmlFor="in-stock" className="text-sm font-normal cursor-pointer">
                In Stock Only
              </Label>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
