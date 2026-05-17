import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs, 
  getDoc, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  startAfter,
  writeBatch,
  QueryConstraint
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { type Product, type InsertProduct, insertProductSchema } from "@shared/schema";
import { getPublicIdFromUrl, deleteCloudinaryImage } from "@/lib/cloudinary";
import { searchIndexService } from "@/services/searchIndexService";
import { settingsFirestoreService, type ProfitRulesSettings } from "@/services/settingsFirestoreService";

const COLLECTION_NAME = "products";
const productsRef = collection(db, COLLECTION_NAME);

export interface ProductFilters {
  category?: string;
  parentCategoryId?: string;
  search?: string;
  sortBy?: "price-asc" | "price-desc" | "newest";
  limit?: number;
  startAfterDoc?: any;
}

export const productFirestoreService = {
  async getProductsByCategory(categoryId: string) {
    try {
      const q = query(productsRef, where("categoryId", "==", categoryId));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => {
        const data = doc.data();
        const rating = data.rating !== undefined ? Number(data.rating) : 0;
        const reviewCount = data.reviewCount !== undefined ? Number(data.reviewCount) : 0;
        return { 
          id: doc.id, 
          ...data,
          rating,
          reviewCount
        } as Product;
      });
    } catch (error: any) {
      console.error("Error getting products by category:", error);
      throw new Error(`Failed to fetch products: ${error.message}`);
    }
  },

  async getAllProducts(filters: ProductFilters = {}) {
    try {
      const constraints: QueryConstraint[] = [];
      
      // Handle category filtering
      if (filters.category && filters.category !== "all") {
        // Ensure category is a string for comparison
        constraints.push(where("categoryId", "==", String(filters.category)));
      } else if (filters.parentCategoryId) {
        // Fetch sub-categories for this parent
        const catsQuery = query(collection(db, "categories"), where("parentCategoryId", "==", filters.parentCategoryId));
        const catsSnapshot = await getDocs(catsQuery);
        const catIds = catsSnapshot.docs.map(doc => doc.id);
        
        if (catIds.length > 0) {
          constraints.push(where("categoryId", "in", catIds.slice(0, 10)));
        } else {
          // If a parent category is selected but has no subcategories, 
          // we should also check if the parent category itself is used as a categoryId for products
          constraints.push(where("categoryId", "==", filters.parentCategoryId));
        }
      }

      // Add default ordering if not specified to ensure consistent pagination
      // To avoid composite index issues when filtering, we only add orderBy if NO filters are present
      // or if we're sure an index exists. For now, let's omit orderBy when category filtering
      // to allow the query to run without requiring a manual index creation for the user.
      if (!filters.category && !filters.parentCategoryId && !filters.search) {
        if (filters.sortBy === "price-asc") {
          constraints.push(orderBy("price", "asc"));
        } else if (filters.sortBy === "price-desc") {
          constraints.push(orderBy("price", "desc"));
        } else {
          constraints.push(orderBy("createdAt", "desc"));
        }
      }

      if (filters.startAfterDoc) {
        constraints.push(startAfter(filters.startAfterDoc));
      }

      // When a search term is provided, skip the Firestore-level limit so that
      // all products are fetched before client-side text filtering is applied.
      // Without this, limit(100) would restrict the candidate set and cause
      // valid search results to be silently dropped.
      if (filters.limit && !filters.search) {
        constraints.push(limit(filters.limit));
      }

      const q = query(productsRef, ...constraints);
      const querySnapshot = await getDocs(q);
      const products = querySnapshot.docs.map(doc => {
        const data = doc.data();
        // Use 0 as default if the fields are missing or if we want to ensure fresh data
        const rating = data.rating !== undefined ? Number(data.rating) : 0;
        const reviewCount = data.reviewCount !== undefined ? Number(data.reviewCount) : 0;
        return { 
          ...data,
          id: doc.id, 
          rating,
          reviewCount
        } as Product;
      });

      let result = products;

      if (filters.search) {
        const searchLower = filters.search.toLowerCase().trim();

        // Split into individual keywords (ignore very short words)
        const keywords = searchLower
          .split(/\s+/)
          .filter(w => w.length > 1);

        // For each keyword, build plural/singular variants
        function getKeywordVariants(word: string): string[] {
          const v = [word];
          if (word.endsWith("s") && word.length > 2) v.push(word.slice(0, -1));
          else v.push(word + "s");
          if (word.endsWith("es") && word.length > 3) v.push(word.slice(0, -2));
          return v;
        }

        function keywordMatchesText(word: string, text: string): boolean {
          const t = text.toLowerCase();
          return getKeywordVariants(word).some(v => t.includes(v));
        }

        function countMatches(p: Product): number {
          const fields = [
            p.name || "",
            p.description || "",
            p.slug || "",
            ...(Array.isArray(p.labels) ? p.labels : []),
            ...(Array.isArray(p.features) ? p.features : []),
          ];
          return keywords.filter(kw =>
            fields.some(field => keywordMatchesText(kw, field))
          ).length;
        }

        // Compute match count once per product, then filter and sort
        const withCounts = result
          .map(p => ({ p, count: countMatches(p) }))
          .filter(({ count }) => count >= 1);

        // Tier: 5+ matches → tier 1, 3–4 → tier 2, 1–2 → tier 3
        const getTier = (count: number) =>
          count >= 5 ? 1 : count >= 3 ? 2 : 3;

        withCounts.sort((a, b) => {
          const tierDiff = getTier(a.count) - getTier(b.count);
          if (tierDiff !== 0) return tierDiff;
          return b.count - a.count; // more matches first within same tier
        });

        result = withCounts.map(({ p }) => p);
      }

      return result;
    } catch (error: any) {
      console.error("Error getting products:", error);
      throw new Error(`Failed to fetch products: ${error.message}`);
    }
  },

  async getProductBySlug(slug: string) {
    try {
      const q = query(productsRef, where("slug", "==", slug), limit(1));
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) throw new Error("Product not found");
      const doc = querySnapshot.docs[0];
      const data = doc.data();
      const rating = data.rating !== undefined ? Number(data.rating) : 0;
      const reviewCount = data.reviewCount !== undefined ? Number(data.reviewCount) : 0;
      return { 
        ...data,
        id: doc.id, 
        rating,
        reviewCount
      } as Product;
    } catch (error: any) {
      console.error("Error getting product by slug:", error);
      throw new Error(`Failed to fetch product: ${error.message}`);
    }
  },

  async getProductById(productId: string) {
    const docRef = doc(db, COLLECTION_NAME, productId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) throw new Error("Product not found");
    const data = docSnap.data();
    const rating = data.rating !== undefined ? Number(data.rating) : 0;
    const reviewCount = data.reviewCount !== undefined ? Number(data.reviewCount) : 0;
    return { 
      id: docSnap.id, 
      ...data,
      rating,
      reviewCount
    } as Product;
  },

  async createProduct(productData: InsertProduct) {
    try {
      insertProductSchema.parse(productData);
      
      // Deeply remove undefined values to prevent Firestore errors
      const cleanObject = (obj: any): any => {
        if (Array.isArray(obj)) {
          return obj.map(v => cleanObject(v));
        } else if (obj !== null && typeof obj === 'object' && !(obj instanceof Date)) {
          return Object.fromEntries(
            Object.entries(obj)
              .filter(([_, v]) => v !== undefined)
              .map(([k, v]) => [k, cleanObject(v)])
          );
        }
        return obj;
      };

      const cleanData = cleanObject(productData);

      const docRef = await addDoc(productsRef, {
        ...cleanData,
        createdAt: new Date(),
        updatedAt: new Date(),
        inStock: (productData.stock ?? 0) > 0,
        rating: productData.rating ?? 0,
        reviewCount: productData.reviewCount ?? 0
      });
      const newProduct = { ...productData, id: docRef.id } as Product;
      searchIndexService.updateSearchIndexForProduct(docRef.id).catch((err) =>
        console.error("Failed to update search index after create:", err)
      );
      return newProduct;
    } catch (error: any) {
      console.error("Error creating product:", error);
      throw new Error(`Failed to create product: ${error.message}`);
    }
  },

  async bulkApplyProfitRules(
    settings: ProfitRulesSettings,
    onProgress?: (done: number, total: number) => void
  ): Promise<{ updated: number; skipped: number }> {
    const snapshot = await getDocs(productsRef);
    const allDocs = snapshot.docs;
    const total = allDocs.length;
    let updated = 0;
    let skipped = 0;
    const BATCH_SIZE = 400;

    for (let i = 0; i < allDocs.length; i += BATCH_SIZE) {
      const batch = writeBatch(db);
      const chunk = allDocs.slice(i, i + BATCH_SIZE);

      for (const d of chunk) {
        const data = d.data();
        const costPrice = Number(data.price ?? 0);
        if (!costPrice || costPrice <= 0) { skipped++; continue; }

        const newProfit = settingsFirestoreService.calculateProfitForCategory(
          costPrice,
          data.categoryId ?? null,
          settings
        );

        batch.update(doc(db, COLLECTION_NAME, d.id), {
          profit: newProfit,
          updatedAt: new Date(),
        });
        updated++;
      }

      await batch.commit();
      onProgress?.(Math.min(i + BATCH_SIZE, total), total);
    }

    return { updated, skipped };
  },

  async deleteAllProducts() {
    try {
      const querySnapshot = await getDocs(productsRef);
      const deletePromises = querySnapshot.docs.map(document => deleteDoc(doc(db, COLLECTION_NAME, document.id)));
      await Promise.all(deletePromises);
      return true;
    } catch (error: any) {
      console.error("Error deleting all products:", error);
      throw new Error(`Failed to clear products: ${error.message}`);
    }
  },

  async updateProduct(productId: string, updates: Partial<InsertProduct>) {
    const docRef = doc(db, COLLECTION_NAME, productId);
    
    // Deeply remove undefined values to prevent Firestore errors
    const cleanObject = (obj: any): any => {
      if (Array.isArray(obj)) {
        return obj.map(v => cleanObject(v));
      } else if (obj !== null && typeof obj === 'object' && !(obj instanceof Date)) {
        return Object.fromEntries(
          Object.entries(obj)
            .filter(([_, v]) => v !== undefined)
            .map(([k, v]) => [k, cleanObject(v)])
        );
      }
      return obj;
    };

    const cleanUpdates = cleanObject(updates);

    await updateDoc(docRef, { ...cleanUpdates, updatedAt: new Date() });
    searchIndexService.updateSearchIndexForProduct(productId).catch((err) =>
      console.error("Failed to update search index after update:", err)
    );
    return { id: productId, ...updates };
  },

  async deleteProduct(productId: string) {
    try {
      // 1. Get product to find images
      const product = await this.getProductById(productId);
      
      // 2. Delete images from Cloudinary if they exist
      if (product.images && Array.isArray(product.images)) {
        for (const imageUrl of product.images) {
          const publicId = getPublicIdFromUrl(imageUrl);
          if (publicId) {
            await deleteCloudinaryImage(publicId);
          }
        }
      }

      // 3. Delete from Firestore
      await deleteDoc(doc(db, COLLECTION_NAME, productId));

      // 4. Remove from search index
      searchIndexService.deleteSearchIndexForProduct(productId).catch((err) =>
        console.error("Failed to remove from search index after delete:", err)
      );
      return true;
    } catch (error) {
      console.error("Error in deleteProduct:", error);
      // Still attempt to delete from Firestore even if image deletion fails
      await deleteDoc(doc(db, COLLECTION_NAME, productId));
      searchIndexService.deleteSearchIndexForProduct(productId).catch((err) =>
        console.error("Failed to remove from search index after delete:", err)
      );
      return true;
    }
  }
};
