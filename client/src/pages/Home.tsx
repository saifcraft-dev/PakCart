import { useState, useMemo, useEffect, useRef } from "react";
import { Link } from "wouter";
import { ArrowRight, Star, Truck, ShieldCheck, Clock, ChevronLeft, ChevronRight } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { CategoryCard } from "@/components/products/CategoryCard";
import { ProductCard } from "@/components/product/ProductCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { motion, AnimatePresence } from "framer-motion";
import categoriesListImage from "@/assets/hero-image.jpg";
const bagsCategoryImage = "https://res.cloudinary.com/dftvtsjcg/image/upload/v1772789701/ChatGPT_Image_Mar_6_2026_02_15_28_PM_1_t8uwak.png";
const slippersCategoryImage = "https://res.cloudinary.com/dftvtsjcg/image/upload/v1772789698/ChatGPT_Image_Mar_6_2026_02_15_30_PM_1_glrglb.png";
const shoesCategoryImage = "https://res.cloudinary.com/dftvtsjcg/image/upload/v1772789706/ChatGPT_Image_Mar_6_2026_12_57_07_PM_1_ghqfjt.png";
const eidSpecialImage = "https://res.cloudinary.com/dftvtsjcg/image/upload/v1772792215/ChatGPT_Image_Mar_6_2026_03_12_34_PM_1_wdck6p.png";
const watchesImage = "https://res.cloudinary.com/dftvtsjcg/image/upload/v1772789699/ChatGPT_Image_Mar_6_2026_12_57_08_PM_1_r0e1a4.png";
import { getOptimizedImageUrl } from "@/lib/cloudinary";
import { useProducts } from "@/hooks/use-products";
import { useCategories } from "@/hooks/use-categories";
import { homepageSlideService } from "@/services/homepageSlideService";
import { type HomepageSlide } from "@shared/homepage-slide-schema";
import { useQuery } from "@tanstack/react-query";
import SEO from "@/components/SEO";

