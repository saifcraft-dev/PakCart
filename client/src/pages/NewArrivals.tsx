import { useState, useMemo, useEffect } from "react";
import { useSearch } from "wouter";
import SEO from "@/components/SEO";
import { ProductCard as ProductCardComponent } from "@/components/product/ProductCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Filter, SlidersHorizontal, Sparkles } from "lucide-react";
import { Filters, type FilterState } from "@/components/products/Filters";
import { useQuery } from "@tanstack/react-query";
import { productFirestoreService } from "@/services/productFirestoreService";

type SortOption = "featured" | "price-low" | "price-high" | "newest";

export default function NewArrivals() {
  const search = useSearch();
  const [visibleCount, setVisibleCount] = useState(10);
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [filterState, setFilterState] = useState<FilterState>({
    categories: [],
    priceRange: null,
    inStockOnly: false,
  });

  const { data: productsData, isLoading, error } = useQuery({
    queryKey: ["products", "new-arrivals", { categories: filterState.categories, sortBy }],
    queryFn: () => {
      return productFirestoreService.getAllProducts({
        category: filterState.categories.length > 0 ? filterState.categories[0] : undefined,
        sortBy: sortBy === "price-low" ? "price-asc" : sortBy === "price-high" ? "price-desc" : "newest",
        limit: 100 
      });
    },
    retry: false
  });

  const filteredProducts = useMemo(() => {
    if (!productsData) return [];
    let result = [...productsData];

    // Client-side additional filters
    if (filterState.categories.length > 0) {
      result = result.filter(p => {
        const productCatId = String(p.categoryId);
        return filterState.categories.some(catId => String(catId) === productCatId);
      });
    }

    // Filter by price range
    if (filterState.priceRange) {
      const ranges: Record<string, { min: number; max: number }> = {
        "Under Rs. 1,000": { min: 0, max: 1000 },
        "Rs. 1,000 - Rs. 3,000": { min: 1000, max: 3000 },
        "Rs. 3,000 - Rs. 5,000": { min: 3000, max: 5000 },
        "Rs. 5,000 - Rs. 10,000": { min: 5000, max: 10000 },
        "Over Rs. 10,000": { min: 10000, max: Infinity },
      };
      const range = ranges[filterState.priceRange];
      if (range) {
        result = result.filter((p) => p.price >= range.min && p.price <= range.max);
      }
    }

    if (filterState.inStockOnly) {
      result = result.filter((p) => p.inStock);
    }

    return result;
  }, [productsData, filterState]);

  const displayedProducts = useMemo(() => {
    return filteredProducts.slice(0, visibleCount);
  }, [filteredProducts, visibleCount]);

  const handleLoadMore = () => {
    setVisibleCount((prev) => Math.min(prev + 10, filteredProducts.length));
  };

  const handleFilterChange = (newFilters: FilterState) => {
    setFilterState(newFilters);
    setVisibleCount(10);
  };

  useEffect(() => {
    if (!isLoading) {
      (window as any).__SEO_PAGE_READY__ = true;
    }
  }, [isLoading]);

  return (
    <div className="container mx-auto px-4 py-8">
      <SEO 
        title="New Arrivals — Fresh Bags, Jewelry, Shoes, Watches & Tech Gadgets"
        description="Discover the freshest drops at PakCart — newly arrived bags & wallets, jewelry, shoes, slippers, stitched dresses, watches and tech gadgets. Cash on Delivery and fast nationwide shipping across Pakistan."
        keywords="new arrivals pakistan, latest bags, new jewelry pakistan, new shoes, new watches pakistan, new stitched dresses, new tech gadgets, pakcart"
        url="https://pakcart.store/new-arrivals"
        robots="index,follow"
        breadcrumbs={[
          { name: "Home", url: "https://pakcart.store/" },
          { name: "New Arrivals", url: "https://pakcart.store/new-arrivals" },
        ]}
      />

      <Breadcrumb className="mb-6">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/">Home</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>New Arrivals</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-col lg:flex-row gap-8">
        <aside className="hidden lg:block w-72 flex-shrink-0">
          <div className="sticky top-28 bg-card rounded-2xl p-6 border shadow-sm">
            <Filters onFilterChange={handleFilterChange} />
          </div>
        </aside>

        <main className="flex-1">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
            <div className="space-y-1">
              <h1 className="text-xl md:text-3xl font-bold tracking-tight flex items-center gap-3">
                <Sparkles className="h-6 w-6 text-primary fill-primary/20" />
                New Arrivals
              </h1>
              <p className="text-muted-foreground font-medium flex items-center gap-2">
                {isLoading ? (
                  <Skeleton className="h-4 w-32" />
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    Showing {displayedProducts.length} fresh finds
                  </>
                )}
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="lg:hidden">
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2 h-10 rounded-xl">
                      <Filter className="h-4 w-4" />
                      Filters
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-[300px]">
                    <SheetHeader>
                      <SheetTitle>Refine Results</SheetTitle>
                    </SheetHeader>
                    <div className="py-6 overflow-y-auto max-h-[calc(100vh-100px)]">
                      <Filters onFilterChange={handleFilterChange} />
                    </div>
                  </SheetContent>
                </Sheet>
              </div>
              <Select value={sortBy} onValueChange={(val) => setSortBy(val as SortOption)}>
                <SelectTrigger className="w-[180px] h-10 rounded-xl bg-card border shadow-sm">
                  <SlidersHorizontal className="mr-2 h-4 w-4 text-muted-foreground" />
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="price-low">Price: Low to High</SelectItem>
                  <SelectItem value="price-high">Price: High to Low</SelectItem>
                  <SelectItem value="featured">Most Popular</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 md:gap-8">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="space-y-4">
                  <Skeleton className="aspect-[4/5] w-full rounded-2xl" />
                  <div className="space-y-2 px-1">
                    <Skeleton className="h-5 w-4/5" />
                    <Skeleton className="h-4 w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-24 bg-destructive/5 rounded-3xl border border-dashed border-destructive/20">
              <p className="text-muted-foreground">Failed to load new arrivals. Please try again later.</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-24 bg-muted/20 rounded-3xl border-2 border-dashed border-muted-foreground/20">
              <h3 className="text-xl font-bold mb-2">No fresh arrivals yet</h3>
              <p className="text-muted-foreground mb-6">Check back soon for our latest curated collection.</p>
              <Button onClick={() => handleFilterChange({ categories: [], priceRange: null, inStockOnly: false })}>
                Clear Filters
              </Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 md:gap-8">
                {displayedProducts.map((product) => (
                  <ProductCardComponent key={product.id} product={product} />
                ))}
              </div>

              {visibleCount < filteredProducts.length && (
                <div className="mt-16 text-center">
                  <Button 
                    onClick={handleLoadMore} 
                    size="lg"
                    variant="outline"
                    className="min-w-[200px] rounded-full"
                  >
                    View More Arrivals
                  </Button>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
