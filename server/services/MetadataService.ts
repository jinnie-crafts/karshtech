import fs from 'fs';
import path from 'path';
import type { IDatabaseProvider } from '../database/IDatabaseProvider.js';
import type { MediaService } from './MediaService.js';

export interface PageMetadata {
  title: string;
  description: string;
  canonicalUrl: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage: string;
  ogType: 'website' | 'article' | 'product';
  twitterCard: 'summary' | 'summary_large_image';
  robots?: string;
}

export class MetadataService {
  private db: IDatabaseProvider;
  private mediaService: MediaService;
  private domain: string;
  private cachedTemplate: string | null = null;
  private templatePath: string;

  constructor(db: IDatabaseProvider, mediaService: MediaService, domain?: string, templatePath?: string) {
    this.db = db;
    this.mediaService = mediaService;
    this.domain = (domain || process.env.PRODUCTION_DOMAIN || 'https://tech.aadirishi.in').replace(/\/+$/, '');
    this.templatePath = templatePath || path.resolve(process.cwd(), 'dist/index.html');
  }

  /**
   * Reads and caches the built HTML template.
   */
  public getTemplate(): string {
    if (this.cachedTemplate) {
      return this.cachedTemplate;
    }

    if (fs.existsSync(this.templatePath)) {
      this.cachedTemplate = fs.readFileSync(this.templatePath, 'utf8');
      return this.cachedTemplate;
    }

    // Fallback to public/index.html or root index.html during development/tests
    const rootIndex = path.resolve(process.cwd(), 'index.html');
    if (fs.existsSync(rootIndex)) {
      this.cachedTemplate = fs.readFileSync(rootIndex, 'utf8');
      return this.cachedTemplate;
    }

    return '<!doctype html><html><head><title>Karsh Tech</title></head><body><div id="root"></div></body></html>';
  }

  /**
   * Clears the cached template (useful after new builds or in test harnesses).
   */
  public clearTemplateCache(): void {
    this.cachedTemplate = null;
  }

