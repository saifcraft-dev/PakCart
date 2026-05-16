/**
 * Product Image Display Component
 * Displays images from either Cloudinary account (A or B)
 * Supports full URL or cloud name + public ID
 */

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { getCloudinaryImageUrl } from '@/lib/uploadImage';

export interface ProductImageData {
  url?: string;
  publicId: string;
  cloudName: string;
}

interface ProductImageProps {
  image: ProductImageData;
  alt?: string;
  className?: string;
  width?: number;
  height?: number;
  quality?: 'auto' | 'quality';
  crop?: 'fill' | 'fit' | 'pad';
  onLoad?: () => void;
  onError?: (error: Error) => void;
}

export function ProductImage({
  image,
  alt = 'Product image',
  className = 'w-full h-full object-cover',
  width,
  height,
  quality = 'auto',
  crop = 'fill',
  onLoad,
  onError,
}: ProductImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Use provided URL if available, otherwise construct from cloud name + public ID
  const imageUrl = image.url || getCloudinaryImageUrl(image.cloudName, image.publicId, {
    width,
    height,
    crop,
    quality,
  });

  const handleLoad = () => {
    setIsLoading(false);
    setHasError(false);
    onLoad?.();
  };

  const handleError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    setIsLoading(false);
    setHasError(true);
    const error = new Error(`Failed to load image from ${image.cloudName}`);
    onError?.(error);
    console.error('[ProductImage] Failed to load:', {
      url: imageUrl,
      cloudName: image.cloudName,
      publicId: image.publicId,
      error: e,
    });
  };

  return (
    <div className="relative bg-gray-100">
      {/* Loading skeleton */}
      {isLoading && !hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      )}

      {/* Image */}
      <img
        src={imageUrl}
        alt={alt}
        className={className}
        onLoad={handleLoad}
        onError={handleError}
        data-testid={`product-image-${image.publicId}`}
      />

      {/* Error state */}
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-200 rounded">
          <div className="text-center">
            <p className="text-sm text-gray-600">Failed to load image</p>
            <p className="text-xs text-gray-500 mt-1">{image.cloudName}</p>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Example of how to use ProductImage component in a product card
 */
export function ProductCard({
  id,
  name,
  price,
  image,
}: {
  id: string;
  name: string;
  price: number;
  image: ProductImageData;
}) {
  return (
    <div className="bg-white rounded-lg shadow overflow-hidden hover:shadow-lg transition-shadow" data-testid={`card-product-${id}`}>
      <div className="aspect-square overflow-hidden bg-gray-100">
        <ProductImage
          image={image}
          alt={name}
          width={300}
          height={300}
          crop="fill"
        />
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 line-clamp-2">{name}</h3>
        <p className="text-lg font-bold text-green-600 mt-2">Rs. {price.toLocaleString()}</p>
      </div>
    </div>
  );
}
