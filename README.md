# Karsh Tech — Premium Game Studio Website & Publishing Platform

An enterprise-grade, cinematic game studio website and autonomous publishing platform for **Karsh Tech**. Distributes verified Android releases, tracks APK downloads, and provides an administrative console to manage game listings, release pipelines, and studio metadata without editing source code.

---

## 🌟 Key Features

### 1. Public Gaming Portal
- **Cinematic Homepage**: Atmospheric dark aesthetic, dynamic glow lighting, studio metrics counter strip, and featured showcase for **Arrow Puzzle**.
- **Central Games Library (`/games`)**: Dynamic search, platform chips (Android, PC, Web, etc.), genre tags, release status filters, and smooth card layout transitions.
- **Dynamic Game Pages (`/games/:slug`)**: Verified technical specifications (Android 8.0 to Android 15), features, controls guide, interactive high-resolution screenshot lightbox, version history, and cryptographic release badges.
- **Official APK Direct Download**: Directly delivers the signed release APK (`app-release.apk`, ~2.4 MB) with automatic byte streaming and live download tracking.
- **Studio Story & Team (`/studio`)**: Transparent development philosophy (Calming Focus, Spatial Logic, Engineering Craft) and verified team profiles.
- **Support & FAQ (`/support`)**: Issue reporting form and step-by-step sideloading installation guide.
- **Legal & Compliance (`/privacy`, `/terms`)**: Production-ready privacy policy and distribution terms tailored for offline-first logic games.

### 2. Functional Admin Dashboard
- **Protected Administrative Console (`/admin`)**:
  - Secure session handling with Bcrypt password hashing and HTTP-only JWT cookies.
  - In-memory rate limiting (5 failed attempts per 15 minutes) against brute-force attacks.
- **Game Management (`/admin/games`)**:
  - Full CRUD: Create, edit, toggle featured placement, upload cover artwork and screenshots, manage requirements, and delete titles.
- **Release & APK Management (`/admin/releases`)**:
  - Real APK binary upload workflow (`.apk` file type validation, size limit up to 150 MB).
  - Version name, version code, target SDKs, release notes, and instant publish/unpublish toggle.
- **Studio & Security Settings (`/admin/settings`)**:
  - Master password update and public announcement configuration.

### 3. Motion & Aesthetics
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
- **Initial Username**: `admin`
- **Initial Password**: `KarshTechAdmin2026!`

*(You can update this password at any time under `/admin/settings`)*

---

## 📁 Storage & Data Architecture

- **Persistent Database**: `server/data/db.json` (Atomic transactional JSON engine with temp-file write-and-rename durability).
- **Uploaded Cover & Screenshot Images**: `server/uploads/images/`
- **Uploaded Release APK Binaries**: `server/uploads/apks/`
- **Signed APK Seeded**: `arrow-puzzle-release-v1.0.0.apk` (2,514,510 bytes, copied directly from the verified Android release build).
