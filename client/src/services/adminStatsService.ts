import { 
  collection, 
  query,
  getDocs,
  limit,
  writeBatch,
  doc,
  deleteDoc
} from "firebase/firestore";
import { db } from "@/lib/firebase";

const PRODUCTS_COLLECTION = "products";
const CATEGORIES_COLLECTION = "categories";
const ORDERS_COLLECTION = "orders";
const USERS_COLLECTION = "users";

export interface AdminStats {
  totalProducts: number;
  totalCategories: number;
  totalUsers: number;
  totalOrders: number;
  totalRevenue: number;
}

async function safeCount(col: ReturnType<typeof collection>): Promise<number> {
  try {
    const snap = await getDocs(query(col, limit(1000)));
    return snap.size;
  } catch {
    return 0;
  }
}

export class AdminStatsService {
  async getAdminStats(): Promise<AdminStats> {
    const [totalProducts, totalCategories, totalUsers] = await Promise.all([
      safeCount(collection(db, PRODUCTS_COLLECTION)),
      safeCount(collection(db, CATEGORIES_COLLECTION)),
      safeCount(collection(db, USERS_COLLECTION)),
    ]);

    let totalOrders = 0;
    let totalRevenue = 0;
    try {
      const q = query(collection(db, ORDERS_COLLECTION), limit(1000));
      const querySnapshot = await getDocs(q);
      totalOrders = querySnapshot.size;
      querySnapshot.forEach((d) => {
        const data = d.data();
        totalRevenue += (data.total || data.amount || 0);
      });
    } catch (e) {
      console.warn("Could not fetch orders collection:", e);
    }

    return { totalProducts, totalCategories, totalUsers, totalOrders, totalRevenue };
  }

  async resetOrders(): Promise<void> {
    try {
      const q = query(collection(db, ORDERS_COLLECTION));
      const querySnapshot = await getDocs(q);
      
      const batch = writeBatch(db);
      querySnapshot.forEach((document) => {
        batch.delete(doc(db, ORDERS_COLLECTION, document.id));
      });
      
      await batch.commit();
    } catch (error: any) {
      console.error("Error resetting orders:", error);
      throw new Error(`Failed to reset orders: ${error.message}`);
    }
  }

  async deleteOrder(orderId: string): Promise<void> {
    try {
      const orderRef = doc(db, ORDERS_COLLECTION, orderId);
      await deleteDoc(orderRef);
    } catch (error: any) {
      console.error("Error deleting order:", error);
      throw new Error(`Failed to delete order: ${error.message}`);
    }
  }
}

export const adminStatsService = new AdminStatsService();
