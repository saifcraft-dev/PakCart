/**
 * AI-powered review seeder — uses Gemini to generate product-specific reviews.
 *
 * Modes:
 *   --sample          Fetch first unseeded product, generate 4 reviews, print & exit (no write)
 *   --product <id>    Seed a single product by Firestore doc ID
 *   --all             Seed ALL products that have 0 seeded reviews
 *   --dry             Print what would happen, don't write to Firestore
 *
 * Usage:
 *   npx tsx scripts/seed-ai-reviews.ts --sample
 *   npx tsx scripts/seed-ai-reviews.ts --all
 */

import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import {
  getFirestore, collection, getDocs, addDoc, doc, updateDoc,
  query, where, Timestamp, deleteDoc,
} from "firebase/firestore";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const firebaseConfig = {
  apiKey: "AIzaSyCy6W_iVKhOuawX5kLtq_arxsVfnxbfg94",
  authDomain: "pakstore-45ec7.firebaseapp.com",
  projectId: "pakstore-45ec7",
  storageBucket: "pakstore-45ec7.firebasestorage.app",
  messagingSenderId: "427945652323",
  appId: "1:427945652323:web:14ba66302d404561d7c856",
};

const SEED_EMAIL = "seedbot.pakstore@temp-seed.com";
const SEED_PASSWORD = "SeedBot#2026!";

const GEMINI_BASE = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL ?? "https://generativelanguage.googleapis.com/v1beta";
const GEMINI_KEY  = process.env.AI_INTEGRATIONS_GEMINI_API_KEY ?? process.env.GEMINI_API_KEY ?? "";
const GEMINI_MODEL = "gemini-2.5-flash";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GeneratedReview {
  name: string;
  gender: "male" | "female" | "unisex";
  rating: 5 | 4 | 3;
  content: string;
  date: string; // ISO
}

interface ProductDoc {
  id: string;
  name: string;
  description?: string;
  category?: string;
  categoryName?: string;
  price?: number;
  discountedPrice?: number;
  variants?: any[];
  labels?: string[];
  images?: string[];
  reviewCount?: number;
}

// ---------------------------------------------------------------------------
// Gemini call
// ---------------------------------------------------------------------------

async function callGemini(prompt: string): Promise<string> {
  const url = `${GEMINI_BASE}/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 4096, temperature: 0.95 },
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

// ---------------------------------------------------------------------------
// Review generation
// ---------------------------------------------------------------------------

function buildPrompt(product: ProductDoc, count: number): string {
  const variantStr = (() => {
    if (!product.variants?.length) return "none listed";
    return product.variants.map((v: any) => {
      if (typeof v === "string") return v;
      return v.color ?? v.size ?? v.name ?? JSON.stringify(v);
    }).filter(Boolean).join(", ");
  })();

  const price = product.discountedPrice ?? product.price;
  const category = product.categoryName ?? product.category ?? "general";

  return `You are writing FAKE but REALISTIC customer reviews for a Pakistani e-commerce store called PakCart.

PRODUCT DETAILS:
- Name: ${product.name}
- Category: ${category}
- Price: Rs. ${price ?? "unknown"}
- Variants/Colors: ${variantStr}
- Description: ${product.description?.slice(0, 600) ?? "N/A"}

INSTRUCTIONS — follow every rule exactly:

1. Generate exactly ${count} reviews. Return ONLY a valid JSON array, no markdown, no explanation.
2. Each review object must have exactly these keys:
   { "name": string, "gender": "male"|"female"|"unisex", "rating": 5|4|3, "content": string, "date": string (ISO 8601) }
3. RATING MIX: 60% of reviews = rating 5, 25% = rating 4, 15% = rating 3. Apply this proportionally.
4. NAMES: Match product's likely buyer gender:
   - Women's items (bags, jewelry, clothing, makeup, slippers) → female Pakistani names (Ayesha, Fatima, Hira, Mahnoor, Sana, Zoya, Nimra, Maryam, Iqra, Rabia, Kiran, Nadia, Amna, Sara, Zainab, Bushra, Rimsha, Dua, Aiman, Madiha)
   - Men's items (watches, tech gadgets, men's shoes) → male Pakistani names (Ahmed, Bilal, Hamza, Usman, Zain, Faisal, Hassan, Tariq, Imran, Saad, Arslan, Kamran, Asif, Rizwan, Danish, Nabeel, Fahad, Talha, Rehan, Zeeshan)
   - Household/unisex → mix both genders
   - Occasionally add last initial: "Ahmed K.", "Sana R." — max 30% of names
