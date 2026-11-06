# KARSH TECH — DYNAMIC SOCIAL SHARING METADATA IMPLEMENTATION REPORT
**Release Phase:** Form Reliability & Dynamic Social Sharing Metadata Release  
**Target Domain:** https://tech.aadirishi.in  
**Implementation Date:** 2026-11-06  
**Status:** COMPLETED & VERIFIED  

---

## 1. Executive Summary

Prior to this implementation, sharing any URL from `tech.aadirishi.in` across messaging and social platforms (WhatsApp, Facebook, Twitter/X, Discord, LinkedIn, iMessage, Slack, Telegram) rendered an identical, generic link preview containing only the default site title and small Karsh Tech "K" icon. Product and game detail links—such as Arrow Puzzle—failed to display their rich cover screenshots or descriptive taglines.

The root cause was that modern single-page applications (SPAs) bundle their metadata into client-side JavaScript. Social crawlers do not execute JavaScript; they perform a raw HTTP GET request and parse the immediate server-returned HTML response.

To permanently solve this, an Express server-side metadata injection service (`server/services/MetadataService.ts`) was implemented. The server intercepts incoming page requests, resolves dynamic or route-specific metadata (querying Supabase PostgreSQL for dynamic game/product entries), and injects tailored `<title>`, Open Graph (`og:*`), Twitter Cards (`twitter:*`), canonical links, and search engine directives directly into the server HTML stream before transmission.

---

## 2. Crawler Mechanics & Why Server-Side Injection is Mandatory

### 2.1 The Crawler Execution Boundary
When a user pastes a URL into WhatsApp, Twitter, Facebook, LinkedIn, Discord, or iMessage:
1. The platform's automated scraping bot (e.g., `WhatsApp/2.21`, `facebookexternalhit/1.1`, `Twitterbot/1.0`) issues a standard `GET` request.
2. The crawler parses the raw HTML `<head>` tag for Open Graph (`<meta property="og:*">`) and Twitter tags (`<meta name="twitter:*">`).
3. If the HTML only contains `<div id="root"></div>` and static placeholder metadata, the crawler immediately generates a preview using the static placeholders.
4. The crawler **never executes Vite bundles or React `useEffect` hooks**.

### 2.2 Server-Side Architecture
To achieve instantaneous rich previews without full server-side React hydration:
1. **Static Serving Configuration:** `express.static(distPath, { index: false })` serves static files (`.js`, `.css`, `.png`, `.jpg`) directly, but allows directory root and client routes to fall through.
2. **Dynamic Route Interceptor:** Express route `app.get('*')` intercepts non-API, non-asset requests.
3. **Template Caching:** Reads `dist/index.html` into memory with high-performance LRU / cached mtime invalidation.
4. **Metadata Resolution:** `MetadataService.resolveMetadata(pathname)` resolves route specifications. If the route matches `/games/:slug` or `/products/:slug`, the service queries the database for the active record, cover image URL, and description.
5. **String Stream Replacement:** Replaces existing `<title>`, `<meta name="description">`, `<link rel="canonical">`, and `<meta property="og:*">` tags with sanitized, HTML-escaped metadata.

---

## 3. Comprehensive Route-by-Route Metadata Catalog

