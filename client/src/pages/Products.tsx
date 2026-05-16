import { useState, useMemo, useEffect, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import { logSearch } from "@/services/searchAnalyticsService";
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
import { Filter, SlidersHorizontal, FileDown, Download } from "lucide-react";
import { Filters, type FilterState } from "@/components/product/Filters";
import { useQuery } from "@tanstack/react-query";
import { productFirestoreService } from "@/services/productFirestoreService";
import { buildCatalogTxt, downloadTxt } from "@/lib/exportProduct";
import { useDropshipperStatus } from "@/hooks/use-dropshipper-status";

type SortOption = "featured" | "price-low" | "price-high" | "newest";

function getInitialCount() {
  return window.innerWidth >= 1024 ? 24 : 16;
}

export default function Products() {
  const [location, setLocation] = useLocation();
  const search = useSearch();
  const { isApprovedDropshipper } = useDropshipperStatus();
  const [visibleCount, setVisibleCount] = useState(getInitialCount);
  const [sortBy, setSortBy] = useState<SortOption>("featured");
  const [filterState, setFilterState] = useState<FilterState>(() => {
    const params = new URLSearchParams(window.location.search);
    const cat = params.get("category") || params.get("categoryId");
    return {
      categories: cat ? [cat] : [],
      priceRange: null,
      inStockOnly: false,
    };
  });

  const queryParam = useMemo(() => {
    const params = new URLSearchParams(search);
    return params.get("search") || params.get("q") || "";
  }, [search]);

  useEffect(() => {
    setVisibleCount(getInitialCount());
  }, [queryParam]);

  // Sync filter state when URL search params change (e.g. navigating between categories)
  useEffect(() => {
    const params = new URLSearchParams(search);
    const cat = params.get("category") || params.get("categoryId");
    
    if (cat) {
      setFilterState(prev => {
        if (prev.categories.includes(cat) && prev.categories.length === 1) return prev;
        return { ...prev, categories: [cat] };
      });
    } else if (!params.get("parentCategoryId")) {
      setFilterState(prev => {
        if (prev.categories.length === 0) return prev;
        return { ...prev, categories: [] };
      });
    }
  }, [search]);

  const { data: productsData, isLoading, error } = useQuery({
    queryKey: ["products", { categories: filterState.categories, sortBy, queryParam, parentCategoryId: new URLSearchParams(search).get("parentCategoryId") }],
    queryFn: () => {
      const params = new URLSearchParams(search);
      return productFirestoreService.getAllProducts({
        category: filterState.categories.length === 1 ? filterState.categories[0] : undefined,
        parentCategoryId: params.get("parentCategoryId") || undefined,
        search: queryParam,
        sortBy: sortBy === "price-low" ? "price-asc" : sortBy === "price-high" ? "price-desc" : sortBy === "newest" ? "newest" : undefined,
        limit: 100 
      });
    },
    retry: false
  });

  const filteredAndSortedProducts = useMemo(() => {
    if (!productsData) return [];
    let result = [...productsData];

    if (filterState.categories.length > 0 || new URLSearchParams(search).get("parentCategoryId")) {
      if (sortBy === "price-low") {
        result.sort((a, b) => a.price - b.price);
      } else if (sortBy === "price-high") {
        result.sort((a, b) => b.price - a.price);
      } else if (sortBy === "newest") {
        result.sort((a, b) => {
          const dateA = a.createdAt instanceof Date ? a.createdAt.getTime() : 0;
          const dateB = b.createdAt instanceof Date ? b.createdAt.getTime() : 0;
          return dateB - dateA;
        });
      }
    }

    if (filterState.categories.length > 0) {
      result = result.filter(p => {
        const productCatId = String(p.categoryId);
        return filterState.categories.some(catId => String(catId) === productCatId);
      });
    }

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
    return filteredAndSortedProducts.slice(0, visibleCount);
  }, [filteredAndSortedProducts, visibleCount]);

  const handleLoadMore = () => {
    const increment = window.innerWidth >= 1024 ? 24 : 16;
    setVisibleCount((prev) => Math.min(prev + increment, filteredAndSortedProducts.length));
  };

  useEffect(() => {
    if (!isLoading) {
      (window as any).__SEO_PAGE_READY__ = true;
    }
  }, [isLoading]);

  const loggedQueryRef = useRef("");
  useEffect(() => {
    if (!isLoading && queryParam && loggedQueryRef.current !== queryParam) {
      loggedQueryRef.current = queryParam;
      logSearch(queryParam, filteredAndSortedProducts.length);
    }
  }, [isLoading, queryParam, filteredAndSortedProducts.length]);

  const handleFilterChange = (newFilters: FilterState) => {
    setFilterState(newFilters);
    setVisibleCount(getInitialCount());
  };

  const handleExportAll = () => {
    const content = buildCatalogTxt(filteredAndSortedProducts);
    const date = new Date().toISOString().slice(0, 10);
    downloadTxt(content, `pakcart-catalog-${date}.txt`);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <SEO 
        title="Shop All Products — Bags, Jewelry, Shoes, Watches, Stitched Dresses & Tech Gadgets"
        description="Browse PakCart's complete collection — bags & wallets, jewelry, shoes, slippers, stitched dresses, watches and tech gadgets. Cash on Delivery and fast nationwide shipping in Pakistan."
        keywords="shop online pakistan, bags and wallets, jewelry, shoes, slippers, stitched dresses, watches, tech gadgets, cash on delivery"
        url="https://pakcart.store/products"
        robots="index,follow"
        breadcrumbs={[
          { name: "Home", url: "https://pakcart.store/" },
          { name: "All Products", url: "https://pakcart.store/products" },
        ]}
      />

      <Breadcrumb className="mb-6">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/">Home</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Shop</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Mobile Filter Trigger */}
        <div className="lg:hidden mb-6 flex gap-3">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" className="flex-1 gap-2 h-11 rounded-xl shadow-sm hover:bg-accent transition-colors">
                <Filter className="h-4 w-4" />
                Filters
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[300px] sm:w-[400px]">
              <SheetHeader className="border-b pb-4">
                <SheetTitle className="text-xl font-bold">Refine Collection</SheetTitle>
              </SheetHeader>
              <div className="py-6 overflow-y-auto max-h-[calc(100vh-100px)]">
                <Filters onFilterChange={handleFilterChange} />
              </div>
            </SheetContent>
          </Sheet>
          <Select value={sortBy} onValueChange={(val) => setSortBy(val as SortOption)}>
            <SelectTrigger className="w-[180px] h-11 rounded-xl shadow-sm">
              <SlidersHorizontal className="mr-2 h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="featured">Featured</SelectItem>
              <SelectItem value="price-low">Price: Low to High</SelectItem>
              <SelectItem value="price-high">Price: High to Low</SelectItem>
              <SelectItem value="newest">Newest Arrivals</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Sidebar Filters (Desktop) */}
        <aside className="hidden lg:block w-72 flex-shrink-0">
          <div className="sticky top-28 bg-card rounded-2xl p-6 border shadow-sm">
            <Filters onFilterChange={handleFilterChange} />
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
            <div className="space-y-1">
              <h1 className="text-xl md:text-2xl font-bold tracking-tight">
                {queryParam ? `Search Results for "${queryParam}"` : "Our Collections"}
              </h1>
                <div className="text-muted-foreground font-medium flex items-center gap-2">
                {isLoading ? (
                  <Skeleton className="h-4 w-32" />
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    Showing {displayedProducts.length} of {filteredAndSortedProducts.length} unique items
                  </>
                )}
              </div>
            </div>
            
            <div className="hidden lg:flex items-center gap-3">
              <span className="text-sm font-medium text-muted-foreground">Sort:</span>
              <Select value={sortBy} onValueChange={(val) => setSortBy(val as SortOption)}>
                <SelectTrigger className="w-[200px] h-10 rounded-xl bg-card border shadow-sm hover:bg-accent transition-colors">
                  <SlidersHorizontal className="mr-2 h-4 w-4 text-muted-foreground" />
                  <SelectValue placeholder="Featured" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="featured">Most Popular</SelectItem>
                  <SelectItem value="price-low">Price: Low to High</SelectItem>
                  <SelectItem value="price-high">Price: High to Low</SelectItem>
                  <SelectItem value="newest">Latest Releases</SelectItem>
                </SelectContent>
              </Select>
              {isApprovedDropshipper && (
                <Button
                  onClick={handleExportAll}
                  disabled={isLoading || filteredAndSortedProducts.length === 0}
                  variant="outline"
                  className="h-10 rounded-xl gap-2 border-green-600 text-green-700 hover:bg-green-700 hover:text-white transition-colors shrink-0"
                  data-testid="btn-export-all-products"
                >
                  <FileDown className="h-4 w-4" />
                  Download All
                </Button>
              )}
            </div>

            {/* Mobile export all */}
            {isApprovedDropshipper && (
              <Button
                onClick={handleExportAll}
                disabled={isLoading || filteredAndSortedProducts.length === 0}
                variant="outline"
                size="sm"
                className="lg:hidden gap-2 border-green-600 text-green-700 hover:bg-green-700 hover:text-white transition-colors rounded-xl"
                data-testid="btn-export-all-products-mobile"
              >
                <FileDown className="h-4 w-4" />
                Download All
              </Button>
            )}
          </div>

          {/* Product Grid */}
          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 md:gap-8">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="space-y-4">
                  <Skeleton className="aspect-[4/5] w-full rounded-2xl md:rounded-3xl" />
                  <div className="space-y-2 px-1">
                    <Skeleton className="h-5 w-4/5" />
                    <Skeleton className="h-4 w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-24 bg-destructive/5 rounded-3xl border-2 border-dashed border-destructive/20">
              <div className="max-w-sm mx-auto px-6">
                <h3 className="text-2xl font-bold mb-3">Index Required</h3>
                <p className="text-muted-foreground mb-8">
                  The current filter requires a Firestore index. Please check the browser console for the link to create it.
                </p>
              </div>
            </div>
          ) : filteredAndSortedProducts.length === 0 ? (
            <div className="text-center py-24 bg-muted/20 rounded-3xl border-2 border-dashed border-muted-foreground/20">
              <div className="max-w-sm mx-auto px-6">
                <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
                  <Filter className="h-10 w-10 text-muted-foreground/40" />
                </div>
                <h3 className="text-2xl font-bold mb-3">No results found</h3>
                <p className="text-muted-foreground mb-8 text-balance">
                  {queryParam
                    ? `We couldn't find any products matching "${queryParam}". Try a different keyword or browse our categories.`
                    : "We couldn't find any products matching your current filters. Try broadening your selection."}
                </p>
                <Button 
                  variant="default" 
                  size="lg"
                  className="rounded-full px-8"
                  onClick={() => {
                    handleFilterChange({ categories: [], priceRange: null, inStockOnly: false });
                    if (queryParam) {
                      setLocation("/products");
                    }
                  }}
                >
                  {queryParam ? "Browse All Products" : "Reset All Filters"}
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 md:gap-8">
                {displayedProducts.map((product) => (
                  <ProductCardComponent key={product.id} product={product} />
                ))}
              </div>

              {/* Load More */}
              {visibleCount < filteredAndSortedProducts.length && (
                <div className="mt-16 text-center border-t pt-12">
                  <Button 
                    onClick={handleLoadMore} 
                    size="lg"
                    variant="outline"
                    className="min-w-[240px] h-12 rounded-full border-2 hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all duration-300 shadow-sm"
                  >
                    Show More
                  </Button>
                </div>
              )}

              {/* Dropshipper hint — approved only */}
              {isApprovedDropshipper && (
                <div className="mt-10 bg-green-50 border border-green-200 rounded-2xl px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <FileDown className="h-5 w-5 text-green-700 shrink-0 mt-0.5 sm:mt-0" />
                  <p className="text-sm text-green-800">
                    <strong>Dropshipper tip:</strong> Hover over any product card and click the{" "}
                    <Download className="inline h-3.5 w-3.5" /> download icon to export the product's
                    full details as a .txt file and download its photos, variant images, and video.
                    Use <strong>"Download All"</strong> above to download the entire catalog at once.
                  </p>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
