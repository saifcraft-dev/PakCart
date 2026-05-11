import { useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useCategories } from "./use-categories";
import { useCartStore } from "@/store/cartStore";
import { productFirestoreService } from "@/services/productFirestoreService";
import type { Product } from "@shared/schema";

const MAX_PRODUCTS_IN_CONTEXT = 60;
const MAX_SUBCATEGORIES_IN_CONTEXT = 50;
const DESCRIPTION_TRUNCATE = 240;

export function useSiteContext() {
  const [location] = useLocation();
  const { categories, parentCategories } = useCategories();
  const cartItems = useCartStore((s) => s.items);

  const { data: catalog } = useQuery<Product[]>({
    queryKey: ["pakbot-catalog-snapshot"],
    queryFn: () => productFirestoreService.getAllProducts({ limit: 80 }),
    staleTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
  });

  const productSlugMatch = location.match(/^\/products\/([^/?#]+)/);
  const currentSlug = productSlugMatch?.[1];

  const collectionSlugMatch = location.match(/^\/collections\/([^/?#]+)/);
  const currentCollectionSlug = collectionSlugMatch?.[1];

  const { data: currentProduct } = useQuery<Product | null>({
    queryKey: ["pakbot-current-product", currentSlug ?? null],
    queryFn: async () => {
      if (!currentSlug) return null;
      const cached = catalog?.find((p) => p.slug === currentSlug);
      if (cached) return cached;
      try {
        return await productFirestoreService.getProductBySlug(currentSlug);
      } catch {
        return null;
      }
    },
    enabled: !!currentSlug,
    staleTime: 1000 * 60 * 5,
  });

  return useMemo(() => {
    const lines: string[] = [];
    lines.push("=== LIVE PAKCART SITE CONTEXT (real-time data — trust this over any earlier guess) ===");
    lines.push(`Today: ${new Date().toISOString().slice(0, 10)}`);
    lines.push(`Site domain: https://pakcart.store`);
    lines.push(`User is currently on page: ${location}`);

    if (currentCollectionSlug) {
      const matchedCategory = [...(categories || []), ...(parentCategories || [])].find(
        (c: any) => c.slug === currentCollectionSlug
      );
      if (matchedCategory) {
        lines.push(`\nUser is browsing this category: ${(matchedCategory as any).name} (/collections/${currentCollectionSlug})`);
        const categoryProducts = catalog?.filter((p: any) =>
          p.categoryId === (matchedCategory as any).id ||
          p.categorySlug === currentCollectionSlug ||
          (p.categories && p.categories.includes((matchedCategory as any).id))
        ) ?? [];
        if (categoryProducts.length > 0) {
          lines.push(`Products in this category (${categoryProducts.length} found):`);
          categoryProducts.slice(0, 20).forEach((p) => {
            const stock = p.inStock ? "in stock" : "OUT OF STOCK";
            lines.push(`  - ${p.name} | Rs${p.price} | ${stock} | /products/${p.slug}`);
          });
        }
      } else {
        lines.push(`\nUser is browsing collection: /collections/${currentCollectionSlug}`);
      }
    }

    lines.push(
      "\n=== COMPLETE PAGE DIRECTORY (every public page on pakcart.store — what each page does, what's on it, who it's for, and when to send a user there). This is the authoritative map of the site — use it for every navigation answer. ===\n" +
        "\n" +
        "── SHOPPING & BROWSING ──\n" +
        "• / (Home page)\n" +
        "    What's on it: (1) Top scrolling announcement bar with current promos. (2) Hero slider/banner with rotating featured collections. (3) Quick category grid (Bags & Wallets, Jewelry, Shoes, Slippers, Stitched Dresses, Watches, Tech Gadgets). (4) 'Premium Collection: Bags, Watches & More' highlight section. (5) 'New Arrivals' carousel. (6) Per-category 'Best Sellers' rows. (7) Footer with About / Contact / Privacy / Terms / Dropshipper links.\n" +
        "    Page title (SEO): 'PakCart — Online Shopping in Pakistan | Bags, Jewelry, Shoes, Watches, Stitched Dresses & Tech Gadgets'.\n" +
        "    Send the user here when: they say 'home', 'main page', 'kuch dikhao', or are new and want a quick overview of the store.\n" +
        "\n" +
        "• /products (Full catalog)\n" +
        "    What's on it: The entire product listing across every category. Live keyword search bar at top, category filter chips, price-range filter, sort dropdown (Featured / Price low→high / Price high→low / Newest), grid layout with infinite scroll / pagination. Each card shows image, name, price, In-Stock badge.\n" +
        "    Send the user here when: they want to 'browse everything', search by keyword, or you don't have an exact product slug. Also send here whenever stock or price needs to be confirmed live.\n" +
        "\n" +
        "• /products/<slug> (Single product detail page)\n" +
        "    What's on it: Large photo gallery (multiple angles + zoom), product name, current price, In Stock / Out of Stock badge, variant selector (size and/or color when applicable), quantity picker, big 'Add to Cart' and 'Buy Now' buttons, full product description with specs/material, customer reviews section with star ratings, and a 'You may also like' related products carousel.\n" +
        "    Send the user here when: you've identified the exact product they want — always paste the direct /products/<slug> link from the live snapshot below.\n" +
        "\n" +
        "• /categories (All categories index)\n" +
        "    What's on it: A clean visual grid of every parent category and sub-category in the store, each tile with category image, name and product count. Tapping any tile opens /collections/<slug>.\n" +
        "    Send the user here when: they're undecided and want to browse the store by category.\n" +
        "\n" +
        "• /collections/<slug> (Single category page)\n" +
        "    What's on it: Every product inside one category (examples: /collections/bags-wallets, /collections/jewelry, /collections/shoes, /collections/slippers, /collections/stitched-dresses, /collections/watches, /collections/tech-gadgets). Same search/sort/filter UI as /products, scoped to that category, with SEO breadcrumbs (Home › Categories › <Category Name>).\n" +
        "    Send the user here when: they ask for a specific category. Always use the EXACT slug from the categories list further below — do not invent slugs.\n" +
        "\n" +
        "• /new-arrivals (Latest additions)\n" +
        "    What's on it: All recently added products sorted newest-first, with the same sort/filter controls. Same product-card layout as /products.\n" +
        "    Send the user here when: they ask 'what's new', 'naya kya aaya', 'fresh stock', 'aaj ka collection', or want to see the latest additions before anyone else.\n" +
        "\n" +
        "── CART & CHECKOUT FLOW ──\n" +
        "• /cart (Shopping cart)\n" +
        "    What's on it: Every item the user added — thumbnail image, name, variant (size/color), unit price, qty +/− stepper, remove (X) button, per-item subtotal, grand total at bottom, stock-limit warnings if qty exceeds available stock, and a big 'Proceed to Checkout' button. Empty-cart state shows a friendly nudge back to /products.\n" +
        "    Send the user here when: they say 'meri cart dikhao', 'kya kya add kiya hai', want to update quantities, or remove something before ordering.\n" +
        "\n" +
        "• /checkout (Place order — LOGIN REQUIRED)\n" +
        "    What's on it: Multi-step form — Step 1 shipping details (full name, email, phone, full address, city dropdown covering every Pakistani city, area/landmark, optional notes), Step 2 review/payment (Cash on Delivery is currently the supported method across Pakistan), with a sticky order summary on the side showing items, subtotal, shipping fee and total. Final action: 'Complete Order'. If not logged in, the site will bounce them to /auth/login first.\n" +
        "    Send the user here when: they have items in cart and are ready to buy. Mention the login requirement briefly so they aren't surprised.\n" +
        "\n" +
        "• /thank-you (Order confirmation)\n" +
        "    What's on it: Auto-shown after a successful checkout — confirms the order ID, shows the items, total and next steps (you'll get a WhatsApp/email update; track at /orders).\n" +
        "    Don't direct users here manually — only reference it if they ask 'mera order place ho gaya kya'.\n" +
        "\n" +
        "── ACCOUNT & ORDERS ──\n" +
        "• /auth/login (Login)\n" +
        "    What's on it: 'Continue with Google' one-tap button + email/password form + 'Forgot password' link + link to /auth/signup. Required before checkout, viewing orders, profile, or dropshipper dashboard.\n" +
        "• /auth/signup (Create account)\n" +
        "    What's on it: 'Sign up with Google' + email/password registration (name, email, password). After signup the user stays signed in automatically.\n" +
        "• /profile (User profile — LOGIN REQUIRED)\n" +
        "    What's on it: Editable name, email, phone, and saved delivery addresses for faster checkout. Also has a sign-out button.\n" +
        "• /orders (My Orders — LOGIN REQUIRED)\n" +
        "    What's on it: Full list of every order the user has placed — order ID, date, item count, total amount, and a colored status badge (Pending / Confirmed / Shipped / Delivered / Cancelled). Each row links into /orders/<id>.\n" +
        "    Send the user here when: they ask 'mera order kahan hai', 'tracking', 'delivery kab tak aaye gi', 'kya status hai', 'order history'.\n" +
        "• /orders/<id> (Single order detail — LOGIN REQUIRED)\n" +
        "    What's on it: One order in full detail — every item with photo, variant and qty, full shipping address, status timeline (placed → confirmed → shipped → delivered), total breakdown (items + shipping + grand total).\n" +
        "    Send the user here only if they share an order ID; otherwise send them to /orders.\n" +
        "\n" +
        "── SITE-WIDE FEATURES (available on every page — surface these when relevant) ──\n" +
        "• Smart Search (top-right magnifying-glass icon in the header, also opens with the keyboard shortcut Ctrl+K / Cmd+K). It's an AI-powered search — users can type a keyword (\"black bag\", \"watch under 5000\", \"eid dress\") OR a natural-language query, and it returns matching products with images, prices, stock, and a 'View' link. Recent and popular searches are remembered. Tell the user 'top right pe search icon hai — ya Ctrl+K dabaiye — wahan se direct product search kar sakte hain.'\n" +
        "• Header navigation (every page): Home · Collections (/categories) · Categories mega-menu (every parent + sub-category) · Our Story (/about) · Dropship (/dropshipper) · Contact (/contact) · search icon · cart icon · profile/login icon.\n" +
        "• Mobile bottom navigation bar: Home · Categories · Cart · Orders · Profile (the last two redirect to /auth/login if the user isn't signed in). Mention this when guiding mobile users.\n" +
        "• Announcement banner (slim bar at the very top): rotating live promos and offers (e.g. free-shipping threshold, fresh stock alerts). It's dismissible and managed by the owner from /admin/announcements.\n" +
        "• Promo / advert popup: occasionally pops up with the current featured offer or seasonal collection (e.g. Eid Special). It's safe to dismiss — it always re-surfaces the same offer that's already linked in the homepage banner.\n" +
        "• Login methods (everywhere a login is needed): one-tap 'Continue with Google' OR email + password. Guests can browse the whole site freely; login is only required at /checkout, /orders, /profile and /dropshipper/dashboard.\n" +
        "• Product reviews & ratings: every product page (/products/<slug>) has a 'Customer Reviews' tab where signed-in users can leave a 1–5 star rating + written review. The average star rating and total review count show right next to the product name. Tell users 'review chhorne ke liye product page kholo, neeche Customer Reviews tab hai — star rating aur message likh ke submit kar dein.'\n" +
        "• PakBot (this assistant): always available via the green chat bubble bottom-right of every page. Use it for product help, navigation, sizing advice, order/return guidance.\n" +
        "\n" +
        "── INFORMATION PAGES ──\n" +
        "• /about (About PakCart)\n" +
        "    What's on it: PakCart's story — 'Pakistan's premier destination for authentic artisanal products', founded 2024 by Saif Khan. Mission section: 'preserve and promote the rich cultural heritage of Pakistan by connecting local artisans with a global audience… sustainable commerce that empowers communities while delivering exceptional quality.' Two highlight cards: (1) Nationwide Delivery — every corner of Pakistan, (2) Authentic Quality — every product handpicked and verified. 'Our Story' section: from Kashmiri shawls to Multan pottery, bringing Pakistan's bazaars into the digital age.\n" +
        "    Send the user here when: they ask 'who runs this', 'kya hai PakCart', 'kab shuru hua', or want a brand overview.\n" +
        "• /contact (Contact us)\n" +
        "    What's on it: Header 'Get in Touch'. Left column has contact info cards — Email contact@pakcart.store, WhatsApp +92 318 8055850 (Mon–Fri 9am–6pm PKT, message only, no calls), plus a 'Build Your Own Store' card pointing to saifkhan@pakcart.store for people who want their own e-commerce platform built. Right column has a contact form (name, email, subject, message) that goes straight to the support inbox.\n" +
        "    Send the user here when: they want to email/WhatsApp support, raise an issue, send a custom inquiry, or ask about getting their own store built.\n" +
        "• /privacy (Privacy Policy)\n" +
        "    What's on it: What personal data is collected (identity, contact, financial, technical/usage), how it's used (fulfilling orders, support, improving the store), security measures (encryption, access controls), data sharing rules, user rights (access, correction, deletion), and the privacy contact privacy@pakcart.store. Last updated Feb 7, 2026.\n" +
        "    Send the user here when: they ask about data, privacy, what info you store, or how to delete their data.\n" +
        "• /terms (Terms & Conditions)\n" +
        "    What's on it: Five sections — (1) Terms of Use, (2) Use License, (3) Disclaimer, (4) Shipping & Returns: nationwide delivery in 3–5 business days, 7-day return window for unused items in original packaging, perishables non-returnable unless damaged in transit, (5) Governing Law: Pakistan. Last updated Feb 7, 2026.\n" +
        "    Send the user here when: they ask about return policy, refund window, delivery time, exchanges, or legal terms.\n" +
        "\n" +
        "── WEB DEVELOPMENT SERVICE (PakCart builds custom eCommerce sites for other businesses) ──\n" +
        "• /web-development (Custom eCommerce website service)\n" +
        "    What's on it: Hero — 'Custom eCommerce Websites Built With Pure Code'. PakCart's team of professional developers builds fully custom-coded eCommerce stores (no Shopify, no WordPress) so the client never pays monthly subscription fees. Trust strip: 1 Month Delivery · One-Time Payment · Lifetime Free Hosting · 100% Custom Code.\n" +
        "    Features highlighted: Pure custom coding · One-time payment (no subscriptions) · Lifetime free hosting · Lifetime free business emails (e.g. contact@yourdomain) · Admin panel included · SEO friendly · Mobile responsive · Fast & optimized.\n" +
        "    3-step process: (1) Discuss your idea on WhatsApp, (2) Design & develop the site in pure code, (3) Launch in 1 month with hosting, business emails and admin panel.\n" +
        "    What's included in every plan: Fully functional eCommerce website + admin panel + lifetime free fast hosting + lifetime free business emails + mobile-responsive modern design + SEO-friendly structure + ready in 1 month.\n" +
        "    PRICING — TWO PLANS (one-time payment only, zero monthly fees):\n" +
        "      • Standard (Most Popular) — Rs 38,000 one-time (originally Rs 45,000, save Rs 7,000): unlimited products, premium custom design, full admin panel + analytics, lifetime free fast hosting, 3 free business emails, advanced SEO + sitemap, WhatsApp & order notifications, 1-month delivery.\n" +
        "      • AI Pro (AI Powered) — Rs 99,000 one-time (originally Rs 125,000, save Rs 26,000): EVERYTHING in Standard PLUS AI product recommendations, AI chatbot for 24/7 customer support, AI-powered smart search, AI-generated product descriptions, AI image enhancement & background removal, AI sales insights & analytics, personalized shopping experience.\n" +
        "      Custom requirements / larger scope → WhatsApp +92 318 8055850 for a tailored quote.\n" +
        "    Contact for this service: WhatsApp +92 318 8055850 (Saif Khan) — message only — or email saifkhan@pakcart.store, or use /contact form. The pakcart.store storefront itself is the live demo of what they build.\n" +
        "    Comparison vs Shopify/WordPress/Wix: PakCart offers one-time payment vs monthly subscriptions, lifetime free hosting vs paid hosting, no plugin dependencies, full SEO control, zero transaction fees, faster loading (custom-coded), and unlimited customization.\n" +
        "    Send the user here when: they ask about getting their own website / online store built, web development, custom eCommerce, 'apni website banwani hai', 'store banao', dropping Shopify/WordPress, hosting + emails, pricing for a website, or anything that's not about shopping on PakCart but rather hiring PakCart to build a store for them.\n" +
        "\n" +
        "── DROPSHIPPER / PARTNER PROGRAM ──\n" +
        "• /dropshipper (Become a dropshipper)\n" +
        "    What's on it: Hero pitch ('Earn by Selling PakCart Products'), benefits grid (no inventory, no upfront cost, ready-made product catalog, professional images & descriptions, you set your own margin, PakCart handles packing/shipping/COD), 'How It Works' (1. Apply, 2. Get approved, 3. Pick products & list them on your channel, 4. Customer orders → PakCart ships → you earn), live preview of products you'd be selling, an earnings calculator, and the Apply form (full name, phone, email, city, selling platform — Daraz / Facebook page / Instagram / Website / WhatsApp / Other, expected monthly orders, store URL, message). Also has 'Already Applied?' status checker by email.\n" +
        "    Send the user here when: they ask about reselling, becoming a partner, earning from PakCart, dropshipping, or 'main bhi yeh products bechna chahta hoon'.\n" +
        "• /dropshipper/dashboard (Dropshipper dashboard — LOGIN REQUIRED, approved dropshippers only)\n" +
        "    What's on it: Approved dropshippers' control panel — full catalog with their wholesale pricing visible, downloadable product images and descriptions for their own listings, earnings overview, and order/payout history.\n" +
        "    Note: /dropshipper/catalog auto-redirects to /products, so don't share that path.\n" +
        "\n" +
        "── KEY CONTACT / SUPPORT INFO (quote these directly when a user needs human help) ──\n" +
        "• Owner / founder: Saif Khan — WhatsApp / SMS: 03188055850 (message only — no calls)\n" +
        "• Customer support email (publicly listed on /contact): contact@pakcart.store\n" +
        "• General/secondary support email (used in /about): support@pakcart.store\n" +
        "• Support hours: Monday–Friday, 9am–6pm PKT\n" +
        "• Privacy queries: privacy@pakcart.store\n" +
        "• 'Build your own store' / web-development inquiries: saifkhan@pakcart.store\n" +
        "• Social media handles (all @pakcartstore):\n" +
        "    – Facebook: https://www.facebook.com/pakcartstore\n" +
        "    – Instagram: https://www.instagram.com/pakcartstore\n" +
        "    – TikTok: https://www.tiktok.com/@pakcartstore\n" +
        "    – Twitter/X handle: @pakcartstore\n" +
        "  Share these only when the user asks about social/Insta/FB/TikTok/follow page.\n" +
        "\n" +
        "── COMPANY / BRAND FACTS (safe to quote — verified from the live site) ──\n" +
        "• Brand name: PakCart (always one word, capital P and C). Legal domain: pakcart.store (only).\n" +
        "• Founded: 2024 by Saif Khan.\n" +
        "• Customers served (per /dropshipper): 25,000+ happy customers — every product is already market-tested in Pakistan.\n" +
        "• Mission (from /about): Pakistan's premier destination for authentic artisanal products — connecting local artisans with customers nationwide, sustainable commerce that empowers communities while delivering exceptional quality.\n" +
        "• Two pillars highlighted on /about: (1) Nationwide Delivery — every corner of Pakistan, (2) Authentic Quality — every product handpicked & verified.\n" +
        "\n" +
        "── PAYMENT, DELIVERY & RETURN POLICY (verified facts — safe to quote verbatim) ──\n" +
        "• Payment method: Cash on Delivery (COD), available across Pakistan.\n" +
        "• Delivery area: Nationwide — every city in Pakistan (full city dropdown is shown at checkout).\n" +
        "• Standard delivery time: 3–5 business days.\n" +
        "• Free delivery threshold: orders above Rs 10,000 (per the homepage promo).\n" +
        "• Returns: 7 days from delivery, item must be unused and in original packaging. Perishables are not eligible unless damaged in transit.\n" +
        "• Live order tracking: /orders (login required).\n" +
        "\n" +
        "── WEB DEVELOPMENT SERVICE — VERIFIED PRICING ──\n" +
        "• TWO plans on /web-development (both are one-time payment, zero monthly fees, zero hidden charges):\n" +
        "  1. Standard (Most Popular) — Rs 38,000 one-time (was Rs 45,000, save Rs 7,000): unlimited products, premium custom hand-coded design (no Shopify/WordPress), full admin panel + analytics, lifetime free fast hosting, 3 free business emails (e.g. contact@yourdomain), advanced SEO + sitemap, WhatsApp & order notifications, mobile-responsive layout, 1-month delivery.\n" +
        "  2. AI Pro (AI Powered) — Rs 99,000 one-time (was Rs 125,000, save Rs 26,000): EVERYTHING in Standard PLUS AI product recommendations, AI chatbot for 24/7 customer support, AI-powered smart search, AI-generated product descriptions, AI image enhancement & background removal, AI sales insights & analytics, personalized shopping experience.\n" +
        "• 3-step process: (1) Discuss requirements on WhatsApp, (2) Pure-code design + development, (3) Go live in 1 month with hosting + business emails + admin panel.\n" +
        "• For custom scope or larger projects, the user should WhatsApp +92 318 8055850 (Saif Khan) for a tailored quote — DO NOT invent pricing beyond these two tiers.\n" +
        "• Live demo of PakCart's own work: pakcart.store (this very site).\n" +
        "\n" +
        "── DROPSHIPPER PROGRAM — VERIFIED FAQ (quote these answers verbatim when asked) ──\n" +
        "• Joining fee? — No. The PakCart Dropshipper Program is completely free to join. Zero hidden charges.\n" +
        "• Profit per item? — Typically Rs 200 – Rs 800 per item. The dropshipper sets their own selling price.\n" +
        "• Payment flow? — Dropshipper collects payment from their customer FIRST, then places the order with PakCart at the wholesale price. Difference = profit, kept immediately. (No waiting for payouts.)\n" +
        "• Need a registered business? — No. Individuals can join. A Facebook page, Instagram, or WhatsApp group is enough.\n" +
        "• Dispatch speed? — Within 1–2 business days after the order is placed. Delivery takes 2–5 days depending on the city.\n" +
        "• Returns? — PakCart handles returns and replacements directly. Dropshipper just shares the order details with support.\n" +
        "• Application review time: 24 hours.\n" +
        "• How dropshipping works: (1) Apply at /dropshipper, (2) Get approved within 24h, (3) Add PakCart products to own store with ready-made images & descriptions, (4) When order comes in, forward it to PakCart — they ship — dropshipper keeps profit.\n" +
        "\n" +
        "── COMMON USER QUESTIONS → DIRECT ANSWER + LINK (use as a quick lookup) ──\n" +
        "• 'How do I order?' → Add to cart on the product page → /cart → /checkout (login).\n" +
        "• 'Track my order?' → /orders (login required), or /orders/<id> if they have the ID.\n" +
        "• 'Return / refund?' → /terms (Section 4: Shipping & Returns) — 7 days, unused, original packaging.\n" +
        "• 'Delivery time?' → 3–5 business days nationwide; live status at /orders.\n" +
        "• 'Payment options?' → Cash on Delivery across Pakistan.\n" +
        "• 'Latest products?' → /new-arrivals.\n" +
        "• 'Browse a category?' → /collections/<slug> (use exact slug from list).\n" +
        "• 'Become a reseller?' → /dropshipper.\n" +
        "• 'Talk to a human?' → WhatsApp 03188055850 (message only) or email contact@pakcart.store, or use the form at /contact.\n" +
        "• 'Forgot password / login issue?' → /auth/login → 'Forgot password' link.\n" +
        "• 'Update my address / phone?' → /profile.\n" +
        "\n" +
        "── RULES FOR SHARING LINKS ──\n" +
        "• Always send users to a real page listed above. NEVER invent a path that isn't listed.\n" +
        "• Use relative paths like /products, /collections/<slug>, /orders, /contact in your replies — the chat auto-links them.\n" +
        "• For specific products or categories, use the EXACT slugs from the live snapshot below.\n" +
        "• If a user needs login first (checkout, orders, profile, dropshipper dashboard), mention it briefly so they aren't surprised by the login screen.\n" +
        "• Never share /admin/* paths with regular users — those are owner-only management pages."
    );

    if (cartItems.length > 0) {
      const total = (cartItems as any[]).reduce(
        (s, i) => s + (Number(i.price) || 0) * (Number(i.quantity) || 0),
        0
      );
      lines.push(`\nUser's cart (${cartItems.length} item${cartItems.length > 1 ? "s" : ""}, total Rs${total}):`);
      (cartItems as any[]).slice(0, 10).forEach((i) => {
        lines.push(`  - ${i.name} x${i.quantity} @ Rs${i.price}${i.slug ? ` (/products/${i.slug})` : ""}`);
      });
    } else {
      lines.push("\nUser's cart: empty");
    }

    if (parentCategories.length > 0) {
      lines.push("\nMain categories:");
      parentCategories.forEach((p: any) => {
        lines.push(`  - ${p.name} → /collections/${p.slug}`);
      });
    }
    if (categories.length > 0) {
      lines.push("\nSub-categories:");
      categories.slice(0, MAX_SUBCATEGORIES_IN_CONTEXT).forEach((c: any) => {
        lines.push(`  - ${c.name} → /collections/${c.slug}`);
      });
    }

    if (catalog && catalog.length > 0) {
      lines.push(`\nLive product snapshot (${Math.min(catalog.length, MAX_PRODUCTS_IN_CONTEXT)} of ${catalog.length} fetched):`);
      catalog.slice(0, MAX_PRODUCTS_IN_CONTEXT).forEach((p) => {
        const stock = p.inStock ? "in stock" : "OUT OF STOCK";
        lines.push(`  - ${p.name} | Rs${p.price} | ${stock} | /products/${p.slug}`);
      });
    }

    if (currentProduct) {
      const p = currentProduct;
      lines.push(`\nUser is right now looking at this product:`);
      lines.push(`  Name: ${p.name}`);
      lines.push(`  Price: Rs${p.price}`);
      lines.push(`  Stock: ${p.inStock ? "in stock" : "out of stock"}`);
      lines.push(`  Link: /products/${p.slug}`);
      if (p.description) {
        const desc = String(p.description).replace(/\s+/g, " ").trim().slice(0, DESCRIPTION_TRUNCATE);
        lines.push(`  Description: ${desc}${p.description.length > DESCRIPTION_TRUNCATE ? "…" : ""}`);
      }
      if ((p as any).labels?.length) {
        lines.push(`  Labels: ${(p as any).labels.slice(0, 6).join(", ")}`);
      }
    }

    lines.push(
      "\n=== HOW TO USE THIS CONTEXT ===\n" +
        "- For price/stock/availability/links: USE this snapshot. Never invent numbers.\n" +
        "- If a product the user asks about is NOT in the snapshot, say so honestly and send them to /products to browse the full catalog.\n" +
        "- If the user is on a product page, assume they're asking about THAT product unless they say otherwise.\n" +
        "- If the user has items in their cart, you can reference them naturally (e.g. 'aap ke cart mein already X hai').\n" +
        "- Always link to the exact /products/<slug> or /collections/<slug> path — these are live URLs on pakcart.store."
    );

    return lines.join("\n");
  }, [location, categories, parentCategories, cartItems, catalog, currentProduct, currentCollectionSlug]);
}
