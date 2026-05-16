import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { getOptimizedImageUrl, getResponsiveSrcSet } from "@/lib/cloudinary";

interface CategoryCardProps {
  name: string;
  image: string;
  count: number;
  slug: string;
  href?: string;
  priority?: boolean;
}

export function CategoryCard({ name, image, count, slug, href, priority = false }: CategoryCardProps) {
  const linkHref = href || `/collections/${slug}`;
  const optimized = getOptimizedImageUrl(image, { width: 600, height: 450, crop: 'fill' });
  const srcSet = getResponsiveSrcSet(image, [320, 480, 600, 800]);

  return (
    <div
      className="h-full transition-transform duration-300 hover:-translate-y-2 will-change-transform"
    >
      <Link href={linkHref}>
        <Card className="overflow-hidden cursor-pointer group hover-elevate border-none shadow-md h-full rounded-2xl relative">
          <CardContent className="p-0 relative aspect-[16/9] sm:aspect-[4/3] flex flex-col justify-end">
            <img
              src={optimized}
              srcSet={srcSet}
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 320px"
              alt={name}
              width="600"
              height="450"
              loading={priority ? "eager" : "lazy"}
              decoding={priority ? "sync" : "async"}
              fetchPriority={priority ? "high" : "auto"}
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 object-center"
            />
            <div className="absolute inset-0 bg-black/40 group-hover:bg-black/50 transition-colors duration-500" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent transition-opacity duration-500" />
            <div className="relative z-10 p-3 sm:p-4 text-white text-center sm:text-left">
              <div className="overflow-hidden">
                <h3 className="font-display text-lg sm:text-xl font-bold mb-1 text-white drop-shadow-lg transform transition-transform duration-500 group-hover:translate-y-[-2px] leading-tight">
                  {name}
                </h3>
              </div>
            </div>

            {/* Professional glass effect corner */}
            <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:opacity-40 transition-opacity">
               <div className="w-12 h-12 rounded-full border-2 border-white/30" />
            </div>

            {/* Subtle border overlay for professional finish */}
            <div className="absolute inset-0 border border-white/10 rounded-2xl pointer-events-none" />
          </CardContent>
        </Card>
      </Link>
    </div>
  );
}