5. LANGUAGE MIX per product: ~70% Roman Urdu (natural Pakistani buyer style, mix of Urdu words + English), ~30% casual English. Every review must be ORIGINAL — no two can share an opening phrase.
6. CONTENT RULES — each review MUST:
   - Reference at least one SPECIFIC product detail (material, color, fit, stitching, battery, sound, size, packaging, delivery speed, COD, TCS/Leopards, price-to-value, original vs copy, etc.)
   - Be UNIQUE in structure and opening — no two reviews on this product can start the same way
   - Vary in length: some 1-liners, most 2-3 sentences, a few 4-5 sentences
   - 3★ reviews: include one mild constructive note but end on a positive note
   - Light natural imperfections OK: lowercase, missing punctuation, emojis (👍❤️🔥✨), occasional typo
   - NO generic filler like "Great product, highly recommend!" as the entire review
7. DATES: Spread across the last 6 months from today (${new Date().toISOString().slice(0,10)}). Skew more recent. Use ISO format like "2026-04-12T15:30:00.000Z". Use Pakistani waking hours (PKT = UTC+5, so 4:00–18:00 UTC).

EXAMPLES of good Roman Urdu style:
- "Quality bohat achi hai, delivery bhi fast thi. TCS se 2 din mein aya, recommended! 👍"
- "Iss price pe yeh quality expect nahi thi honestly. Color bhi tasveer jaisa bilkul. ✨"
- "Pehli dafa online se mangwaya tha thoda darr tha but packaging secure thi aur item original nikla"

