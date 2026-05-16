/**
 * Firestore Service for Image Metadata
 * 
 * This module provides utilities for saving and retrieving image metadata
 * from Firestore, supporting images from both Cloudinary accounts.
 */

import {
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  serverTimestamp,
  type Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import type { ProductImageData } from '@/components/product/ProductImage';

/**
 * Stored image metadata in Firestore
 */
export interface StoredImage {
  url: string;
  publicId: string;
  cloudName: string;
  createdAt: Timestamp;
  uploadedBy?: string; // Optional: user UID
}

/**
 * Product document type with image support from both accounts
 */
export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  image: ProductImageData;
  images?: ProductImageData[]; // Multiple images
  categoryId: string;
  inStock: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Save image metadata to Firestore
 * 
 * @param collectionName - e.g., 'products', 'categories'
 * @param docId - Document ID
 * @param imageData - Image metadata from upload
 * @param userId - Optional: user who uploaded
 */
export async function saveImageMetadataToFirestore(
  collectionName: string,
  docId: string,
  imageData: {
    url: string;
    publicId: string;
    cloudName: string;
  },
  userId?: string
): Promise<void> {
  const imageCollection = collection(db, collectionName);
  const imageRef = doc(imageCollection, docId);

  const storedImage: StoredImage = {
    url: imageData.url,
    publicId: imageData.publicId,
    cloudName: imageData.cloudName,
    createdAt: serverTimestamp() as Timestamp,
    ...(userId && { uploadedBy: userId }),
  };

  try {
    await setDoc(imageRef, { image: storedImage }, { merge: true });
    console.log('[FirestoreImageService] Image metadata saved:', {
      collection: collectionName,
      docId,
      cloudName: imageData.cloudName,
    });
  } catch (error) {
    console.error('[FirestoreImageService] Failed to save image metadata:', error);
    throw error;
  }
}

/**
 * Update product with new image
 */
export async function updateProductImage(
  productId: string,
  imageData: {
    url: string;
    publicId: string;
    cloudName: string;
  }
): Promise<void> {
  const productRef = doc(db, 'products', productId);

  try {
    await updateDoc(productRef, {
      image: {
        url: imageData.url,
        publicId: imageData.publicId,
        cloudName: imageData.cloudName,
      },
      updatedAt: serverTimestamp(),
    });
    console.log('[FirestoreImageService] Product image updated:', {
      productId,
      cloudName: imageData.cloudName,
    });
  } catch (error) {
    console.error('[FirestoreImageService] Failed to update product image:', error);
    throw error;
  }
}

/**
 * Add image to product's images array (for multiple images)
 */
export async function addImageToProduct(
  productId: string,
  imageData: {
    url: string;
    publicId: string;
    cloudName: string;
  }
): Promise<void> {
  const productRef = doc(db, 'products', productId);

  try {
    await updateDoc(productRef, {
      images: await getProductImages(productId).then((images) => [
        ...images,
        imageData,
      ]),
      updatedAt: serverTimestamp(),
    });
    console.log('[FirestoreImageService] Image added to product:', {
      productId,
      cloudName: imageData.cloudName,
    });
  } catch (error) {
    console.error('[FirestoreImageService] Failed to add image to product:', error);
    throw error;
  }
}

/**
 * Retrieve product images from Firestore
 */
export async function getProductImages(
  productId: string
): Promise<ProductImageData[]> {
  try {
    const productRef = doc(db, 'products', productId);
    const productDoc = await getDoc(productRef);

    if (!productDoc.exists()) {
      console.warn('[FirestoreImageService] Product not found:', productId);
      return [];
    }

    const product = productDoc.data() as Product;
    return product.images || [];
  } catch (error) {
    console.error('[FirestoreImageService] Failed to retrieve product images:', error);
    throw error;
  }
}

/**
 * Retrieve single product image from Firestore
 */
export async function getProductImage(
  productId: string
): Promise<ProductImageData | null> {
  try {
    const productRef = doc(db, 'products', productId);
    const productDoc = await getDoc(productRef);

    if (!productDoc.exists()) {
      console.warn('[FirestoreImageService] Product not found:', productId);
      return null;
    }

    const product = productDoc.data() as Product;
    return product.image || null;
  } catch (error) {
    console.error('[FirestoreImageService] Failed to retrieve product image:', error);
    throw error;
  }
}

/**
 * Example: How images from both accounts are stored and retrieved
 * 
 * Sample Firestore document:
 * 
 * {
 *   id: "prod-1",
 *   name: "Kashmiri Pashmina Shawl",
 *   price: 5999,
 *   image: {
 *     url: "https://res.cloudinary.com/account-a/...",
 *     publicId: "pakcart/product-abc123",
 *     cloudName: "account-a-cloud"
 *   },
 *   images: [
 *     {
 *       url: "https://res.cloudinary.com/account-a/...",
 *       publicId: "pakcart/product-abc123-view1",
 *       cloudName: "account-a-cloud"
 *     },
 *     {
 *       url: "https://res.cloudinary.com/account-b/...",
 *       publicId: "pakcart/product-abc123-view2",
 *       cloudName: "account-b-cloud"  // From fallback account
 *     }
 *   ],
 *   createdAt: Timestamp,
 *   updatedAt: Timestamp
 * }
 * 
 * Benefits:
 * 1. You can store images from either account seamlessly
 * 2. When Account A is at quota, subsequent uploads use Account B
 * 3. Metadata ensures you can reconstruct URLs or apply transformations
 * 4. No secrets stored in Firestore (unsigned upload presets used)
 */
