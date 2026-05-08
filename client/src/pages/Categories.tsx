import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import SEO from "@/components/SEO";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { categoryFirestoreService } from "@/services/categoryFirestoreService";
import type { ParentCategory, Category } from "@shared/schema";
import { Tag, ArrowRight } from "lucide-react";
import { getOptimizedImageUrl } from "@/lib/cloudinary";
import categoriesListImage from "@/assets/hero-image.jpg";

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
  return fallback || categoriesListImage;
}

function CategoryCard({ name, slug, image }: { name: string; slug: string; image?: string }) {
  const img = getCategoryImage(name, image);
  const optimized = getOptimizedImageUrl(img, { width: 192, height: 192, crop: "fill" });
  return (
    <Link
      href={`/collections/${slug}`}
      className="flex flex-col items-center gap-2 group cursor-pointer"
    >
      <div className="relative w-[68px] h-[68px] sm:w-24 sm:h-24 rounded-full overflow-hidden ring-2 ring-border group-hover:ring-primary transition-all duration-300 shadow-sm group-hover:shadow-md group-hover:scale-105 transform">
        <img
          src={optimized}
          alt={name}
          width="96"
          height="96"
          loading="lazy"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors duration-300 rounded-full" />
      </div>
      <span className="text-[10px] sm:text-xs font-semibold text-center text-foreground/80 group-hover:text-primary transition-colors duration-200 leading-tight w-[72px] sm:w-[100px] line-clamp-2">
        {name}
      </span>
    </Link>
  );
}

export default function Categories() {
  const { data: parentCategories, isLoading: loadingParents } = useQuery<ParentCategory[]>({
    queryKey: ["parent-categories"],
    queryFn: () => categoryFirestoreService.getAllParentCategories(),
  });

  const { data: categories, isLoading: loadingCategories } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: () => categoryFirestoreService.getAllCategories(),
  });

  const isLoading = loadingParents || loadingCategories;

  useEffect(() => {
    if (!isLoading) {
      (window as any).__SEO_PAGE_READY__ = true;
    }
  }, [isLoading]);

  const getSubcategories = (parentId: string) =>
    (categories || []).filter((c) => String(c.parentCategoryId) === String(parentId));

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Shop by Category — Bags, Jewelry, Shoes, Watches, Stitched Dresses & Tech Gadgets"
        description="Explore PakCart by category — bags & wallets, jewelry, shoes, slippers, stitched dresses, watches and tech gadgets. Cash on Delivery and fast nationwide shipping in Pakistan."
        keywords="shop by category pakistan, bags and wallets, jewelry pakistan, shoes pakistan, slippers, stitched dresses, watches pakistan, tech gadgets"
        url="https://pakcart.store/categories"
        robots="index,follow"
        breadcrumbs={[
          { name: "Home", url: "https://pakcart.store/" },
          { name: "Categories", url: "https://pakcart.store/categories" },
        ]}
      />

      {/* Page header */}
      <div className="bg-muted/30 border-b border-border/50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <Breadcrumb className="mb-4">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/">Home</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Categories</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Shop All Categories</h1>
          <p className="text-muted-foreground mt-1.5 text-sm sm:text-base leading-relaxed max-w-2xl">
            Bags & wallets, jewelry, shoes, slippers, stitched dresses, watches and tech gadgets — all with fast delivery across Pakistan.
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        {isLoading ? (
          <div className="space-y-10">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i}>
                <Skeleton className="h-6 w-40 mb-5 rounded-lg" />
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <Skeleton key={j} className="aspect-[4/3] rounded-2xl" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : !parentCategories || parentCategories.length === 0 ? (
          <div className="text-center py-24 bg-muted/20 rounded-3xl border-2 border-dashed border-muted-foreground/20">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <Tag className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <h3 className="text-xl font-bold mb-2">No categories yet</h3>
            <p className="text-muted-foreground">Check back soon for new arrivals.</p>
          </div>
        ) : (
          <div className="space-y-10" data-testid="categories-list">
            {parentCategories.map((parent) => {
              const subs = getSubcategories(parent.id);
              return (
                <section key={parent.id} data-testid={`section-parent-${parent.id}`}>
                  {/* Section header */}
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className="h-5 w-1 bg-primary rounded-full" />
                    <h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">{parent.name}</h2>
                  </div>

                  {parent.description && (
                    <p className="text-muted-foreground text-sm mb-4 -mt-2 pl-3.5">{parent.description}</p>
                  )}

                  <div className="grid grid-cols-4 place-items-center gap-x-3 gap-y-5 sm:flex sm:flex-row sm:flex-wrap sm:gap-6 pt-2 pb-3">
                    {subs.length > 0 ? (
                      subs.map((cat) => (
                        <CategoryCard
                          key={cat.id}
                          name={cat.name}
                          slug={cat.slug}
                          image={cat.image}
                        />
                      ))
                    ) : (
                      <CategoryCard
                        name={parent.name}
                        slug={parent.slug}
                        image={undefined}
                      />
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
