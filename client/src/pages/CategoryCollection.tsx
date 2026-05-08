import { useState, useMemo, useEffect } from "react";
import { useParams } from "wouter";
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
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { productFirestoreService } from "@/services/productFirestoreService";
import { categoryFirestoreService } from "@/services/categoryFirestoreService";
import type { Category } from "@shared/schema";
import { getOptimizedImageUrl } from "@/lib/cloudinary";
import { SlidersHorizontal, ChevronDown, Truck, RotateCcw, Banknote, ShieldCheck, ArrowRight, Tag } from "lucide-react";

const bagsCategoryImage = "https://res.cloudinary.com/dftvtsjcg/image/upload/v1772789701/ChatGPT_Image_Mar_6_2026_02_15_28_PM_1_t8uwak.png";
const slippersCategoryImage = "https://res.cloudinary.com/dftvtsjcg/image/upload/v1772789698/ChatGPT_Image_Mar_6_2026_02_15_30_PM_1_glrglb.png";
const shoesCategoryImage = "https://res.cloudinary.com/dftvtsjcg/image/upload/v1772789706/ChatGPT_Image_Mar_6_2026_12_57_07_PM_1_ghqfjt.png";
const eidSpecialImage = "https://res.cloudinary.com/dftvtsjcg/image/upload/v1772792215/ChatGPT_Image_Mar_6_2026_03_12_34_PM_1_wdck6p.png";
const watchesImage = "https://res.cloudinary.com/dftvtsjcg/image/upload/v1772789699/ChatGPT_Image_Mar_6_2026_12_57_08_PM_1_r0e1a4.png";

function getCategoryImage(name: string, fallback?: string): string {
  const n = (name || "").toLowerCase();
  if (n.includes("bag") || n.includes("wallet")) return bagsCategoryImage;
  if (n.includes("slipper")) return slippersCategoryImage;
  if (n.includes("shoe") || n.includes("sho")) return shoesCategoryImage;
  if (n.includes("eid")) return eidSpecialImage;
  if (n.includes("watch")) return watchesImage;
  return fallback || bagsCategoryImage;
}

type SortOption = "featured" | "price-low" | "price-high" | "newest";

