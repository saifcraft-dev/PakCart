import { useRoute, Link, useLocation } from "wouter";
import { useCartStore } from "@/store/cartStore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Minus, Plus, ShoppingCart, ChevronLeft, Star, Check, Loader2, Zap, Download, Package, ExternalLink } from "lucide-react";
import logoImg from "@/assets/logo.png";
import { useDropshipperStatus } from "@/hooks/use-dropshipper-status";
import { MediaDownloadDialog } from "@/components/product/MediaDownloadDialog";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import SEO from "@/components/SEO";
import { Card, CardContent } from "@/components/ui/card";
import { getOptimizedImageUrl, getWatermarkedVideoUrl } from "@/lib/cloudinary";
import { Play } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { productFirestoreService } from "@/services/productFirestoreService";
import { categoryFirestoreService } from "@/services/categoryFirestoreService";
import { Separator } from "@/components/ui/separator";
import { ProductCard } from "@/components/product/ProductCard";
import { CommentSection } from "@/components/product/CommentSection";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { useRealtimeCollection } from "@/hooks/use-firestore-realtime";
import { commentSchema } from "@shared/schema";
import { where } from "firebase/firestore";
import { AIRecommendations } from "@/components/ai/AIRecommendations";

export default function ProductDetail() {
  const [, params] = useRoute("/products/:slug");
  const slug = params?.slug || "";
  const [location] = useLocation();
  
  const { data: product, isLoading, error } = useQuery({
    queryKey: ["product", slug],
    queryFn: () => productFirestoreService.getProductBySlug(slug),
  });

  // Real-time rating/reviews from Firestore
  const constraints = useMemo(() => [where("productId", "==", product?.id || "")], [product?.id]);
  const { data: comments, isLoading: isLoadingReviews } = useRealtimeCollection(
    "comments",
    commentSchema,
    ["comments", product?.id],
    constraints
  );

  const { displayRating, displayReviewCount } = useMemo(() => {
    if (!comments || comments.length === 0) {
      return { displayRating: "0.0", displayReviewCount: 0 };
    }
    const total = comments.reduce((acc, c) => acc + (Number(c.rating) || 0), 0);
    return {
      displayRating: (total / comments.length).toFixed(1),
      displayReviewCount: comments.length
    };
  }, [comments]);

  const { data: category } = useQuery({
    queryKey: ["category", product?.categoryId],
    enabled: !!product?.categoryId,
    queryFn: () => categoryFirestoreService.getCategory(String(product!.categoryId!)),
  });

  const { data: relatedProductsData } = useQuery({
    queryKey: ["products", "related", product?.categoryId],
    enabled: !!product?.categoryId,
    queryFn: () => productFirestoreService.getProductsByCategory(String(product!.categoryId!)),
  });

  const { data: allProductsPool } = useQuery({
    queryKey: ["products", "ai-pool"],
    queryFn: () => productFirestoreService.getAllProducts({ limit: 20 }),
    staleTime: 5 * 60_000,
    enabled: !!product,
  });

  const [, setLocation] = useLocation();
  const addToCart = useCartStore(state => state.addToCart);
  const { toast } = useToast();
  const { isApprovedDropshipper } = useDropshipperStatus();
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
  const [showVideo, setShowVideo] = useState(false);
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({}); 
  const [mediaOpen, setMediaOpen] = useState(false);
  const [imageDownloading, setImageDownloading] = useState(false);

  const downloadWatermarkedImage = async (imageUrl: string, filename: string) => {
    setImageDownloading(true);
    try {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas not supported");

      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Image load failed"));
        img.src = imageUrl;
      });

      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      ctx.drawImage(img, 0, 0);

      const logo = new Image();
      logo.crossOrigin = "anonymous";
      await new Promise<void>((resolve) => {
        logo.onload = () => resolve();
        logo.onerror = () => resolve();
        logo.src = logoImg;
      });

      if (logo.complete && logo.naturalWidth > 0) {
        const logoH = Math.round(canvas.height * 0.07);
        const logoW = Math.round((logo.naturalWidth / logo.naturalHeight) * logoH);
        const margin = Math.round(canvas.width * 0.02);
        const x = canvas.width - logoW - margin;
        const y = margin;
        ctx.fillStyle = "rgba(255,255,255,0.8)";
        const pad = Math.round(logoH * 0.15);
        ctx.beginPath();
        ctx.roundRect(x - pad, y - pad, logoW + pad * 2, logoH + pad * 2, 6);
        ctx.fill();
        ctx.drawImage(logo, x, y, logoW, logoH);
      }

      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, "image/jpeg", 0.92);
    } catch {
      window.open(imageUrl, "_blank");
    } finally {
      setImageDownloading(false);
    }
  };

  useEffect(() => {
    if (product) {
      (window as any).__SEO_PAGE_READY__ = true;
    }
  }, [product]);

  const images = useMemo(() => {
    const baseImages = product?.images && product.images.length > 0 
      ? product.images 
      : ["https://placehold.co/600x600?text=No+Image"];

    // Add variant images to the gallery if they are not already there
    const variantImages: string[] = [];
    if (product?.variants) {
      product.variants.forEach(variant => {
        variant.options.forEach(option => {
          if (option.image && !baseImages.includes(option.image) && !variantImages.includes(option.image)) {
            variantImages.push(option.image);
          }
        });
      });
    }

    return [...baseImages, ...variantImages];
  }, [product]);

  const activeImageUrl = useMemo(() => {
    // 1. Check if a variant with an image is selected
    if (product?.variants) {
      for (const variant of product.variants) {
        const selectedOptionId = selectedVariants[variant.name];
        if (selectedOptionId) {
          const option = variant.options.find(o => o.id === selectedOptionId);
          if (option?.image) {
            return option.image;
          }
        }
      }
    }
    
    // 2. Fallback to the main gallery active image
    return images[activeImage] || images[0];
  }, [product, selectedVariants, images, activeImage]);

  // Handle variant image switching
  const handleVariantSelect = (variantName: string, optionId: string) => {
    setSelectedVariants(prev => ({ ...prev, [variantName]: optionId }));
    setShowVideo(false);
    
    // Also try to sync the activeImage index if the variant image exists in the gallery
    const variant = product?.variants?.find(v => v.name === variantName);
    const option = variant?.options.find(o => o.id === optionId);
    if (option?.image) {
      const existingIdx = images.findIndex(img => img === option.image);
      if (existingIdx !== -1) {
        setActiveImage(existingIdx);
      }
    }
  };

  // Calculate adjusted price based on variants
  const currentPrice = useMemo(() => {
    if (!product) return 0;
    let basePrice = product.price + (product.profit || 0);
    
    if (product.variants) {
      product.variants.forEach(variant => {
        const selectedOptionId = selectedVariants[variant.name];
        if (selectedOptionId) {
          const option = variant.options.find(o => o.id === selectedOptionId);
          if (option?.price) {
            // If variant has price, we assume it's the new base price (cost)
            basePrice = option.price + (product.profit || 0);
          }
        }
      });
    }
    return basePrice;
  }, [product, selectedVariants]);

  const handleAddToCart = (shouldRedirect = false) => {
    if (product) {
      // Check if all variants are selected
      if (product.variants && product.variants.length > 0) {
        const unselected = product.variants.filter(v => !selectedVariants[v.name]);
        if (unselected.length > 0) {
          toast({
            title: "Please select options",
            description: `Please select ${unselected.map(u => u.name).join(', ')}`,
            variant: "destructive"
          });
          return;
        }
      }

      const productWithAdjustedPrice = { 
        ...product, 
        price: currentPrice,
        selectedVariant: Object.entries(selectedVariants).reduce((acc, [key, optionId]) => {
          const variant = product.variants?.find(v => v.name === key);
          const option = variant?.options.find(o => o.id === optionId);
          if (option) acc[key] = option.value;
          return acc;
        }, {} as Record<string, string>)
      };
      addToCart(productWithAdjustedPrice as any, quantity);
      
      if (shouldRedirect) {
        setLocation("/cart");
      } else {
        toast({
          title: "Added to cart",
          description: `${quantity} x ${product.name} added to your cart.`,
        });
      }
    }
  };

  const handleBuyNow = () => {
    handleAddToCart(true);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      maximumFractionDigits: 0
    }).format(price);
  };

  const relatedProducts = (relatedProductsData || [])
    .filter((p: any) => p.id !== product?.id)
    .slice(0, 4);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12 mb-12">
          <Skeleton className="aspect-square rounded-2xl" />
          <div className="space-y-6">
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-3/4" />
            </div>
            <Skeleton className="h-8 w-1/3" />
            <Skeleton className="h-32 w-full" />
            <div className="flex gap-4">
              <Skeleton className="h-12 w-32" />
              <Skeleton className="h-12 flex-1" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <SEO
          title="Product Not Found"
          description="The product you are looking for may have been removed or is no longer available."
          robots="noindex,follow"
        />
        <h2 className="text-2xl font-bold mb-4 text-foreground">Product Not Found</h2>
        <p className="text-muted-foreground mb-8">The product you are looking for might have been moved or removed.</p>
        <Button asChild>
          <Link href="/products">Return to Shop</Link>
        </Button>
      </div>
    );
  }

  const faqItems = [
    { question: "How should I care for this product?", answer: "For best results, please refer to the care instructions provided with your product. Generally, handle with care and store in a dry place away from direct sunlight." },
    { question: "What is the sizing or fit information for this product?", answer: "Check the specifications and size chart above for detailed dimensions and sizing information. If you need personalized assistance with sizing, please contact our support team at support@pakcart.store." },
    { question: "How can I verify the authenticity of this product?", answer: "All products sold on PakCart are authentic and sourced directly from authorized suppliers. We guarantee the authenticity of every item." },
    { question: "How long does shipping take?", answer: "Delivery times vary by location within Pakistan. Typically, orders are delivered within 3-7 business days from the date of dispatch. Orders are usually dispatched within 24-48 hours." },
    { question: "What if my product arrives damaged?", answer: "If your product arrives damaged, please contact us immediately at support@pakcart.store with photos and your order number. We will arrange a replacement as per our policy." },
    { question: "Is customization available for this product?", answer: "Customization options depend on the specific product. Check the product options above to see available variants. For special customization requests, please contact our team at support@pakcart.store." },
    { question: "How can I leave a review for this product?", answer: "You can leave a review in the Customer Reviews tab above. Share your experience with the product, rate it from 1-5 stars, and help other customers make informed decisions." },
    { question: "Are there any discounts for first-time buyers?", answer: "We frequently offer promotions and seasonal discounts. Sign up for our newsletter to receive the latest updates on exclusive deals and offers for our valued customers." },
    { question: "What should I do if my order arrives damaged?", answer: "If you receive a damaged product, please contact us immediately at support@pakcart.store with photos of the damage and your order number. We will arrange for a replacement or refund as per our policy." }
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <SEO 
        title={`${product.name} | Buy Online in Pakistan - PakCart`} 
        description={`${product.description.substring(0, 150)}... Buy ${product.name} at the best price in Pakistan. Fast shipping and Cash on Delivery available.`}
        url={`https://pakcart.store/products/${product.slug}`}
        type="product"
        image={images[0]}
        productData={{
          name: product.name,
          description: product.description,
          image: images,
          price: currentPrice,
          priceCurrency: "PKR",
          rating: parseFloat(displayRating),
          reviewCount: displayReviewCount,
          inStock: (product.stock ?? 0) > 0,
          availability: (product.stock ?? 0) > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock"
        }}
        breadcrumbs={[
          { name: "Home", url: "/" },
          ...(category ? [{ name: category.name, url: `/collections/${category.slug || category.id}` }] : []),
          { name: product.name, url: `/products/${product.slug}` }
        ]}
        faqs={faqItems}
      />
      
      <Breadcrumb className="mb-6">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/">Home</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/products">Shop</BreadcrumbLink>
          </BreadcrumbItem>
          {category && (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href={`/collections/${category.slug || category.id}`}>{category.name}</BreadcrumbLink>
              </BreadcrumbItem>
            </>
          )}
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{product.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 md:gap-8 xl:gap-12 mb-8 sm:mb-12 lg:mb-16 xl:mb-20">
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 md:gap-4 lg:sticky lg:top-24 h-fit">
          {images.length > 0 && (
            <div className="flex flex-row sm:flex-col gap-2 sm:gap-3 overflow-x-auto sm:overflow-y-auto pb-2 sm:pb-0 sm:pr-2 scrollbar-hide sm:max-h-[300px] md:max-h-[400px] lg:max-h-[500px] order-2 sm:order-1">
              {product.videoUrl && (
                <button
                  onClick={() => setShowVideo(true)}
                  className={`relative w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 flex-shrink-0 rounded-lg sm:rounded-xl overflow-hidden border-2 transition-all flex items-center justify-center bg-black ${
                    showVideo 
                      ? "border-primary ring-2 ring-primary/10" 
                      : "border-transparent opacity-70 hover:opacity-100 hover:border-primary/30"
                  }`}
                >
                  <Play className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-white" />
                </button>
              )}
              {images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setActiveImage(idx);
                    setShowVideo(false);
                  }}
                  className={`relative w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 flex-shrink-0 rounded-lg sm:rounded-xl overflow-hidden border-2 transition-all ${
                    !showVideo && activeImage === idx 
                      ? "border-primary ring-2 ring-primary/10" 
                      : "border-transparent opacity-70 hover:opacity-100 hover:border-primary/30"
                  }`}
                >
                  <img src={getOptimizedImageUrl(img, { width: 100, height: 100, crop: 'fill' })} alt={`${product.name} thumbnail ${idx + 1}`} className="w-full h-full object-cover" width="100" height="100" loading="lazy" />
                </button>
              ))}
            </div>
          )}
          
          <Card className="flex-1 overflow-hidden border border-border/50 shadow-sm rounded-xl sm:rounded-2xl order-1 sm:order-2">
            <CardContent className="p-0 aspect-square relative bg-black select-none">
              <AnimatePresence mode="wait">
                {showVideo && product.videoUrl ? (
                  <motion.div
                    key="video"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="w-full h-full relative"
                  >
                    <video 
                      src={!isApprovedDropshipper ? getWatermarkedVideoUrl(product.videoUrl) : product.videoUrl}
                      controls 
                      autoPlay
                      className="w-full h-full object-contain"
                    />
                  </motion.div>
                ) : (
                  <motion.img
                    key={activeImage}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    src={getOptimizedImageUrl(activeImageUrl, { width: 800, height: 800, crop: 'fill' })}
                    alt={product.name}
                    className="w-full h-full object-cover"
                    width="800"
                    height="800"
                    fetchPriority="high"
                    onContextMenu={!isApprovedDropshipper ? (e) => e.preventDefault() : undefined}
                    onDragStart={!isApprovedDropshipper ? (e) => e.preventDefault() : undefined}
                  />
                )}
              </AnimatePresence>

              {/* Watermark overlay — hidden for approved dropshippers */}
              {!isApprovedDropshipper && !showVideo && (
                <div className="absolute top-2 right-2 sm:top-4 sm:right-4 pointer-events-none bg-white/80 rounded-md sm:rounded-lg px-1.5 py-0.5 sm:px-2 sm:py-1">
                  <img
                    src={logoImg}
                    alt="PakCart"
                    className="h-4 sm:h-9 w-auto object-contain"
                    draggable={false}
                  />
                </div>
              )}

              {/* Download button for regular users — downloads watermarked image */}
              {!isApprovedDropshipper && !showVideo && (
                <button
                  onClick={() => downloadWatermarkedImage(
                    getOptimizedImageUrl(activeImageUrl, { width: 1200, height: 1200, crop: 'fill' }),
                    `pakcart-${product.slug}-image.jpg`
                  )}
                  disabled={imageDownloading}
                  className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 bg-white/80 hover:bg-white transition-colors rounded-md sm:rounded-lg p-1.5 sm:p-2 shadow-sm"
                  title="Download image"
                >
                  {imageDownloading
                    ? <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin text-gray-600" />
                    : <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-600" />
                  }
                </button>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4 sm:gap-6">
          <div className="space-y-3 sm:space-y-4 md:space-y-6">
            <div className="space-y-1.5 sm:space-y-2">
              {category && (
                <p className="text-xs sm:text-xs md:text-sm font-medium text-muted-foreground uppercase tracking-widest">
                  {category.name}
                </p>
              )}
              <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-foreground tracking-tight leading-tight break-words">
                {product.name}
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {isLoadingReviews ? (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-muted/30 rounded-full border text-xs sm:text-sm">
                  <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 animate-spin text-muted-foreground" />
                </div>
              ) : (Number(displayReviewCount) > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-yellow-50 dark:bg-yellow-950/30 rounded-full border border-yellow-200/50 dark:border-yellow-800/30 text-xs sm:text-sm">
                  <Star className="w-3 h-3 sm:w-4 sm:h-4 fill-yellow-500 text-yellow-500" />
                  <span className="font-bold text-yellow-700 dark:text-yellow-500">{displayRating}</span>
                </div>
              ))}
              <span className="text-muted-foreground text-xs sm:text-sm">({displayReviewCount} reviews)</span>
              <Separator orientation="vertical" className="h-3 hidden sm:block" />
              <Badge variant={product.inStock ? "secondary" : "destructive"} className="rounded-full px-3 text-xs sm:text-sm">
                {product.inStock ? "In Stock" : "Out of Stock"}
              </Badge>
            </div>
            
            <div className="flex items-baseline gap-2 sm:gap-3 flex-wrap">
              <span className="text-3xl sm:text-4xl md:text-5xl font-bold text-primary">
                {formatPrice(currentPrice)}
              </span>
              {product.originalPrice && (
                <span className="text-lg sm:text-xl text-muted-foreground line-through decoration-muted-foreground/50 font-normal">
                  {formatPrice(product.originalPrice)}
                </span>
              )}
            </div>

            <div className="text-muted-foreground text-sm sm:text-base md:text-lg leading-relaxed max-w-full break-words">
              {product.description}
            </div>

            {/* Product Variants Selection */}
            {product.variants && product.variants.length > 0 && (
              <div className="space-y-4 sm:space-y-6 pt-4 border-t border-border/50">
                {product.variants.map((variant) => (
                  <div key={variant.name} className="space-y-2 sm:space-y-3">
                    <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-2 flex-wrap">
                      {variant.name}
                      {selectedVariants[variant.name] && (
                        <span className="text-primary normal-case font-normal text-xs bg-primary/10 px-2 py-0.5 rounded-full">
                          {variant.options.find(o => o.id === selectedVariants[variant.name])?.value}
                        </span>
                      )}
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {variant.options.map((option) => (
                        <button
                          key={option.id}
                          onClick={() => handleVariantSelect(variant.name, option.id)}
                          className={`group relative overflow-hidden px-3 sm:px-4 py-2 rounded-lg border-2 text-xs sm:text-sm font-medium transition-all ${
                            selectedVariants[variant.name] === option.id
                              ? "border-primary bg-primary/5 text-primary shadow-sm ring-1 ring-primary/20"
                              : "border-border/50 bg-background hover:border-primary/30 hover:bg-accent/50"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {option.image && (
                              <img 
                                src={getOptimizedImageUrl(option.image, { width: 40, height: 40 })} 
                                alt={option.value}
                                className="w-5 h-5 sm:w-6 sm:h-6 rounded-md object-cover border border-border/50"
                              />
                            )}
                            <span className="truncate">{option.value}</span>
                          </div>
                          {(() => {
                            // Show the FINAL selling price for the variant (cost + profit),
                            // not the raw cost — otherwise customers see two different prices
                            // (the chip badge and the main displayed price) for the same item.
                            // Hide the badge when it equals the base displayed price.
                            if (!option.price) return null;
                            const profit = product.profit || 0;
                            const optionFinal = option.price + profit;
                            const baseFinal = product.price + profit;
                            if (optionFinal === baseFinal) return null;
                            return (
                              <span
                                className="ml-1 sm:ml-1.5 opacity-60 text-xs"
                                data-testid={`text-variant-price-${option.id}`}
                              >
                                ({formatPrice(optionFinal)})
                              </span>
                            );
                          })()}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {product.features && product.features.length > 0 && (
              <div className="py-4 sm:py-6 border-t border-border/50 mt-4 sm:mt-6">
                <h3 className="font-bold text-foreground mb-3 sm:mb-4 uppercase text-xs tracking-widest">Key Features</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 sm:gap-x-8 gap-y-2 sm:gap-y-3">
                  {product.features.map((feature, i) => (
                    <div key={i} className="flex items-start text-xs sm:text-sm text-muted-foreground bg-accent/30 p-2 sm:p-3 rounded-lg border border-border/10">
                      <Check className="mt-0.5 w-3 h-3 sm:w-4 sm:h-4 text-primary mr-2 sm:mr-3 flex-shrink-0" />
                      {feature}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3 sm:gap-4 pt-4 sm:pt-6 md:pt-8 border-t border-border/50 mt-4 sm:mt-6">
              <div className="flex items-center border rounded-md bg-background p-1 w-full sm:w-fit justify-between">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 sm:h-9 sm:w-9 no-default-hover-elevate"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  disabled={quantity <= 1}
                >
                  <Minus className="w-3 h-3 sm:w-4 sm:h-4" />
                </Button>
                <span className="w-10 sm:w-12 text-center font-bold text-base sm:text-lg">{quantity}</span>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 sm:h-9 sm:w-9 no-default-hover-elevate"
                  onClick={() => setQuantity(quantity + 1)}
                >
                  <Plus className="w-3 h-3 sm:w-4 sm:h-4" />
                </Button>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 w-full">
                <Button 
                  variant="outline"
                  className="flex-1 h-11 sm:h-12 rounded-md gap-2 sm:gap-3 font-bold text-sm sm:text-base shadow-sm transition-all active:scale-[0.98]" 
                  onClick={() => handleAddToCart(false)}
                  disabled={!product.inStock}
                  data-testid="button-add-to-cart"
                >
                  <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="hidden xs:inline">{product.inStock ? "Add to Cart" : "Out of Stock"}</span>
                  <span className="inline xs:hidden">{product.inStock ? "Add" : "Out"}</span>
                </Button>
                <Button 
                  className="flex-1 h-11 sm:h-12 bg-primary hover:bg-primary/90 text-white rounded-md gap-2 sm:gap-3 font-bold text-sm sm:text-base shadow-md transition-all active:scale-[0.98]" 
                  onClick={handleBuyNow}
                  disabled={!product.inStock}
                  data-testid="button-buy-now"
                >
                  <Zap className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
                  Buy Now
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Dropshipper Tools */}
      {isApprovedDropshipper && (
        <>
          <MediaDownloadDialog
            product={product}
            open={mediaOpen}
            onClose={() => setMediaOpen(false)}
          />
          <div className="mb-10 rounded-2xl border border-green-200 bg-green-50 overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-3 bg-green-700 text-white">
              <Package className="h-4 w-4 shrink-0" />
              <span className="font-semibold text-sm tracking-wide">Dropshipper Tools</span>
              <Badge className="ml-auto bg-white/20 text-white border-0 text-xs hover:bg-white/20">
                Approved
              </Badge>
            </div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Wholesale Price */}
              {typeof product.wholesalePrice === "number" && product.wholesalePrice > 0 && (
                <div className="bg-white rounded-xl border border-green-100 p-4">
                  <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-1">
                    Wholesale Price
                  </p>
                  <p className="text-2xl font-bold text-gray-900">
                    Rs. {product.wholesalePrice.toLocaleString()}
                  </p>
                  {product.price > product.wholesalePrice && (
                    <p className="text-xs text-green-600 mt-1">
                      Your margin: Rs. {(product.price - product.wholesalePrice).toLocaleString()}
                    </p>
                  )}
                </div>
              )}

              {/* Download Button */}
              <div className="bg-white rounded-xl border border-green-100 p-4 flex flex-col gap-2 justify-between">
                <div>
                  <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-1">
                    Download
                  </p>
                  <p className="text-xs text-gray-500">
                    Export product details, photos, variant images &amp; video
                  </p>
                </div>
                <Button
                  className="bg-green-700 hover:bg-green-800 text-white gap-2 w-full mt-1"
                  size="sm"
                  onClick={() => setMediaOpen(true)}
                  data-testid="btn-dropshipper-download"
                >
                  <Download className="h-4 w-4" />
                  Download Product
                </Button>
              </div>

              {/* Catalog Link */}
              <div className="bg-white rounded-xl border border-green-100 p-4 flex flex-col gap-2 justify-between">
                <div>
                  <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-1">
                    Full Catalog
                  </p>
                  <p className="text-xs text-gray-500">
                    Browse all products and download in bulk from your catalog
                  </p>
                </div>
                <Link href="/dropshipper/catalog">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-green-600 text-green-700 hover:bg-green-700 hover:text-white gap-2 w-full mt-1"
                    data-testid="btn-dropshipper-catalog"
                  >
                    <ExternalLink className="h-4 w-4" />
                    View Catalog
                  </Button>
                </Link>
              </div>

            </div>
          </div>
        </>
      )}

      <section className="mb-16">
        <Tabs defaultValue="description" className="w-full">
          <TabsList className="w-full flex flex-row justify-start border-b rounded-none h-auto p-0 bg-transparent overflow-x-auto scrollbar-hide">
            <TabsTrigger 
              value="description" 
              className="flex-shrink-0 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 sm:px-6 py-3 font-semibold text-xs sm:text-base transition-none whitespace-nowrap"
            >
              Product details
            </TabsTrigger>
            <TabsTrigger 
              value="faq" 
              className="flex-shrink-0 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 sm:px-6 py-3 font-semibold text-xs sm:text-base transition-none whitespace-nowrap"
            >
              FAQ
            </TabsTrigger>
            <TabsTrigger 
              value="reviews" 
              className="flex-shrink-0 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 sm:px-6 py-3 font-semibold text-xs sm:text-base transition-none whitespace-nowrap"
            >
              Customer Reviews
            </TabsTrigger>
          </TabsList>
          <TabsContent value="description" className="pt-4 sm:pt-6 md:pt-8 focus-visible:ring-0 px-0">
            <div className="max-w-full md:max-w-4xl">
              <div 
                className="prose prose-stone dark:prose-invert max-w-none text-muted-foreground text-sm sm:text-base md:text-lg leading-relaxed prose-sm sm:prose-base"
                style={{
                  "--tw-prose-p-margin": "1em 0",
                  "--tw-prose-headings-font-weight": "700",
                  "--tw-prose-li-marker-color": "hsl(var(--primary))",
                  "--tw-prose-hr-border-color": "hsl(var(--border))",
                  "--tw-prose-strong-color": "hsl(var(--foreground))",
                  "--tw-prose-code-bg": "hsl(var(--accent) / 0.1)",
                  "--tw-prose-code-color": "hsl(var(--primary))",
                  "--tw-prose-th-borders-color": "hsl(var(--border))",
                  "--tw-prose-td-borders-color": "hsl(var(--border))",
                  "--tw-prose-table-border-color": "hsl(var(--border))",
                } as any}
                dangerouslySetInnerHTML={{ __html: product.longDescription || "No detailed description available for this product." }}
              />
              
              {product.specifications && Object.keys(product.specifications).length > 0 && (
                <div className="mt-8 sm:mt-10 md:mt-12">
                  <h3 className="text-lg sm:text-xl md:text-2xl font-bold mb-4 sm:mb-5 md:mb-6 text-foreground">Specifications</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-2 sm:gap-3 md:gap-4 overflow-x-auto">
                    {Object.entries(product.specifications).map(([key, value]) => (
                      <div key={key} className="flex flex-col sm:flex-row gap-2 sm:gap-3 border-b border-border/50 pb-3 sm:pb-3 min-w-0">
                        <span className="font-semibold text-foreground sm:w-1/3 break-words text-sm sm:text-base">{key}</span>
                        <span className="text-muted-foreground text-sm sm:text-base break-words">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
          <TabsContent value="faq" className="pt-4 sm:pt-6 md:pt-8 focus-visible:ring-0 px-0">
            <div className="w-full max-w-4xl">
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="material-care">
                  <AccordionTrigger className="text-sm sm:text-base md:text-lg font-semibold text-left py-4 sm:py-5 leading-snug">
                    How should I care for this product?
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground text-sm sm:text-base leading-relaxed pb-4 sm:pb-5">
                    For best results, please refer to the care instructions provided with your product. Generally, handle with care and store in a dry place away from direct sunlight. If specific care instructions are available, they will be mentioned in the product specifications section above.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="sizing">
                  <AccordionTrigger className="text-sm sm:text-base md:text-lg font-semibold text-left py-4 sm:py-5 leading-snug">
                    What is the sizing or fit information for this product?
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground text-sm sm:text-base leading-relaxed pb-4 sm:pb-5">
                    Check the specifications and size chart above for detailed dimensions and sizing information. If you need personalized assistance with sizing, please contact our support team at support@pakcart.store.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="authenticity">
                  <AccordionTrigger className="text-sm sm:text-base md:text-lg font-semibold text-left py-4 sm:py-5 leading-snug">
                    How can I verify the authenticity of this product?
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground text-sm sm:text-base leading-relaxed pb-4 sm:pb-5">
                    All products sold on PakCart are authentic and sourced directly from authorized suppliers. We guarantee the authenticity of every item. If you have any concerns about the authenticity of your purchase, please contact us immediately for a full refund or replacement.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="shipping-time">
                  <AccordionTrigger className="text-sm sm:text-base md:text-lg font-semibold text-left py-4 sm:py-5 leading-snug">
                    How long does shipping take?
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground text-sm sm:text-base leading-relaxed pb-4 sm:pb-5">
                    Delivery times vary by location within Pakistan. Typically, orders are delivered within 3-7 business days from the date of dispatch. Orders are usually dispatched within 24-48 hours. You'll receive a tracking number via email once your order ships.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="return-policy">
                  <AccordionTrigger className="text-sm sm:text-base md:text-lg font-semibold text-left py-4 sm:py-5 leading-snug">
                    What if my product arrives damaged?
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground text-sm sm:text-base leading-relaxed pb-4 sm:pb-5">
                    If your product arrives damaged or defective, please contact us immediately at support@pakcart.store with photos and your order number. We will arrange a replacement as quickly as possible.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="customization">
                  <AccordionTrigger className="text-sm sm:text-base md:text-lg font-semibold text-left py-4 sm:py-5 leading-snug">
                    Is customization available for this product?
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground text-sm sm:text-base leading-relaxed pb-4 sm:pb-5">
                    Customization options depend on the specific product. Check the product options above to see available variants. For special customization requests beyond what's listed, please contact our team at support@pakcart.store to discuss your needs.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="reviews-help">
                  <AccordionTrigger className="text-sm sm:text-base md:text-lg font-semibold text-left py-4 sm:py-5 leading-snug">
                    How can I leave a review for this product?
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground text-sm sm:text-base leading-relaxed pb-4 sm:pb-5">
                    You can leave a review in the "Customer Reviews" tab above. Share your experience with the product, rate it from 1-5 stars, and help other customers make informed decisions. We value your feedback!
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </TabsContent>
          <TabsContent value="reviews" className="pt-6 sm:pt-8 focus-visible:ring-0">
            <CommentSection productId={product.id} />
          </TabsContent>
        </Tabs>
      </section>

      <Separator className="my-12" />

      {relatedProducts.length > 0 && (
        <section className="mb-12">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold">Related Products</h2>
            <Button variant="ghost" asChild className="p-0 h-auto">
              <Link href={category?.slug ? `/collections/${category.slug}` : "/categories"}>View all</Link>
            </Button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
            {relatedProducts.map((p: any) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {allProductsPool && allProductsPool.length > 1 && (
        <AIRecommendations
          currentProduct={{
            name: product.name,
            category: category?.name || product.categoryId || "",
            price: product.price,
          }}
          allProducts={allProductsPool}
        />
      )}
    </div>
  );
}
