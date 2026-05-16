// client/src/components/CloudinaryImage.jsx
import { useState, useEffect, useRef } from 'react';
import { cloudinaryConfig } from '../config/cloudinary';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle } from 'lucide-react';

export function CloudinaryImage({
  publicId,
  alt = 'Product image',
  width,
  height,
  transformations = {},
  lazy = true,
  className,
  fallbackSrc = 'https://via.placeholder.com/400x300?text=Image+Not+Found'
}) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [isVisible, setIsVisible] = useState(!lazy);
  const imgRef = useRef(null);

  useEffect(() => {
    if (!lazy || !imgRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(imgRef.current);
        }
      },
      { rootMargin: '200px' } // Load slightly before coming into view
    );

    observer.observe(imgRef.current);
    return () => observer.disconnect();
  }, [lazy]);

  const generateUrl = () => {
    if (!publicId) return fallbackSrc;

    const {
      crop = 'fill',
      quality = 'auto',
      format = 'auto',
      gravity = 'auto',
      ...rest
    } = transformations;

    // Base optimization parameters
    const params = [
      `f_${format}`,
      `q_${quality}`,
      `c_${crop}`,
      `g_${gravity}`
    ];

    // Add dimensions if provided
    if (width) params.push(`w_${width}`);
    if (height) params.push(`h_${height}`);

    // Add any other custom transformations
    Object.entries(rest).forEach(([key, value]) => {
      params.push(`${key}_${value}`);
    });

    const transformationStr = params.join(',');
    return `https://res.cloudinary.com/${cloudinaryConfig.cloudName}/image/upload/${transformationStr}/${publicId}`;
  };

  const blurPlaceholderUrl = () => {
    if (!publicId) return '';
    return `https://res.cloudinary.com/${cloudinaryConfig.cloudName}/image/upload/c_fill,w_50,q_10,f_auto/${publicId}`;
  };

  if (error) {
    return (
      <div className={cn("flex items-center justify-center bg-muted rounded-md", className)} style={{ width, height }}>
        <div className="flex flex-col items-center gap-2 text-muted-foreground p-4 text-center">
          <AlertCircle className="h-8 w-8" />
          <p className="text-xs">Failed to load image</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={imgRef}
      className={cn("relative overflow-hidden bg-muted rounded-md", className)}
      style={{ 
        width: width ? `${width}px` : '100%', 
        height: height ? `${height}px` : 'auto',
        aspectRatio: !height && width ? 'auto' : undefined
      }}
    >
      {/* Skeleton / Loading State */}
      {!isLoaded && isVisible && (
        <Skeleton className="absolute inset-0 z-10 h-full w-full" />
      )}

      {/* Blur Placeholder */}
      {!isLoaded && publicId && (
        <img
          src={blurPlaceholderUrl()}
          alt=""
          className="absolute inset-0 h-full w-full object-cover blur-xl scale-110 opacity-50"
          aria-hidden="true"
        />
      )}

      {/* Main Image */}
      {isVisible && (
        <img
          src={generateUrl()}
          alt={alt}
          onLoad={() => setIsLoaded(true)}
          onError={() => setError(true)}
          className={cn(
            "h-full w-full object-cover transition-opacity duration-500",
            isLoaded ? "opacity-100" : "opacity-0"
          )}
          style={{ width: '100%', height: '100%' }}
        />
      )}
    </div>
  );
}