  /**
   * Resolves authoritative, page-specific metadata for any requested public route.
   */
  public async resolveMetadata(pathname: string): Promise<PageMetadata> {
    const cleanPath = pathname.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';
    const defaultImage = `${this.domain}/brand/karsh-tech-full.png`;

    // 1. Homepage
    if (cleanPath === '/' || cleanPath === '/index.html') {
      return {
        title: 'Karsh Tech — Technology & Digital Product Development Organization',
        description:
          'Karsh Tech is an independent technology organization that creates modern websites, web applications, mobile applications, interactive games, and custom software solutions.',
        canonicalUrl: `${this.domain}/`,
        ogImage: defaultImage,
        ogType: 'website',
        twitterCard: 'summary_large_image',
      };
    }

    // 2. Products Listing
    if (cleanPath === '/products') {
      return {
        title: 'Products & Digital Solutions — Karsh Tech',
        description:
          'Explore modern software products, commercial web platforms, and purpose-built digital tools engineered by Karsh Tech.',
        canonicalUrl: `${this.domain}/products`,
        ogImage: defaultImage,
        ogType: 'website',
        twitterCard: 'summary_large_image',
      };
    }

    // 3. Product Detail: /products/:slug
    if (cleanPath.startsWith('/products/')) {
      const slug = cleanPath.replace('/products/', '').trim();
      try {
        const product = await this.db.getProductBySlug(slug);
        if (product && product.status !== 'Draft') {
          const rawCover = product.cover_image;
          const canonicalCover = rawCover
            ? this.mediaService.resolveCanonicalUrl(rawCover, 'product-assets')
            : defaultImage;

          const desc = product.short_description || product.description || 'Digital product engineered by Karsh Tech.';
          return {
            title: `${product.name} — Karsh Tech Product`,
            description: desc.length > 200 ? `${desc.substring(0, 197)}...` : desc,
            canonicalUrl: `${this.domain}/products/${encodeURIComponent(product.slug)}`,
            ogImage: canonicalCover.startsWith('http') ? canonicalCover : `${this.domain}${canonicalCover}`,
            ogType: 'product',
            twitterCard: 'summary_large_image',
          };
        }
      } catch {}

      // Fallback if product not found or draft
      return {
        title: 'Product Not Found — Karsh Tech',
        description: 'The requested Karsh Tech product could not be located in our verified catalog.',
        canonicalUrl: `${this.domain}/products`,
        ogImage: defaultImage,
        ogType: 'website',
        twitterCard: 'summary_large_image',
        robots: 'noindex, nofollow',
      };
    }

    // 4. Games Listing
    if (cleanPath === '/games') {
      const arrowCover = `${this.domain}/brand/karsh-tech-full.png`;
      return {
        title: 'Games & Interactive Experiences — Karsh Tech',
        description:
          'Discover independent interactive games developed by Karsh Tech, engineered with deterministic logic, tactile mechanics, and native Android APK releases.',
        canonicalUrl: `${this.domain}/games`,
        ogImage: arrowCover,
        ogType: 'website',
        twitterCard: 'summary_large_image',
      };
    }

    // 5. Game Detail: /games/:slug
    if (cleanPath.startsWith('/games/')) {
      const slug = cleanPath.replace('/games/', '').trim();
      try {
        const game = await this.db.getGameBySlug(slug);
        if (game) {
          const rawCover = game.cover_image;
          const canonicalCover = rawCover
            ? this.mediaService.resolveCanonicalUrl(rawCover, 'game-assets')
            : defaultImage;

          const desc = game.tagline || game.description || 'Official interactive game by Karsh Tech.';
          return {
            title: `${game.title} — Official Game by Karsh Tech`,
            description: desc.length > 200 ? `${desc.substring(0, 197)}...` : desc,
            canonicalUrl: `${this.domain}/games/${encodeURIComponent(game.slug)}`,
            ogImage: canonicalCover.startsWith('http') ? canonicalCover : `${this.domain}${canonicalCover}`,
            ogType: 'website',
            twitterCard: 'summary_large_image',
          };
        }
      } catch {}

      return {
        title: 'Game Not Found — Karsh Tech',
        description: 'The requested game could not be located in the Karsh Tech catalog.',
        canonicalUrl: `${this.domain}/games`,
        ogImage: defaultImage,
        ogType: 'website',
        twitterCard: 'summary_large_image',
        robots: 'noindex, nofollow',
      };
    }

    // 6. Services
    if (cleanPath === '/services') {
      return {
        title: 'Engineering & Development Services — Karsh Tech',
        description:
          'Full-cycle software engineering: bespoke website development, robust web platforms, native Android applications, game development, and custom backend systems.',
        canonicalUrl: `${this.domain}/services`,
        ogImage: defaultImage,
        ogType: 'website',
        twitterCard: 'summary_large_image',
      };
    }

    // 7. Portfolio / Projects
    if (cleanPath === '/portfolio' || cleanPath === '/projects') {
      return {
        title: 'Project Portfolio & Engineering Showcase — Karsh Tech',
        description:
          'Selected technology deployments, client websites, web applications, and interactive products engineered by Karsh Tech.',
        canonicalUrl: `${this.domain}/portfolio`,
        ogImage: defaultImage,
        ogType: 'website',
        twitterCard: 'summary_large_image',
      };
    }

    // 8. Studio / About
    if (cleanPath === '/studio' || cleanPath === '/about') {
      return {
        title: 'Engineering Team & Studio Philosophy — Karsh Tech',
        description:
          'Meet the founders and engineering leads at Karsh Tech. Turning ideas into digital reality through disciplined architecture and user-focused design.',
        canonicalUrl: `${this.domain}/studio`,
        ogImage: defaultImage,
        ogType: 'website',
        twitterCard: 'summary_large_image',
      };
    }

    // 9. Contact
    if (cleanPath === '/contact') {
      return {
        title: 'Contact & Technical Consultation — Karsh Tech',
        description:
          'Connect with Karsh Tech engineers to discuss web application, mobile app, game development, or custom software requirements.',
        canonicalUrl: `${this.domain}/contact`,
        ogImage: defaultImage,
        ogType: 'website',
        twitterCard: 'summary_large_image',
      };
    }

    // 10. Support
    if (cleanPath === '/support') {
      return {
        title: 'Support & Technical Assistance — Karsh Tech',
        description:
          'Official Karsh Tech technical support desk. Get assistance with APK installation, product inquiries, and platform troubleshooting.',
        canonicalUrl: `${this.domain}/support`,
        ogImage: defaultImage,
        ogType: 'website',
        twitterCard: 'summary_large_image',
      };
    }

    // 11. Privacy Policy
    if (cleanPath === '/privacy') {
      return {
        title: 'Privacy Policy & Data Ethics — Karsh Tech',
        description:
          'Our strict privacy commitment: zero third-party tracking, no user data selling, and minimal data processing principles.',
        canonicalUrl: `${this.domain}/privacy`,
        ogImage: `${this.domain}/brand/karsh-tech-k.png`,
        ogType: 'website',
        twitterCard: 'summary',
      };
    }

    // 12. Terms of Service
    if (cleanPath === '/terms') {
      return {
        title: 'Terms of Service — Karsh Tech',
        description:
          'Terms of service, licensing guidelines, and software distribution rules for Karsh Tech platforms and games.',
        canonicalUrl: `${this.domain}/terms`,
        ogImage: `${this.domain}/brand/karsh-tech-k.png`,
        ogType: 'website',
        twitterCard: 'summary',
      };
    }

    // 13. Admin Routes (Strict NoIndex)
    if (cleanPath.startsWith('/admin')) {
      return {
        title: 'Admin Console — Karsh Tech',
        description: 'Authorized administrative management portal.',
        canonicalUrl: `${this.domain}/admin/login`,
        ogImage: `${this.domain}/brand/karsh-tech-k.png`,
        ogType: 'website',
        twitterCard: 'summary',
        robots: 'noindex, nofollow',
      };
    }

    // 14. Unknown Route Fallback
    return {
      title: 'Page Not Found — Karsh Tech',
      description: 'The requested page could not be located on the Karsh Tech platform.',
      canonicalUrl: `${this.domain}/`,
      ogImage: defaultImage,
      ogType: 'website',
      twitterCard: 'summary_large_image',
      robots: 'noindex, nofollow',
    };
  }