Return ONLY the JSON array. No markdown, no intro text.`;
}

function parseReviews(raw: string, expected: number): GeneratedReview[] {
  // Strip markdown code fences if present
  let clean = raw.trim();
  if (clean.startsWith("```")) {
    clean = clean.replace(/^```[a-z]*\n?/i, "").replace(/```\s*$/i, "").trim();
  }
  try {
    const arr = JSON.parse(clean);
    if (!Array.isArray(arr)) throw new Error("not an array");
    return arr.slice(0, expected).map((r: any) => ({
      name: String(r.name ?? "Customer"),
      gender: (["male","female","unisex"].includes(r.gender) ? r.gender : "unisex") as any,
      rating: ([5,4,3].includes(Number(r.rating)) ? Number(r.rating) : 5) as any,
      content: String(r.content ?? ""),
      date: r.date ?? new Date().toISOString(),
    }));
  } catch (e) {
    console.error("JSON parse failed. Raw response:\n", raw.slice(0, 500));
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Avatar helper (same as existing scripts)
// ---------------------------------------------------------------------------

function avatarFor(name: string, gender: "male" | "female" | "unisex"): string | null {
  if (Math.random() < 0.15) return null;
  const seed = encodeURIComponent(name + "-" + Math.floor(Math.random() * 9999));
  const styles =
    gender === "female" ? ["avataaars", "lorelei", "micah", "notionists"] :
    gender === "male"   ? ["avataaars", "micah", "notionists", "adventurer"] :
                          ["avataaars", "micah", "notionists", "adventurer", "lorelei"];
  const style = styles[Math.floor(Math.random() * styles.length)];
  return `https://api.dicebear.com/7.x/${style}/svg?seed=${seed}`;
}

// ---------------------------------------------------------------------------
// Seller replies (occasional, positive-only)
// ---------------------------------------------------------------------------

const SELLER_REPLIES = [
  "Thank you so much for your kind words! ❤️ — Team PakCart",
  "Bohat shukriya! Aap jaise customers humari motivation hain 🙏 — PakCart",
  "Khushi hui sun kar! Stay tuned for more designs soon — PakCart",
  "Thank you for the lovely feedback, please shop again! — Team PakCart",
  "Aap ka ye trust hum bohat appreciate karte hain! — PakCart",
];

function sellerReply(rating: number, date: Date): { reply: string | null; replyDate: Date | null } {
  if (rating < 5 || Math.random() > 0.18) return { reply: null, replyDate: null };
  const reply = SELLER_REPLIES[Math.floor(Math.random() * SELLER_REPLIES.length)];
  const replyDate = new Date(date.getTime() + (1 + Math.random() * 2) * 86400000);
  return { reply, replyDate };
}

function helpful(content: string): number {
  const len = content.length;
  const base = len > 200 ? 8 : len > 100 ? 4 : 2;
  return Math.max(0, Math.floor(Math.random() * base + Math.random() * 3));
}

// ---------------------------------------------------------------------------
// Seed a single product
// ---------------------------------------------------------------------------

async function seedProduct(
  db: any,
  product: ProductDoc,
  count: number,
  dryRun: boolean,
): Promise<GeneratedReview[]> {
  const price = product.discountedPrice ?? product.price ?? 0;
  // Vary count: 4-15 reviews, higher for cheaper products
  const reviewCount = count || (
    price < 1000 ? 10 + Math.floor(Math.random() * 6) :
    price < 3000 ? 8 + Math.floor(Math.random() * 5) :
    price < 7000 ? 6 + Math.floor(Math.random() * 5) :
                   4 + Math.floor(Math.random() * 4)
  );

  console.log(`\n▶ ${product.name}`);
  console.log(`  Category: ${product.categoryName ?? product.category ?? "?"} | Price: Rs.${price} | Count: ${reviewCount}`);
  console.log(`  Calling Gemini...`);

  const prompt = buildPrompt(product, reviewCount);
  const raw = await callGemini(prompt);
  const reviews = parseReviews(raw, reviewCount);

  console.log(`  Generated ${reviews.length} reviews`);

  if (dryRun) return reviews;

  // Delete old system-seed reviews
  const oldQ = query(collection(db, "comments"), where("productId", "==", product.id), where("userId", "==", "system-seed"));
  const oldSnap = await getDocs(oldQ);
  for (const od of oldSnap.docs) await deleteDoc(doc(db, "comments", od.id));

  // Write new reviews
  for (const r of reviews) {
    const date = new Date(r.date);
    const ts = Timestamp.fromDate(date);
    const sr = sellerReply(r.rating, date);
    await addDoc(collection(db, "comments"), {
      productId: product.id,
      userName: r.name,
      content: r.content,
      rating: r.rating,
      userId: "system-seed",
      userPhoto: avatarFor(r.name, r.gender),
      createdAt: ts,
      updatedAt: ts,
      helpfulCount: helpful(r.content),
      isVerifiedPurchase: Math.random() < 0.75,
      sellerReply: sr.reply,
      sellerReplyDate: sr.replyDate ? Timestamp.fromDate(sr.replyDate) : null,
    });
  }

  // Recalculate product rating
  const allSnap = await getDocs(query(collection(db, "comments"), where("productId", "==", product.id)));
  const all = allSnap.docs.map((d) => d.data());
  const total = all.reduce((acc, c) => acc + (Number(c.rating) || 0), 0);
  const avg = Number((total / (all.length || 1)).toFixed(1));
  await updateDoc(doc(db, "products", product.id), {
    rating: avg,
    reviewCount: all.length,
    updatedAt: Timestamp.now(),
  });

  console.log(`  ✓ Written ${reviews.length} reviews | avg ${avg}★ (${all.length} total)`);
  return reviews;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const isSample   = args.includes("--sample");
  const isAll      = args.includes("--all");
  const isDry      = args.includes("--dry");
  const pidx       = args.indexOf("--product");
  const singleId   = pidx !== -1 ? args[pidx + 1] : null;

  if (!GEMINI_KEY) {
    console.error("ERROR: No Gemini API key found. Set AI_INTEGRATIONS_GEMINI_API_KEY or GEMINI_API_KEY.");
    process.exit(1);
  }

  if (!isSample && !isAll && !singleId) {
    console.log("Usage:");
    console.log("  npx tsx scripts/seed-ai-reviews.ts --sample        # Preview 4 reviews for first product");
    console.log("  npx tsx scripts/seed-ai-reviews.ts --all           # Seed all unseeded products");
    console.log("  npx tsx scripts/seed-ai-reviews.ts --product <id>  # Seed one product by ID");
    console.log("  Add --dry to any command to skip writing to Firestore");
    process.exit(0);
  }

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  console.log("Authenticating seed bot...");
  try {
    await signInWithEmailAndPassword(auth, SEED_EMAIL, SEED_PASSWORD);
    console.log("Signed in.");
  } catch {
    await createUserWithEmailAndPassword(auth, SEED_EMAIL, SEED_PASSWORD);
    console.log("Created seed account.");
  }

  const productsSnap = await getDocs(collection(db, "products"));
  console.log(`Fetched ${productsSnap.size} products from Firestore.`);

  let products: ProductDoc[] = productsSnap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<ProductDoc, "id">),
  }));

  // --sample: take FIRST unseeded product, generate 4 reviews, print, exit
  if (isSample) {
    const unseeded = products.find(
      (p) => !p.reviewCount || p.reviewCount === 0
    ) ?? products[0];
    console.log(`\n=== SAMPLE MODE — product: "${unseeded.name}" ===\n`);
    const reviews = await seedProduct(db, unseeded, 4, true /* dry */);
    console.log("\n--- SAMPLE REVIEWS ---");
    reviews.forEach((r, i) => {
      console.log(`\n[${i+1}] ${r.name} (${r.gender}) — ${r.rating}★  ${r.date.slice(0,10)}`);
      console.log(`    ${r.content}`);
    });
    console.log("\n--- END SAMPLE ---");
    console.log("\nIf tone looks good, run:  npx tsx scripts/seed-ai-reviews.ts --all");
    process.exit(0);
  }

  // --product <id>: seed exactly one
  if (singleId) {
    const p = products.find((x) => x.id === singleId);
    if (!p) { console.error(`Product ${singleId} not found.`); process.exit(1); }
    await seedProduct(db, p, 0, isDry);
    process.exit(0);
  }

  // --all: seed every product with 0 seeded reviews
  if (isAll) {
    // Check which products already have system-seed reviews
    const seededProductIds = new Set<string>();
    const seedQ = query(collection(db, "comments"), where("userId", "==", "system-seed"));
    const seedSnap = await getDocs(seedQ);
    seedSnap.docs.forEach((d) => seededProductIds.add(d.data().productId));

    const toSeed = products.filter((p) => !seededProductIds.has(p.id));
    console.log(`\n${toSeed.length} products need seeding (${seededProductIds.size} already have seeded reviews).`);

    let done = 0;
    let failed = 0;
    for (const product of toSeed) {
      try {
        await seedProduct(db, product, 0, isDry);
        done++;
        // Small delay to avoid rate limiting
        await new Promise((r) => setTimeout(r, 800));
      } catch (err: any) {
        console.error(`  ✗ FAILED: ${err.message}`);
        failed++;
      }
    }

    console.log(`\n=== Done. Seeded: ${done}, Failed: ${failed} ===`);
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