| Route | Page Context | Title Tag | Open Graph Title (`og:title`) | Description (`description` & `og:description`) | OG Image URL (`og:image`) | Twitter Card Type | Canonical URL |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/` | Homepage | Karsh Tech — Technology & Digital Product Development Organization | Karsh Tech — Technology & Digital Product Development Organization | Official digital platform of Karsh Tech. Independent technology and digital product development organization engineering high-performance software systems and interactive digital applications. | `https://tech.aadirishi.in/brand/karsh-tech-full.png` | `summary_large_image` | `https://tech.aadirishi.in/` |
| `/products` | Products Catalog | Products & Digital Solutions — Karsh Tech | Products & Digital Solutions — Karsh Tech | Explore enterprise-grade software products, developer utilities, and digital platforms engineered by Karsh Tech. | `https://tech.aadirishi.in/brand/karsh-tech-full.png` | `summary_large_image` | `https://tech.aadirishi.in/products` |
| `/products/:slug` | Product Detail | `{Title} — Products by Karsh Tech` | `{Title} — Products by Karsh Tech` | Product short description or tagline | Product cover/banner image from Supabase CDN or fallback brand card | `summary_large_image` | `https://tech.aadirishi.in/products/:slug` |
| `/games` | Games Catalog | Games & Interactive Experiences — Karsh Tech | Games & Interactive Experiences — Karsh Tech | Discover interactive games and mobile titles engineered by Karsh Tech, including the premier puzzle experience Arrow Puzzle. | `https://tech.aadirishi.in/brand/karsh-tech-full.png` | `summary_large_image` | `https://tech.aadirishi.in/games` |
| `/games/arrow-puzzle` | Arrow Puzzle Detail | `Arrow Puzzle — Official Game by Karsh Tech` | `Arrow Puzzle — Official Game by Karsh Tech` | Official release of Arrow Puzzle. Navigate challenging directional grids and strategic puzzles in this premier mobile title engineered by Karsh Tech. | `https://tech.aadirishi.in/uploads/arrow_puzzle_screenshot_1.jpg` *(or Supabase CDN)* | `summary_large_image` | `https://tech.aadirishi.in/games/arrow-puzzle` |
| `/games/:slug` | Any Game Detail | `{Title} — Official Game by Karsh Tech` | `{Title} — Official Game by Karsh Tech` | Game description or storyline excerpt | Game cover image from Supabase CDN | `summary_large_image` | `https://tech.aadirishi.in/games/:slug` |
| `/services` | Engineering Services | Engineering & Development Services — Karsh Tech | Engineering & Development Services — Karsh Tech | Full-lifecycle software engineering, mobile application development, cloud infrastructure architecture, and technical consultation services by Karsh Tech. | `https://tech.aadirishi.in/brand/karsh-tech-full.png` | `summary_large_image` | `https://tech.aadirishi.in/services` |
| `/portfolio` | Work Portfolio | Selected Works & Technical Portfolio — Karsh Tech | Selected Works & Technical Portfolio — Karsh Tech | Showcase of software systems, web applications, and digital interactive experiences engineered by Karsh Tech. | `https://tech.aadirishi.in/brand/karsh-tech-full.png` | `summary_large_image` | `https://tech.aadirishi.in/portfolio` |
| `/studio` | Studio Philosophy | Engineering Team & Studio Philosophy — Karsh Tech | Engineering Team & Studio Philosophy — Karsh Tech | Learn about the core engineers, development principles, and technical philosophy behind Karsh Tech. | `https://tech.aadirishi.in/brand/karsh-tech-full.png` | `summary_large_image` | `https://tech.aadirishi.in/studio` |
| `/contact` | Contact & Inquiries | Contact & Technical Consultation — Karsh Tech | Contact & Technical Consultation — Karsh Tech | Connect with Karsh Tech engineers for project inquiries, technical consultation, software development, and strategic partnerships. | `https://tech.aadirishi.in/brand/karsh-tech-full.png` | `summary_large_image` | `https://tech.aadirishi.in/contact` |
| `/support` | Support Desk | Support & Technical Assistance — Karsh Tech | Support & Technical Assistance — Karsh Tech | Official technical support and issue resolution center for Karsh Tech applications, releases, and software systems. | `https://tech.aadirishi.in/brand/karsh-tech-full.png` | `summary_large_image` | `https://tech.aadirishi.in/support` |
| `/privacy` | Privacy Policy | Privacy Policy — Karsh Tech | Privacy Policy — Karsh Tech | Official privacy and data protection policies for Karsh Tech users and services. | `https://tech.aadirishi.in/brand/karsh-tech-full.png` | `summary_large_image` | `https://tech.aadirishi.in/privacy` |
| `/terms` | Terms of Service | Terms of Service — Karsh Tech | Terms of Service — Karsh Tech | Official terms and legal conditions governing the use of Karsh Tech platforms and software products. | `https://tech.aadirishi.in/brand/karsh-tech-full.png` | `summary_large_image` | `https://tech.aadirishi.in/terms` |
| `/admin/*` | Admin Console | Karsh Tech Management Console | Karsh Tech Management Console | Restricted administration portal. | `https://tech.aadirishi.in/brand/karsh-tech-full.png` | `summary` | Directs `noindex, nofollow` |
| Unknown (404) | Fallback Shell | Page Not Found — Karsh Tech | Page Not Found — Karsh Tech | The requested resource could not be located on the Karsh Tech platform. | `https://tech.aadirishi.in/brand/karsh-tech-full.png` | `summary` | Directs `noindex, nofollow` |

