# Karsh Tech — Technology & Digital Product Development Organization

An enterprise-grade technology corporate website and digital product publishing platform for **Karsh Tech** (production website: `https://tech.aadirishi.in` • official contact: `karshhtech@gmail.com`).

Karsh Tech is an independent technology and digital product development organization that builds:
- **Websites**: Modern, responsive, high-performance websites for businesses and brands.
- **Web Applications**: Interactive platforms, client portals, and administrative dashboards.
- **Mobile Applications**: Native Android applications engineered with Kotlin and Jetpack Compose.
- **Games**: Mindful, tactile spatial logic games (such as Arrow Puzzle).
- **Custom Software**: Purpose-built software solutions and operational tools.

---

## 🌟 Key Features

### 1. Corporate Technology Portal
- **Cinematic Homepage (`/`)**: "We Turn Ideas into Digital Reality." Multi-disciplinary service overview, portfolio showcase, five core engineering pillars, five-step development workflow, and organization-wide FAQ.
- **Dedicated Services (`/services`)**: In-depth breakdown of Website Development, Web Application Development, Mobile Application Development, Game Development, and Custom Software.
- **Portfolio & Projects (`/portfolio`)**: Curated project archive featuring Arrow Puzzle, the Karsh Tech Platform, and categorized deliverables.
- **Games Catalog (`/games`)**: Dedicated catalog preserving game browsing, technical specifications, and verified APK releases.
- **About Karsh Tech (`/studio`)**: Organization vision, mission, engineering principles, and core team profiles.
- **Direct Contact (`/contact`)**: Official channel with transmission form and direct email: `karshhtech@gmail.com`.
- **Support Hub (`/support`)**: General product assistance, website help, APK sideloading installation guide, and ticket dispatch.
- **Legal Compliance (`/privacy`, `/terms`)**: Comprehensive, factual 12-section Privacy Policy and Terms of Service tailored to actual software and data operations.
- **SEO / GEO / AEO Optimization**: Dynamic `/sitemap.xml`, `/robots.txt`, `/llms.txt`, OpenGraph/Twitter social cards, and Schema.org JSON-LD structured data (`Organization`, `WebSite`, `Service`, `SoftwareApplication`, and `FAQPage`).

### 2. Functional Admin Dashboard
- **Protected Administrative Console (`/admin`)**:
  - Hardened JWT authentication with cryptographically random secrets, `HS256` algorithm enforcement, `iss`/`aud`/`sub` claim validation, and database identity verification.
  - In-memory rate limiting (5 failed attempts per 15 minutes) against brute-force attacks.
- **Game Management (`/admin/games`)**:
  - Full CRUD: Create, edit, toggle featured placement, upload cover artwork and screenshots, manage requirements, and delete titles.
- **Release & APK Management (`/admin/releases`)**:
  - Real APK binary upload workflow (`.apk` file type validation, size limit up to 150 MB).
  - Version name, version code, target SDKs, release notes, and instant publish/unpublish toggle.
- **Studio & Security Settings (`/admin/settings`)**:
  - Master password update and public announcement configuration.

### 3. Motion & Aesthetics
- **Approved Brand Logo Integration**: Official geometric K emblem and full brand identity assets integrated across headers, footers, admin console, favicons, touch icons, and social sharing previews. Wordmark consistently reads `KARSH TECH`.
- **Cinematic Easing**: Custom quintic curve `[0.16, 1, 0.3, 1]` adapted from the reference portfolio for smooth reveals.
- **Interactive 3D Tilt & Cursor Spotlight**: Framer Motion spring physics with zero layout shift on game cards.
- **Lenis Smooth Scroll**: 60 FPS buttery-smooth scrolling with automatic `prefers-reduced-motion` compliance.

---

## 🚀 Running the Platform Locally

### Prerequisites
- Node.js v20+ (v24.21.0 verified)
- npm v10+

### Development Mode (Full-stack hot reload)
Runs both Express backend (port 3001) and Vite dev server (port 5173) with automatic proxying:
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### Production Mode (Unified server)
Builds the optimized production client bundle and serves everything from Express:
```bash
npm run build
npm start
```
Open [http://localhost:3001](http://localhost:3001) in your browser.

---

## 🔐 Admin Console Access

- **Login URL**: [http://localhost:3001/admin/login](http://localhost:3001/admin/login) (or port 5173 in dev mode)
- **Initial Username**: `khrgosh`
- **Initial Password**: `KarshTechAdmin2026!` (or configured `ADMIN_PASSWORD`)

*(You can update this password at any time under `/admin/settings`)*

---

## 📁 Storage & Data Architecture

- **Persistent Database**: `server/data/db.json` (Atomic transactional JSON engine with temp-file write-and-rename durability).
- **Uploaded Cover & Screenshot Images**: `server/uploads/images/`
- **Uploaded Release APK Binaries**: `server/uploads/apks/`
- **Signed APK Seeded**: `arrow-puzzle-release-v1.0.0.apk` (2,514,510 bytes, copied directly from the verified Android release build).
