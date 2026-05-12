# PakCart — Online Shopping in Pakistan

<p align="center">
  <img src="client/public/og-image.png" alt="PakCart Banner" width="100%" />
</p>

<p align="center">
  <strong>Pakistan's trusted e-commerce platform for fashion, footwear & home essentials</strong>
</p>

<p align="center">
  <a href="https://pakcart.store" target="_blank">🌐 Live Store</a> &nbsp;|&nbsp;
  <a href="#features">✨ Features</a> &nbsp;|&nbsp;
  <a href="#tech-stack">🛠 Tech Stack</a> &nbsp;|&nbsp;
  <a href="#getting-started">🚀 Getting Started</a> &nbsp;|&nbsp;
  <a href="#project-structure">📁 Structure</a>
</p>

---

## Overview

PakCart is a full-featured e-commerce web application built for the Pakistani market. It offers a curated selection of women's bags & wallets, jewelry, shoes, slippers, stitched dresses, men's watches, and tech gadgets — all with cash on delivery and nationwide shipping.

The platform includes a complete admin dashboard, AI-powered chat assistant, dropshipper portal, seed comment management, and a deeply optimized SEO layer.

---

## Features

### 🛍 Customer-Facing
- **Product Catalog** — filterable by category, price, and search
- **Product Detail Pages** — rich descriptions, image galleries, ratings, FAQs
- **Shopping Cart** — persistent across sessions via Zustand
- **Checkout Flow** — cash on delivery with order confirmation emails
- **User Accounts** — email/password + Google login, order history, profile management
- **New Arrivals** — dedicated page for latest products
- **Category Collections** — `/collections/:slug` clean URL structure
- **AI Chat Assistant** — Gemini-powered support widget
- **Responsive Design** — mobile-first, optimized for all screen sizes

### 🔧 Admin Dashboard (`/admin`)
- **Products** — add, edit, delete with Cloudinary image upload
- **Categories** — manage slugs, icons, display order
- **Orders** — view and manage all customer orders
- **Homepage Slider** — separate desktop & mobile hero slides
- **Announcements** — banner and popup announcements
- **Seed Comments** — analytics, health scoring, audit, auto-refresh
- **Search Analytics** — track what customers are searching
- **Profit Rules** — configure markup rules per category
- **Dropshippers** — manage dropshipper accounts
- **Sitemap** — view and manage SEO sitemap

### 📦 Dropshipper Portal
- Dedicated registration and dashboard
- Catalog browsing with wholesale pricing

### 🔍 SEO
- Unique meta titles & descriptions per page
- Open Graph & Twitter Card tags
- JSON-LD structured data (Product, Organization, FAQ, Breadcrumb, CollectionPage, ItemList, WebSite)
- Dynamic XML sitemap
- `robots.txt` with proper crawl rules
- PWA manifest (`site.webmanifest`)
- Canonical URLs, noindex on private routes

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18 + TypeScript |
| **Build Tool** | Vite 7 |
| **Routing** | wouter |
| **State** | Zustand (auth, cart) + TanStack Query (server state) |
| **UI** | Shadcn UI + Tailwind CSS + Radix UI |
| **Animations** | Framer Motion |
| **Forms** | React Hook Form + Zod |
| **Auth** | Firebase Authentication (Email/Password + Google) |
| **Database** | Firebase Firestore |
| **Media** | Cloudinary (image upload, optimization, transformations) |
| **AI** | Google Gemini (via Replit AI Integration) |
| **Email** | EmailJS (order notifications) |
| **Rich Text** | Tiptap Editor |
| **Charts** | Recharts |
| **Icons** | Lucide React + React Icons |

---

## Getting Started

### Prerequisites
- Node.js 20+
- A Firebase project (Firestore + Authentication enabled)
- A Cloudinary account

### 1. Clone & Install

```bash
git clone https://github.com/your-username/pakcart.git
cd pakcart
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` and fill in your values:

```bash
cp .env.example .env
```

| Variable | Description |
|---|---|
| `VITE_FIREBASE_API_KEY` | Firebase project API key |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID |
| `VITE_FIREBASE_APP_ID` | Firebase app ID |
| `VITE_CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `VITE_CLOUDINARY_UPLOAD_PRESET` | Cloudinary unsigned upload preset |
| `GEMINI_API_KEY` | Google Gemini API key (for AI chat) |

### 3. Start Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:5000`.

### 4. Build for Production

```bash
npm run build
```

---

## Project Structure

```
pakcart/
├── client/
│   ├── public/              # Static assets (favicon, sitemap, robots.txt)
│   └── src/
│       ├── components/      # Reusable UI components
│       │   ├── admin/       # Admin-only components
│       │   ├── auth/        # Auth guards (ProtectedRoute, AdminRoute)
│       │   ├── layout/      # Header, Footer, Navbar, Layout
│       │   └── product/     # ProductCard, ProductImage, etc.
│       ├── pages/           # Full page components
│       │   ├── admin/       # Admin dashboard pages
│       │   └── auth/        # Login, Signup, Profile
│       ├── hooks/           # Custom React hooks
│       ├── services/        # Firestore data access layer
│       ├── store/           # Zustand stores (auth, cart)
│       ├── lib/             # Firebase, Cloudinary, SEO config
│       └── types/           # TypeScript type definitions
├── shared/                  # Zod schemas shared across the app
├── scripts/
│   └── validate-build.js    # Post-build validation
├── firebase.json            # Firebase CLI config
├── firestore.rules          # Firestore security rules
├── firestore.indexes.json   # Firestore composite indexes
├── tailwind.config.ts
├── vite.config.ts           # Vite config + Gemini AI proxy middleware
└── package.json
```

---

## Admin Access

Admin accounts are managed via Firestore. To promote a user to admin, set their `role` field to `"admin"` in the `users` collection in your Firebase Console.

---

## Firestore Security

The `firestore.rules` file enforces:
- Public read access to products, categories, and announcements
- Authenticated write access for orders and user profiles
- Admin-only write access for products, categories, and settings

Deploy rules with:

```bash
firebase deploy --only firestore:rules
```

---

## Environment Notes

- Firebase public config (`VITE_FIREBASE_*`) is intentionally exposed to the browser — this is the standard Firebase pattern, secured via Firestore Rules.
- The Gemini AI proxy runs as a Vite dev middleware (no separate server needed).
- Cloudinary upload presets are configured as **unsigned** presets — safe for browser-side uploads.

---

## License

This project is proprietary software. All rights reserved.

---

## Author

**Saif Khan**
- Store: [pakcart.store](https://pakcart.store)
- Email: saifkhan16382@gmail.com

---

<p align="center">Built with ❤️ for Pakistan</p>