  /**
   * Injects page-specific Open Graph, Twitter, canonical, and title metadata into the HTML shell.
   * Completely safe against HTML injection and XSS.
   */
  public injectMetadata(htmlTemplate: string, meta: PageMetadata): string {
    let html = htmlTemplate;

    const safeTitle = this.escapeHtml(meta.title);
    const safeDesc = this.escapeHtml(meta.description);
    const safeCanonical = this.escapeHtml(meta.canonicalUrl);
    const safeOgTitle = this.escapeHtml(meta.ogTitle || meta.title);
    const safeOgDesc = this.escapeHtml(meta.ogDescription || meta.description);
    const safeOgImage = this.escapeHtml(meta.ogImage);
    const safeOgType = this.escapeHtml(meta.ogType || 'website');
    const safeTwitterCard = this.escapeHtml(meta.twitterCard || 'summary_large_image');
    const safeRobots = meta.robots ? this.escapeHtml(meta.robots) : null;

    // 1. Replace <title>
    html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${safeTitle}</title>`);

    // 2. Replace <meta name="description">
    html = html.replace(
      /<meta\s+name="description"\s+content="[\s\S]*?"\s*\/?>/i,
      `<meta name="description" content="${safeDesc}" />`
    );

    // 3. Replace <link rel="canonical">
    html = html.replace(
      /<link\s+rel="canonical"\s+href="[\s\S]*?"\s*\/?>/i,
      `<link rel="canonical" href="${safeCanonical}" />`
    );

    // 4. Open Graph tags
    html = html.replace(
      /<meta\s+property="og:title"\s+content="[\s\S]*?"\s*\/?>/i,
      `<meta property="og:title" content="${safeOgTitle}" />`
    );
    html = html.replace(
      /<meta\s+property="og:description"\s+content="[\s\S]*?"\s*\/?>/i,
      `<meta property="og:description" content="${safeOgDesc}" />`
    );
    html = html.replace(
      /<meta\s+property="og:url"\s+content="[\s\S]*?"\s*\/?>/i,
      `<meta property="og:url" content="${safeCanonical}" />`
    );
    html = html.replace(
      /<meta\s+property="og:image"\s+content="[\s\S]*?"\s*\/?>/i,
      `<meta property="og:image" content="${safeOgImage}" />`
    );
    html = html.replace(
      /<meta\s+property="og:type"\s+content="[\s\S]*?"\s*\/?>/i,
      `<meta property="og:type" content="${safeOgType}" />`
    );

    // 5. Twitter Card tags
    html = html.replace(
      /<meta\s+name="twitter:card"\s+content="[\s\S]*?"\s*\/?>/i,
      `<meta name="twitter:card" content="${safeTwitterCard}" />`
    );
    html = html.replace(
      /<meta\s+name="twitter:title"\s+content="[\s\S]*?"\s*\/?>/i,
      `<meta name="twitter:title" content="${safeOgTitle}" />`
    );
    html = html.replace(
      /<meta\s+name="twitter:description"\s+content="[\s\S]*?"\s*\/?>/i,
      `<meta name="twitter:description" content="${safeOgDesc}" />`
    );
    html = html.replace(
      /<meta\s+name="twitter:image"\s+content="[\s\S]*?"\s*\/?>/i,
      `<meta name="twitter:image" content="${safeOgImage}" />`
    );

    // 6. Robots tag if specified
    if (safeRobots) {
      if (html.includes('<meta name="robots"')) {
        html = html.replace(
          /<meta\s+name="robots"\s+content="[\s\S]*?"\s*\/?>/i,
          `<meta name="robots" content="${safeRobots}" />`
        );
      } else {
        html = html.replace('</head>', `  <meta name="robots" content="${safeRobots}" />\n  </head>`);
      }
    }

    return html;
  }

  /**
   * HTML escape utility preventing script injection into head attributes.
   */
  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