export default function Home() {
  const { data: allProducts, isLoading: isAllProductsLoading } = useProducts();
  const { categories: categoriesRaw, isLoading: isCategoriesLoading } = useCategories();
  const categories = useMemo(() => {
    const preferredKeywords = ["watch", "wallet", "bag", "jewel", "dress"];
    const orderIndex = (name: string) => {
      const lower = (name || "").toLowerCase().trim();
      for (let i = 0; i < preferredKeywords.length; i++) {
        if (lower.includes(preferredKeywords[i])) return i;
      }
      return preferredKeywords.length;
    };
    return [...categoriesRaw].sort((a, b) => {
      const diff = orderIndex(a.name) - orderIndex(b.name);
      if (diff !== 0) return diff;
      return a.name.localeCompare(b.name);
    });
  }, [categoriesRaw]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const touchStart = useRef<number | null>(null);
  // Initialise synchronously from matchMedia so the very first render picks the
  // correct device variant. This avoids:
  //   1. A desktop->mobile aspect-ratio snap (massive CLS on phones)
  //   2. Fetching the desktop slide image on a phone before swapping to mobile
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches,
  );
  const categoriesScrollRef = useRef<HTMLDivElement>(null);

  const scrollCategories = (direction: "left" | "right") => {
    const container = categoriesScrollRef.current;
    if (!container) return;
    const scrollAmount = 320;
    container.scrollBy({ left: direction === "left" ? -scrollAmount : scrollAmount, behavior: "smooth" });
  };

  const [showMoreNewArrivals, setShowMoreNewArrivals] = useState(false);
  const [showMoreFeatured, setShowMoreFeatured] = useState(false);
  const [showMoreLiked, setShowMoreLiked] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const toggleCategoryExpansion = (categoryId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  };

  // Repeat-visit LCP fast-path: read the hero URL cached by a previous visit
  // and synthesise a minimal HomepageSlide[] so the hero <img> renders on the
  // very first React paint — no Firestore round trip required. This pairs
  // with the inline <link rel="preload"> in index.html, so by the time React
  // mounts the cached image is already in the browser cache.
  const cachedHeroPlaceholder = useMemo<HomepageSlide[] | undefined>(() => {
    if (typeof window === "undefined") return undefined;
    try {
      const raw = window.localStorage.getItem("pakcart_hero_v1");
      if (!raw) return undefined;
      const data = JSON.parse(raw) as { mobile?: string; desktop?: string };
      const stubs: HomepageSlide[] = [];
      if (data?.mobile) {
        stubs.push({
          id: "__cached_mobile",
          image_url: data.mobile,
          image_webp_url: data.mobile,
          is_active: true,
          display_order: 0,
          hero_section_type: "mobile",
        } as HomepageSlide);
      }
      if (data?.desktop) {
        stubs.push({
          id: "__cached_desktop",
          image_url: data.desktop,
          image_webp_url: data.desktop,
          is_active: true,
          display_order: 0,
          hero_section_type: "desktop",
        } as HomepageSlide);
      }
      return stubs.length > 0 ? stubs : undefined;
    } catch {
      return undefined;
    }
  }, []);

  const { data: slides, isLoading: isHeroLoading } = useQuery<HomepageSlide[]>({
    queryKey: ["/api/homepage-slides", "active"],
    queryFn: () => homepageSlideService.getActiveSlides(),
    placeholderData: cachedHeroPlaceholder,
  });

  // Track viewport changes via matchMedia (cheaper than 'resize' + initial state
  // is already correct from useState initializer above, so no extra paint here).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(max-width: 767px)");
    const handleChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener("change", handleChange);
    return () => mql.removeEventListener("change", handleChange);
  }, []);

  const HERO_SLIDES = useMemo(() => {
    if (slides && slides.length > 0) {
      // Filter slides by device type and ensure they are sorted by display_order
      const deviceType = isMobile ? "mobile" : "desktop";
      const filteredSlides = slides
        .filter(slide => slide.hero_section_type === deviceType)
        .sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
      // Fall back to all slides (sorted) if no slides match the device type
      return filteredSlides.length > 0 ? filteredSlides : slides.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
    }
    return [];
  }, [slides, isMobile]);

  // Reset currentSlide when HERO_SLIDES changes to prevent out-of-bounds access
  useEffect(() => {
    setCurrentSlide(0);
  }, [HERO_SLIDES.length]);

  // Cache active hero slide URLs so the inline boot-script in index.html can
  // <link rel="preload"> the LCP image on the user's NEXT visit, in parallel
  // with the JS bundle download. This is the single biggest LCP win we can
  // make for an SPA without server-side rendering.
  //
  // We store the EXACT same URL that the <picture> source below will request
  // (admin-provided WebP if present, otherwise the same Cloudinary WebP
  // transform). That way the preload, the placeholderData stub, and the real
  // rendered <img> all hit one URL and the browser reuses a single download.
  useEffect(() => {
    if (!slides || slides.length === 0) return;
    try {
      const pickFirst = (deviceType: "mobile" | "desktop") => {
        const list = slides
          .filter(s => s.hero_section_type === deviceType && s.is_active !== false)
          .sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
        const slide = list[0] ?? slides[0];
        if (!slide) return null;
        if (slide.image_webp_url) return slide.image_webp_url;
        return getOptimizedImageUrl(slide.image_url, {
          format: "webp",
          width: deviceType === "mobile" ? 768 : 1920,
        });
      };
      const payload = {
        v: 1,
        mobile: pickFirst("mobile"),
        desktop: pickFirst("desktop"),
      };
      localStorage.setItem("pakcart_hero_v1", JSON.stringify(payload));
    } catch {
      /* localStorage may be disabled — fail silently */
    }
  }, [slides]);

  useEffect(() => {
    if (HERO_SLIDES.length <= 1 || isPaused) return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % HERO_SLIDES.length);
    }, 4500); // Transitions automatically every 4-5 seconds
    return () => clearInterval(timer);
  }, [HERO_SLIDES.length, isPaused]);

  const featuredProducts = useMemo(() => {
    const filtered = allProducts?.filter(p => p.labels?.includes("Best Seller")) || [];
    return showMoreFeatured ? filtered : filtered.slice(0, 6);
  }, [allProducts, showMoreFeatured]);

  const likedProducts = useMemo(() => {
    const filtered = allProducts?.filter(p => p.labels?.includes("Liked")) || [];
    return showMoreLiked ? filtered : filtered.slice(0, 6);
  }, [allProducts, showMoreLiked]);

  const newArrivals = useMemo(() => {
    const filtered = allProducts?.filter(p => p.labels?.includes("New")) || [];
    return showMoreNewArrivals ? filtered : filtered.slice(0, 6);
  }, [allProducts, showMoreNewArrivals]);

  const isFeaturedLoading = isAllProductsLoading;
  const isLikedLoading = isAllProductsLoading;
  const isNewArrivalsLoading = isAllProductsLoading;

  const safeSlide = HERO_SLIDES.length > 0 ? HERO_SLIDES[Math.min(currentSlide, HERO_SLIDES.length - 1)] : undefined;

  const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % HERO_SLIDES.length);
  const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + HERO_SLIDES.length) % HERO_SLIDES.length);

  // Keyboard accessibility
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prevSlide();
      if (e.key === "ArrowRight") nextSlide();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [HERO_SLIDES.length]);

  useEffect(() => {
    if (!isAllProductsLoading && !isCategoriesLoading && !isHeroLoading) {
      (window as any).__SEO_PAGE_READY__ = true;
    }
  }, [isAllProductsLoading, isCategoriesLoading, isHeroLoading]);

  return (
    <div className="min-h-screen flex flex-col font-body overflow-x-hidden">
      <SEO 
        title="PakCart — Online Shopping in Pakistan | Bags, Jewelry, Shoes, Watches, Stitched Dresses & Tech Gadgets"
        description="Shop women's bags & wallets, jewelry, shoes, slippers, stitched dresses, watches and tech gadgets at PakCart. Cash on Delivery, 7-day easy returns and free shipping on orders over Rs. 10,000 nationwide."
        keywords="online shopping pakistan, bags and wallets pakistan, jewelry pakistan, womens shoes pakistan, slippers pakistan, stitched dresses pakistan, mens watches pakistan, tech gadgets pakistan, cash on delivery pakistan, pakcart store"
        url="https://pakcart.store/"
        robots="index,follow"
        isHomePage={true}
        faqs={[
          {
            question: "Does PakCart offer Cash on Delivery (COD) across Pakistan?",
            answer: "Yes — PakCart offers Cash on Delivery on all orders nationwide. You only pay when your parcel is delivered to your doorstep."
          },
          {
            question: "How long does delivery take?",
            answer: "Most orders are dispatched within 24 hours and reach you in 2–5 working days, depending on your city. Major cities like Karachi, Lahore, Islamabad, Rawalpindi and Faisalabad usually receive orders within 2–3 days."
          },
          {
            question: "Is shipping free on PakCart?",
            answer: "Shipping is free on all orders above Rs. 10,000. Below that, a small flat delivery fee applies and is shown at checkout before you confirm your order."
          },
          {
            question: "Can I return or exchange a product?",
            answer: "Yes — PakCart offers an easy 7-day return and exchange policy on eligible products. If something doesn't fit or arrives damaged, contact us within 7 days of delivery."
          },
          {
            question: "What products does PakCart sell?",
            answer: "PakCart sells women's bags & wallets, jewelry, shoes, slippers, stitched dresses, watches and tech gadgets — all sourced from trusted Pakistani brands and suppliers."
          },
          {
            question: "How can I contact PakCart customer support?",
            answer: "You can WhatsApp or SMS our owner Saif Khan at 0318-8055850 (messages only, no calls), or email us at support@pakcart.store. We usually reply within a few hours."
          }
        ]}
      />
      <main className="flex-1">
        {/* Hero Section with Custom Slider — only rendered while we're loading
            slide data or actually have slides to show. With zero active slides
            we render nothing so the page goes straight from the header to the
            trust-indicators row (no empty black placeholder). */}
        {(isHeroLoading || HERO_SLIDES.length > 0) && (
        <section
          className="relative w-full overflow-hidden bg-black group aspect-[768/1024] min-h-[280px] md:aspect-[1920/700] md:min-h-[500px]"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          onTouchStart={(e) => { touchStart.current = e.touches[0].clientX }}
          onTouchEnd={(e) => {
            if (touchStart.current === null) return;
            const touchEnd = e.changedTouches[0].clientX;
            const diff = touchStart.current - touchEnd;
            if (Math.abs(diff) > 50) {
              if (diff > 0) nextSlide();
              else prevSlide();
            }
            touchStart.current = null;
          }}
          tabIndex={0}
          data-testid="hero-section"
        >
          {isHeroLoading ? (
            <div className="w-full h-full bg-muted animate-pulse" />
          ) : HERO_SLIDES.length > 0 && safeSlide ? (
            <>
          {/* `initial={false}` skips the opacity-0 -> opacity-1 fade on first
              mount so the LCP image is painted at full opacity immediately.
              Subsequent slide changes still cross-fade. */}
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={currentSlide}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6, ease: "easeInOut" }}
              className="absolute inset-0"
            >
                  <picture>
                    {safeSlide.image_webp_url ? (
                      <source
                        srcSet={
                          isMobile
                            ? `${getOptimizedImageUrl(safeSlide.image_url, { format: 'webp', width: 480 })} 480w, ${getOptimizedImageUrl(safeSlide.image_url, { format: 'webp', width: 768 })} 768w`
                            : `${getOptimizedImageUrl(safeSlide.image_url, { format: 'webp', width: 1280 })} 1280w, ${getOptimizedImageUrl(safeSlide.image_url, { format: 'webp', width: 1920 })} 1920w`
                        }
                        sizes="100vw"
                        type="image/webp"
                      />
                    ) : (
                      <source
                        srcSet={
                          isMobile
                            ? `${getOptimizedImageUrl(safeSlide.image_url, { format: 'webp', width: 480 })} 480w, ${getOptimizedImageUrl(safeSlide.image_url, { format: 'webp', width: 768 })} 768w`
                            : `${getOptimizedImageUrl(safeSlide.image_url, { format: 'webp', width: 1280 })} 1280w, ${getOptimizedImageUrl(safeSlide.image_url, { format: 'webp', width: 1920 })} 1920w`
                        }
                        sizes="100vw"
                        type="image/webp"
                      />
                    )}
                    <img
                      src={getOptimizedImageUrl(safeSlide.image_url, {
                        quality: 'auto',
                        format: 'auto',
                        width: isMobile ? 768 : 1920,
                      })}
                      srcSet={
                        isMobile
                          ? `${getOptimizedImageUrl(safeSlide.image_url, { width: 480 })} 480w, ${getOptimizedImageUrl(safeSlide.image_url, { width: 768 })} 768w`
                          : `${getOptimizedImageUrl(safeSlide.image_url, { width: 1280 })} 1280w, ${getOptimizedImageUrl(safeSlide.image_url, { width: 1920 })} 1920w`
                      }
                      sizes="100vw"
                      alt={`Hero slide ${currentSlide + 1}`}
                      className="w-full h-full object-cover"
                      loading={currentSlide === 0 ? "eager" : "lazy"}
                      fetchPriority={currentSlide === 0 ? "high" : "low"}
                      decoding={currentSlide === 0 ? "sync" : "async"}
                      width={isMobile ? "768" : "1920"}
                      height={isMobile ? "1024" : "700"}
                    />
                  </picture>
                </motion.div>
              </AnimatePresence>

              {/* Slider Controls */}
              {HERO_SLIDES.length > 1 && (
                <>
                  <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex gap-2" data-testid="hero-pagination">
                    {HERO_SLIDES.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCurrentSlide(idx)}
                        className={`h-2 rounded-full transition-all duration-300 ${idx === currentSlide ? 'w-8 bg-white' : 'w-2 bg-white/40 hover:bg-white/60'}`}
                        aria-label={`Go to slide ${idx + 1}`}
                        data-testid={`hero-dot-${idx}`}
                      />
                    ))}
                  </div>
                  <div className="absolute inset-y-0 left-4 right-4 flex items-center justify-between pointer-events-none">
                    <button 
                      onClick={prevSlide}
                      className="p-2 rounded-full bg-black/20 hover:bg-black/40 text-white transition-all pointer-events-auto opacity-0 group-hover:opacity-100 hidden sm:block"
                      aria-label="Previous slide"
                      data-testid="hero-button-prev"
                    >
                      <ChevronLeft className="h-6 w-6" />
                    </button>
                    <button 
                      onClick={nextSlide}
                      className="p-2 rounded-full bg-black/20 hover:bg-black/40 text-white transition-all pointer-events-auto opacity-0 group-hover:opacity-100 hidden sm:block"
                      aria-label="Next slide"
                      data-testid="hero-button-next"
                    >
                      <ChevronRight className="h-6 w-6" />
                    </button>
                  </div>
                </>
              )}
            </>
          ) : null}
        </section>
        )}

        {/* Trust Indicators */}
        <section className="py-5 sm:py-7 border-b bg-card">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="h-8 w-8 sm:h-10 sm:w-10 bg-primary/10 rounded-full flex items-center justify-center text-primary shrink-0">
                  <Truck className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
                <div>
                  <h4 className="font-bold text-[10px] sm:text-sm">Free Delivery</h4>
                  <p className="text-[8px] sm:text-xs text-muted-foreground whitespace-nowrap">Orders over Rs. 10000</p>
                </div>
              </div>
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="h-8 w-8 sm:h-10 sm:w-10 bg-primary/10 rounded-full flex items-center justify-center text-primary shrink-0">
                  <ShieldCheck className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
                <div>
                  <h4 className="font-bold text-[10px] sm:text-sm">Secure Payment</h4>
                  <p className="text-[8px] sm:text-xs text-muted-foreground whitespace-nowrap">100% Protected</p>
                </div>
              </div>
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="h-8 w-8 sm:h-10 sm:w-10 bg-primary/10 rounded-full flex items-center justify-center text-primary shrink-0">
                  <Clock className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
                <div>
                  <h4 className="font-bold text-[10px] sm:text-sm">24/7 Support</h4>
                  <p className="text-[8px] sm:text-xs text-muted-foreground whitespace-nowrap">Always available</p>
                </div>
              </div>
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="h-8 w-8 sm:h-10 sm:w-10 bg-primary/10 rounded-full flex items-center justify-center text-primary shrink-0">
                  <Star className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
                <div>
                  <h4 className="font-bold text-[10px] sm:text-sm">Top Rated</h4>
                  <p className="text-[8px] sm:text-xs text-muted-foreground whitespace-nowrap">50k+ Happy customers</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Categories Section */}
        <section className="py-5 sm:py-6 bg-muted/20 border-b border-border/40">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">

            {/* Compact header row */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="h-5 w-1 bg-primary rounded-full" />
                <h2 className="font-display text-base sm:text-lg font-bold tracking-tight text-foreground uppercase">
                  Shop by Category
                </h2>
              </div>
              <Link href="/categories" className="text-xs sm:text-sm text-primary font-semibold flex items-center gap-1 hover:gap-2 transition-all duration-200">
                View All <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Category bubbles — 4-col grid on mobile, 5-col grid on tablet, centered row on desktop */}
            <div className="relative">
              <div
                ref={categoriesScrollRef}
                className="grid grid-cols-4 place-items-center gap-x-3 gap-y-5 sm:grid-cols-5 sm:gap-x-4 sm:gap-y-6 lg:flex lg:flex-row lg:justify-center lg:gap-6 lg:overflow-x-auto lg:scroll-smooth pt-2 pb-3"
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" } as React.CSSProperties}
              >
                {isCategoriesLoading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className="flex flex-col items-center gap-2">
                      <Skeleton className="w-[68px] h-[68px] sm:w-[88px] sm:h-[88px] lg:w-24 lg:h-24 rounded-full" />
                      <Skeleton className="h-3 w-14 rounded" />
                    </div>
                  ))
                ) : (
                  categories.map((category, index) => {
                    let categoryImage = category.image || categoriesListImage;
                    if (category.name.toLowerCase() === "bags") categoryImage = bagsCategoryImage;
                    else if (category.name.toLowerCase() === "slippers") categoryImage = slippersCategoryImage;
                    else if (category.name.toLowerCase() === "shoes") categoryImage = shoesCategoryImage;
                    else if (category.name.toLowerCase().includes("eid special")) categoryImage = eidSpecialImage;
                    else if (category.name.toLowerCase().includes("watches")) categoryImage = watchesImage;
                    const linkHref = `/collections/${category.slug || String(category.id)}`;
                    const optimizedImg = getOptimizedImageUrl(categoryImage, { width: 192, height: 192, crop: "fill" });
                    return (
                      <Link key={category.id} href={linkHref} className="flex-none flex flex-col items-center gap-2 group cursor-pointer">
                        <div className="relative w-[68px] h-[68px] sm:w-[88px] sm:h-[88px] lg:w-24 lg:h-24 rounded-full overflow-hidden ring-2 ring-border group-hover:ring-primary transition-all duration-300 shadow-sm group-hover:shadow-md group-hover:scale-105 transform">
                          <img
                            src={optimizedImg}
                            alt={category.name}
                            width="96"
                            height="96"
                            loading={index < 5 ? "eager" : "lazy"}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors duration-300 rounded-full" />
                        </div>
                        <span className="text-[10px] sm:text-[11px] lg:text-xs font-semibold text-center text-foreground/80 group-hover:text-primary transition-colors duration-200 leading-tight w-[72px] sm:w-[96px] lg:w-[100px] line-clamp-2">
                          {category.name}
                        </span>
                      </Link>
                    );
                  })
                )}
              </div>

            </div>

          </div>
        </section>

        {/* New Arrivals */}
        <section
          className="py-10 bg-muted/30"
          style={{ contentVisibility: 'auto', containIntrinsicSize: '1px 1200px' }}
        >
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
              >
                <h2 className="font-display text-4xl font-bold text-foreground mb-2">New Arrivals</h2>
                <div className="h-1.5 w-16 bg-secondary rounded-full" />
              </motion.div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6 sm:gap-8">
              {isNewArrivalsLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="space-y-4">
                    <Skeleton className="h-[300px] w-full rounded-2xl" />
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-4 w-1/3" />
                  </div>
                ))
              ) : (
                // ProductCard has its own framer-motion entrance + hover,
                // so we render it directly to avoid wrapping every card in a
                // second IntersectionObserver-driven motion.div.
                newArrivals?.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))
              )}
            </div>

            {allProducts && allProducts.length > 5 && (
              <div className="mt-6 text-center">
                <Button 
                  variant="outline" 
                  size="lg"
                  onClick={() => setShowMoreNewArrivals(!showMoreNewArrivals)}
                  className="rounded-full min-w-[200px]"
                >
                  {showMoreNewArrivals ? "Show Less" : "Show More"}
                </Button>
              </div>
            )}
          </div>
        </section>

        {/* Per-Category Sections */}
        {(() => {
          const preferredKeywords = ["watch", "wallet", "bag", "jewel", "dress"];
          const orderIndex = (name: string) => {
            const lower = (name || "").toLowerCase().trim();
            for (let i = 0; i < preferredKeywords.length; i++) {
              if (lower.includes(preferredKeywords[i])) return i;
            }
            return preferredKeywords.length;
          };
          return [...categories].sort((a, b) => {
            const diff = orderIndex(a.name) - orderIndex(b.name);
            if (diff !== 0) return diff;
            return a.name.localeCompare(b.name);
          });
        })().map((category, catIndex) => {
          const categoryProducts = allProducts?.filter(p => p.categoryId === category.id) || [];
          const categorySlug = category.slug || String(category.id);
          const isExpanded = expandedCategories.has(category.id);
          const visibleProducts = isExpanded ? categoryProducts : categoryProducts.slice(0, 6);
          const hasProducts = categoryProducts.length > 0;
          return (
            <section
              key={category.id}
              className="py-10 bg-muted/30"
              data-testid={`section-category-${categorySlug}`}
              style={{ contentVisibility: 'auto', containIntrinsicSize: '1px 1200px' }}
            >
              <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                  >
                    <h2 className="font-display text-4xl font-bold text-foreground mb-2" data-testid={`heading-category-${categorySlug}`}>
                      {category.name}
                    </h2>
                    <div className="h-1.5 w-16 bg-secondary rounded-full" />
                  </motion.div>
                  <Link href={`/collections/${categorySlug}`}>
                    <Button
                      variant="ghost"
                      className="text-primary hover:text-primary/80"
                      data-testid={`link-view-all-${categorySlug}`}
                    >
                      View All <ArrowRight className="h-4 w-4 ml-1" />
                    </Button>
                  </Link>
                </div>

                {isAllProductsLoading ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6 sm:gap-8">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="space-y-4">
                        <Skeleton className="h-[300px] w-full rounded-2xl" />
                        <Skeleton className="h-4 w-2/3" />
                        <Skeleton className="h-4 w-1/3" />
                      </div>
                    ))}
                  </div>
                ) : hasProducts ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6 sm:gap-8">
                    {visibleProducts.map((product) => (
                      <ProductCard key={product.id} product={product} />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-border bg-card/40 py-12 text-center" data-testid={`empty-category-${categorySlug}`}>
                    <p className="text-muted-foreground mb-4">
                      No products in {category.name} yet.
                    </p>
                    <Link href={`/collections/${categorySlug}`}>
                      <Button variant="outline" className="rounded-full">
                        Browse {category.name} <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    </Link>
                  </div>
                )}

                {hasProducts && categoryProducts.length > 5 && (
                  <div className="mt-6 text-center">
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={() => toggleCategoryExpansion(category.id)}
                      className="rounded-full min-w-[200px]"
                      data-testid={`button-show-more-${categorySlug}`}
                    >
                      {isExpanded ? "Show Less" : "Show More"}
                    </Button>
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </main>
    </div>
  );
}