---

## 4. Full Metadata Specification Injected per Request

Every page transmission injects the complete, standard-compliant set of Open Graph and Twitter Card tags:

```html
<title>Arrow Puzzle — Official Game by Karsh Tech</title>
<meta name="description" content="Official release of Arrow Puzzle. Navigate challenging directional grids and strategic puzzles in this premier mobile title engineered by Karsh Tech." />
<link rel="canonical" href="https://tech.aadirishi.in/games/arrow-puzzle" />

<!-- Open Graph -->
<meta property="og:site_name" content="Karsh Tech" />
<meta property="og:type" content="website" />
<meta property="og:title" content="Arrow Puzzle — Official Game by Karsh Tech" />
<meta property="og:description" content="Official release of Arrow Puzzle. Navigate challenging directional grids and strategic puzzles in this premier mobile title engineered by Karsh Tech." />
<meta property="og:image" content="https://tech.aadirishi.in/uploads/arrow_puzzle_screenshot_1.jpg" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="Arrow Puzzle — Official Game by Karsh Tech" />
<meta property="og:url" content="https://tech.aadirishi.in/games/arrow-puzzle" />

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="Arrow Puzzle — Official Game by Karsh Tech" />
<meta name="twitter:description" content="Official release of Arrow Puzzle. Navigate challenging directional grids and strategic puzzles in this premier mobile title engineered by Karsh Tech." />
<meta name="twitter:image" content="https://tech.aadirishi.in/uploads/arrow_puzzle_screenshot_1.jpg" />
```

---

## 5. Automated Verification & Crawler Parity

The automated test suite `tests/test_form_and_social_metadata.ts` verified that incoming requests bearing standard crawler User-Agent headers receive raw HTML with complete Open Graph metadata:

1. **WhatsApp Crawler (`WhatsApp/2.21.12.21 i`):**
   - Status: `✓ [PASS] WhatsApp crawler receives raw HTML with page-specific OG tags`
2. **Facebook External Hit Crawler (`facebookexternalhit/1.1`):**
   - Status: `✓ [PASS] Facebook crawler receives raw HTML with page-specific OG tags`
3. **Twitter / X Bot (`Twitterbot/1.0`):**
   - Status: `✓ [PASS] Twitter/X crawler receives raw HTML with page-specific OG tags`
4. **LinkedIn Crawler (`LinkedInBot/1.0`):**
   - Status: `✓ [PASS] LinkedIn crawler receives raw HTML with page-specific OG tags`
5. **Discord Webhook Crawler (`Discordbot/2.0`):**
   - Status: `✓ [PASS] Discord crawler receives raw HTML with page-specific OG tags`

---

## 6. Social Platform Cache Invalidation Instructions

Because platforms like Facebook, LinkedIn, Twitter/X, and Telegram aggressively cache link previews for days or weeks, previously shared links may show stale previews until the cache is refreshed.

Use the following official tools to immediately force-refresh platform previews:

### 1. Facebook & Instagram (Meta Sharing Debugger)
1. Navigate to: https://developers.facebook.com/tools/debug/
2. Enter the URL: `https://tech.aadirishi.in/games/arrow-puzzle` (or any other page).
3. Click **Debug**.
4. If old preview data appears, click the **Scrape Again** button.
5. Verify that the updated title, description, and preview image render accurately.

### 2. LinkedIn Post Inspector
1. Navigate to: https://www.linkedin.com/post-inspector/
2. Enter the URL: `https://tech.aadirishi.in/games/arrow-puzzle`
3. Click **Inspect**.
4. LinkedIn will re-scrape the server and immediately update its cached card.

### 3. Twitter / X Card Validator
1. Tweet or draft a post with `https://tech.aadirishi.in/games/arrow-puzzle` in the Twitter web composer.
2. Twitter will fetch the updated `summary_large_image` card.

### 4. Telegram Webpage Bot
1. Open Telegram and message `@WebpageBot`.
2. Send the URL: `https://tech.aadirishi.in/games/arrow-puzzle`.
3. The bot will clear Telegram's cached preview within seconds.

### 5. WhatsApp
- WhatsApp caches previews on user client devices and server nodes. Appending a cache-buster query parameter (e.g. `https://tech.aadirishi.in/games/arrow-puzzle?v=2`) or sharing newly updated URLs will immediately display the new rich preview banner.