export default function CategoryCollection() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug || "";
  const [sortBy, setSortBy] = useState<SortOption>("featured");
  const [visibleCount, setVisibleCount] = useState(12);
  const [aboutOpen, setAboutOpen] = useState(false);

  const { data: category, isLoading: categoryLoading } = useQuery<Category>({
    queryKey: ["category", slug],
    queryFn: async () => {
      const allCategories = await categoryFirestoreService.getAllCategories();
      const found = allCategories.find(c => c.slug === slug);
      if (!found) throw new Error("Category not found");
      return found;
    },
    enabled: !!slug,
  });

  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ["products", category?.id, sortBy],
    queryFn: () => {
      if (!category?.id) return Promise.resolve([]);
      return productFirestoreService.getAllProducts({
        category: category.id,
        sortBy: sortBy === "price-low" ? "price-asc" : sortBy === "price-high" ? "price-desc" : sortBy === "newest" ? "newest" : undefined,
        limit: 100,
      });
    },
    enabled: !!category?.id,
    retry: false,
  });

  useEffect(() => {
    if (category && productsData) {
      (window as any).__SEO_PAGE_READY__ = true;
    }
  }, [category, productsData]);

  const filteredAndSortedProducts = useMemo(() => {
    if (!productsData) return [];
    const result = [...productsData];
    if (sortBy === "price-low") result.sort((a, b) => a.price - b.price);
    else if (sortBy === "price-high") result.sort((a, b) => b.price - a.price);
    else if (sortBy === "newest") {
      result.sort((a, b) => {
        const dateA = a.createdAt instanceof Date ? a.createdAt.getTime() : 0;
        const dateB = b.createdAt instanceof Date ? b.createdAt.getTime() : 0;
        return dateB - dateA;
      });
    }
    return result;
  }, [productsData, sortBy]);

  const visibleProducts = filteredAndSortedProducts.slice(0, visibleCount);
  const isLoading = categoryLoading || productsLoading;

  if (isLoading) {
    return (
      <div>
        <Skeleton className="w-full h-40 sm:h-52 rounded-none" />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-72 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!category) {
    return (
      <div className="container mx-auto px-4 py-8">
        <SEO
          title="Category Not Found"
          description="The category you are looking for may have been removed or is no longer available."
          robots="noindex,follow"
        />
        <h1 className="text-2xl font-bold mb-4">Category Not Found</h1>
        <p className="text-muted-foreground">The category you're looking for doesn't exist.</p>
      </div>
    );
  }

  const heroImg = getCategoryImage(category.name, category.image);
  const optimizedHero = getOptimizedImageUrl(heroImg, { width: 1920, height: 600, crop: "fill" });

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={`${category.name} Online Shopping in Pakistan | Best Prices at PakCart`}
        description={category.description || `Explore our exclusive collection of ${category.name.toLowerCase()} available online in Pakistan. Shop authentic products with fast delivery and free shipping on orders over Rs. 10,000.`}
        url={`https://pakcart.store/collections/${category.slug}`}
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Categories", url: "/categories" },
          { name: category.name, url: `/collections/${category.slug}` },
        ]}
        faqs={[
          { question: `What are the shipping options for ${category.name.toLowerCase()}?`, answer: "We offer fast and reliable shipping across Pakistan. Orders are typically dispatched within 24-48 hours. Delivery times vary by location, usually 3-7 business days. We provide free shipping on orders over Rs. 10,000." },
          { question: `Are the ${category.name.toLowerCase()} authentic and of good quality?`, answer: `Yes, all our ${category.name.toLowerCase()} are carefully selected for quality and authenticity. Each product goes through our quality checks to ensure it meets our standards.` },
          { question: "What payment methods do you accept?", answer: "We accept Cash on Delivery (COD), credit/debit cards (Visa, Mastercard), and bank transfers. All transactions are secure and encrypted." },
          { question: `Do the ${category.name.toLowerCase()} come with a warranty?`, answer: `Warranty availability depends on the specific product and manufacturer. Check the product details page for warranty information.` },
          { question: `Do you offer bulk discounts on ${category.name.toLowerCase()}?`, answer: "Yes, we offer special pricing for bulk orders of 10+ items. Contact support@pakcart.store for a custom quote." },
        ]}
        schema={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "CollectionPage",
              "name": `${category.name} - Online Shopping in Pakistan`,
              "description": category.description || `Shop ${category.name.toLowerCase()} online in Pakistan at PakCart`,
              "url": `https://pakcart.store/collections/${category.slug}`,
              "breadcrumb": {
                "@type": "BreadcrumbList",
                "itemListElement": [
                  { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://pakcart.store/" },
                  { "@type": "ListItem", "position": 2, "name": "Categories", "item": "https://pakcart.store/categories" },
                  { "@type": "ListItem", "position": 3, "name": category.name, "item": `https://pakcart.store/collections/${category.slug}` },
                ],
              },
            },
            ...(productsData && productsData.length > 0 ? [{
              "@type": "ItemList",
              "name": `${category.name} Products`,
              "url": `https://pakcart.store/collections/${category.slug}`,
              "numberOfItems": productsData.length,
              "itemListElement": productsData.slice(0, 20).map((p: any, idx: number) => ({
                "@type": "ListItem",
                "position": idx + 1,
                "url": `https://pakcart.store/products/${p.slug}`,
                "name": p.name,
              })),
            }] : []),
          ],
        }}
      />

      {/* ── Hero ── */}
      <div className="relative w-full h-72 sm:h-80 md:h-[380px] lg:h-[460px] overflow-hidden">

        {/* Full-bleed background image */}
        <img
          src={optimizedHero}
          alt={category.name}
          className="absolute inset-0 w-full h-full object-cover object-top sm:object-center"
        />

        {/* Unified overlay: dark at bottom-left, fades naturally across the image */}
        <div className="absolute inset-0 bg-gradient-to-tr from-black/90 via-black/55 to-black/10" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

        {/* Content — left-aligned, vertically centered on desktop, bottom on mobile */}
        <div className="absolute inset-0 flex flex-col justify-end md:justify-center pb-7 md:pb-0">
          <div className="container mx-auto px-5 sm:px-8 lg:px-12 w-full md:max-w-xl lg:max-w-2xl md:ml-0">

            {/* Breadcrumb */}
            <div className="flex items-center gap-1.5 mb-4">
              <a href="/" className="text-white/50 hover:text-white text-[11px] transition-colors">Home</a>
              <span className="text-white/30 text-[10px]">/</span>
              <a href="/categories" className="text-white/50 hover:text-white text-[11px] transition-colors">Categories</a>
              <span className="text-white/30 text-[10px]">/</span>
              <span className="text-white/90 text-[11px] font-medium">{category.name}</span>
            </div>

            {/* "Collection" label */}
            <div className="inline-flex items-center gap-1.5 bg-primary text-white text-[10px] font-bold uppercase tracking-[0.12em] px-3 py-1 rounded-sm mb-4">
              <Tag className="w-2.5 h-2.5" />
              Collection
            </div>

            {/* Title */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[1.05] mb-3 md:mb-4">
              {category.name}
            </h1>

            {/* Divider accent */}
            <div className="w-12 h-0.5 bg-primary mb-3 md:mb-4 rounded-full" />

            {/* Description */}
            <p className="text-white/65 text-sm md:text-base leading-relaxed max-w-xs md:max-w-sm mb-5 md:mb-7 line-clamp-2">
              {category.description || `Curated ${category.name.toLowerCase()} for every style — authentic quality, delivered fast across Pakistan.`}
            </p>

            {/* CTA row */}
            <div className="flex items-center gap-3 flex-wrap">
              <a
                href="#products-grid"
                className="inline-flex items-center gap-2 bg-primary text-white text-sm font-bold px-5 py-2.5 rounded-full hover:bg-primary/90 transition-all duration-200 shadow-lg shadow-primary/30 hover:gap-3 group"
              >
                Shop Now
                <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              </a>
              {filteredAndSortedProducts.length > 0 && (
                <span className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 text-white text-xs font-semibold px-4 py-2.5 rounded-full">
                  <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                  {filteredAndSortedProducts.length} Products
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Trust badge strip — marquee on mobile, static centered on desktop */}
      <div className="border-b border-border/60 bg-background overflow-hidden py-3">

        {/* Mobile: auto-scrolling marquee */}
        <div className="flex sm:hidden">
          <div className="flex animate-marquee gap-10 whitespace-nowrap">
            {[
              { icon: Truck, label: "Free delivery over Rs. 10,000" },
              { icon: Banknote, label: "Cash on Delivery" },
              { icon: ShieldCheck, label: "Authentic products" },
              { icon: Truck, label: "Free delivery over Rs. 10,000" },
              { icon: Banknote, label: "Cash on Delivery" },
              { icon: ShieldCheck, label: "Authentic products" },
            ].map(({ icon: Icon, label }, i) => (
              <span key={i} className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground shrink-0">
                <Icon className="w-3.5 h-3.5 text-primary shrink-0" />
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* Desktop: static centered row */}
        <div className="hidden sm:flex items-center justify-center gap-10">
          {[
            { icon: Truck, label: "Free delivery over Rs. 10,000" },
            { icon: Banknote, label: "Cash on Delivery" },
            { icon: ShieldCheck, label: "Authentic products" },
          ].map(({ icon: Icon, label }, i) => (
            <span key={i} className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Icon className="w-3.5 h-3.5 text-primary shrink-0" />
              {label}
            </span>
          ))}
        </div>

      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-10 sm:pt-5">

        {/* Sticky toolbar */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 mb-5 flex items-center justify-between gap-3 border-b border-border/40">
          <p className="text-sm text-muted-foreground shrink-0">
            {filteredAndSortedProducts.length > 0 && (
              <><span className="font-semibold text-foreground">{filteredAndSortedProducts.length}</span> {filteredAndSortedProducts.length !== 1 ? "products" : "product"}</>
            )}
          </p>
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
              <SelectTrigger className="h-8 text-xs w-[148px] border-border/50" data-testid="select-sort">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="featured">Featured</SelectItem>
                <SelectItem value="price-low">Price: Low to High</SelectItem>
                <SelectItem value="price-high">Price: High to Low</SelectItem>
                <SelectItem value="newest">Newest First</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Products grid */}
        {filteredAndSortedProducts.length === 0 ? (
          <div className="text-center py-20 rounded-2xl border border-dashed border-muted-foreground/20 bg-muted/10">
            <p className="text-lg font-semibold text-foreground mb-1">No products found</p>
            <p className="text-sm text-muted-foreground">Check back soon for new items in this category.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5 sm:gap-3 mb-10" data-testid="products-grid">
              {visibleProducts.map((product) => (
                <ProductCardComponent key={product.id} product={product} data-testid={`product-card-${product.id}`} />
              ))}
            </div>

            {visibleCount < filteredAndSortedProducts.length && (
              <div className="flex flex-col items-center gap-3 mb-8">
                <p className="text-xs text-muted-foreground">
                  Showing {visibleProducts.length} of {filteredAndSortedProducts.length}
                </p>
                <Button
                  onClick={() => setVisibleCount(prev => prev + 12)}
                  variant="outline"
                  className="px-12 rounded-full text-sm font-medium border-border/60 hover:border-primary hover:text-primary transition-colors"
                  data-testid="button-load-more"
                >
                  Load More
                </Button>
              </div>
            )}
          </>
        )}

        {/* Divider before meta content */}
        <div className="border-t border-border/40 pt-8 mt-2 space-y-4">

          {/* About — collapsed */}
          <div className="rounded-xl border border-border/50 overflow-hidden">
            <button
              onClick={() => setAboutOpen(o => !o)}
              className="w-full flex items-center justify-between px-5 py-4 text-left bg-muted/20 hover:bg-muted/40 transition-colors"
            >
              <span className="text-sm font-semibold text-foreground">About {category.name}</span>
              <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${aboutOpen ? "rotate-180" : ""}`} />
            </button>
            {aboutOpen && (
              <div className="px-5 pb-5 pt-4 text-sm text-muted-foreground leading-relaxed space-y-2.5">
                <p>
                  Welcome to our exclusive {category.name.toLowerCase()} collection at PakCart — curated from trusted suppliers across Pakistan with authentic, quality-checked products.
                </p>
                <p>
                  We offer free delivery on orders over Rs. 10,000 and secure payment including Cash on Delivery.
                </p>
              </div>
            )}
          </div>

          {/* FAQ */}
          {filteredAndSortedProducts.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-foreground mb-3">Frequently Asked Questions</p>
              <Accordion type="single" collapsible className="w-full max-w-2xl rounded-xl border border-border/50 overflow-hidden divide-y divide-border/40">
                {[
                  { id: "delivery", q: "How long does delivery take?", a: "Orders are dispatched within 24-48 hours and delivered in 3-7 business days. Free shipping on orders over Rs. 10,000." },
                  { id: "quality", q: "Are the products authentic?", a: `Yes — all ${category.name.toLowerCase()} are sourced from verified suppliers and quality-checked before dispatch.` },
                  { id: "payment", q: "What payment methods are accepted?", a: "We accept Cash on Delivery (COD), Visa, Mastercard, and bank transfer. All transactions are encrypted." },
                  { id: "bulk", q: "Are bulk discounts available?", a: "Yes — email support@pakcart.store for orders of 10 or more items." },
                ].map(({ id, q, a }) => (
                  <AccordionItem key={id} value={id} className="border-none">
                    <AccordionTrigger className="text-sm font-medium px-5 py-3.5 hover:no-underline hover:bg-muted/20 text-left [&>svg]:shrink-0">
                      {q}
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground text-sm leading-relaxed px-5 pb-4">
                      {a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
