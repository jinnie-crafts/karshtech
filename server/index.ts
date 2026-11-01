if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile();
  } catch {}
}

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { db } from './db.js';
import {
  requireAdmin,
  hashPassword,
  comparePassword,
  generateToken,
  setSessionCookie,
  clearSessionCookie,
  checkLoginRateLimit,
  recordFailedLogin,
  clearLoginAttempts,
} from './auth.js';
import { seedDatabase } from './seed.js';
import {
  UPLOADS_DIR,
  DEFAULT_REPO_UPLOADS_DIR,
  IMAGES_DIR,
  APKS_DIR,
  ensureStorageDirectories,
  IS_PERSISTENT_STORAGE,
} from './paths.js';
import {
  createStorageService,
  setStorageService,
  MAX_IMAGE_SIZE_BYTES,
  MAX_APK_SIZE_BYTES,
  ALLOWED_IMAGE_EXTENSIONS,
  PROTECTED_STORAGE_OBJECTS,
  validateImageBuffer,
  validateApkBuffer,
  generateObjectPath,
  type StorageBucket,
} from './storage/index.js';

const app = express();
const PORT = process.env.PORT || 3001;
const storageService = createStorageService();

ensureStorageDirectories();

// Allowed origins for CORS and CSRF protection
const ALLOWED_ORIGINS = [
  'https://tech.aadirishi.in',
  'https://www.tech.aadirishi.in',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
];

// Middleware
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, server-to-server)
      if (!origin || ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CSRF validation for state-changing administrative requests
app.use('/api/admin', (req, res, next) => {
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    // If request has Authorization Bearer header, CSRF is mitigated
    if (req.headers.authorization?.startsWith('Bearer ')) {
      return next();
    }
    // If relying on cookies, verify Origin/Referer
    const origin = req.headers.origin || (req.headers.referer ? new URL(req.headers.referer).origin : null);
    if (origin && !ALLOWED_ORIGINS.includes(origin)) {
      res.status(403).json({ error: 'Forbidden: Cross-site request rejected (CSRF protection)' });
      return;
    }
  }
  next();
});

// Legacy URL backward compatibility:
// If an image requested via /uploads/images/:filename is not present on local disk,
// redirect (HTTP 302) to the canonical Supabase Storage public CDN URL.
app.get('/uploads/images/:filename', (req, res, next) => {
  const rawFilename = req.params.filename || '';

  // Security check: reject empty filenames, null bytes, path traversal sequences, and slashes
  if (
    !rawFilename ||
    rawFilename.includes('\0') ||
    rawFilename.includes('/') ||
    rawFilename.includes('\\') ||
    rawFilename.includes('..') ||
    rawFilename.includes('%2e') ||
    rawFilename.includes('%2E') ||
    rawFilename.includes('%2f') ||
    rawFilename.includes('%2F') ||
    rawFilename.includes('%5c') ||
    rawFilename.includes('%5C')
  ) {
    return res.status(400).json({ error: 'Invalid or unsafe image filename' });
  }

  const safeFilename = path.basename(rawFilename);
  if (safeFilename !== rawFilename) {
    return res.status(400).json({ error: 'Invalid image filename' });
  }

  const resolvedImagesDir = path.resolve(IMAGES_DIR);
  const localFile = path.resolve(resolvedImagesDir, safeFilename);

  // Guarantee that resolved path remains strictly within IMAGES_DIR
  if (!localFile.startsWith(resolvedImagesDir)) {
    return res.status(400).json({ error: 'Path traversal attempt detected' });
  }

  if (fs.existsSync(localFile)) {
    return next();
  }

  try {
    const publicUrl = storageService.getPublicUrl('game-assets', safeFilename);
    res.setHeader('Cache-Control', 'public, max-age=300, must-revalidate');
    return res.redirect(302, publicUrl);
  } catch {
    next();
  }
});

// Static file serving for uploads (local disk uploads preserved for development/fallback)
// Avatars revalidate quickly (max-age=300) so that profile updates propagate cleanly
const staticUploadsOptions = {
  maxAge: '1h',
  setHeaders: (res: any, filePath: string) => {
    const base = path.basename(filePath);
    if (base.startsWith('avatar_')) {
      res.setHeader('Cache-Control', 'public, max-age=300, must-revalidate');
    }
  },
};
app.use('/uploads', express.static(UPLOADS_DIR, staticUploadsOptions));
if (path.resolve(UPLOADS_DIR) !== path.resolve(DEFAULT_REPO_UPLOADS_DIR) && fs.existsSync(DEFAULT_REPO_UPLOADS_DIR)) {
  app.use('/uploads', express.static(DEFAULT_REPO_UPLOADS_DIR, staticUploadsOptions));
}

// Configure Multer with memory storage for bounded buffers
const uploadImageMulter = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_SIZE_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (ALLOWED_IMAGE_EXTENSIONS.has(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid image file type. Allowed: PNG, JPG, JPEG, WEBP, GIF'));
    }
  },
});

function handleImageUpload(req: express.Request, res: express.Response, next: express.NextFunction) {
  uploadImageMulter.single('image')(req, res, (err: any) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Image exceeds maximum allowed size of 15 MB' });
      }
      return res.status(400).json({ error: `Upload error: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ error: err.message || 'Invalid upload' });
    }
    next();
  });
}

export function sanitizeOriginalFilename(rawName: string | undefined, fallbackStoredName?: string): string {
  let name = (rawName || '').trim();
  if (!name && fallbackStoredName) {
    name = fallbackStoredName.trim();
  }
  if (!name) {
    return 'release.apk';
  }

  // Strip path traversal components
  name = path.basename(name);
  // Strip null bytes and control characters
  name = name.replace(/[\x00-\x1f\x7f]/g, '');
  // Strip characters forbidden across Windows/Linux filesystems & quotes
  name = name.replace(/["\\/:*?<>|]/g, '');
  // Normalize whitespace to single spaces
  name = name.replace(/\s+/g, ' ').trim();

  // Ensure ends with .apk
  if (!name.toLowerCase().endsWith('.apk')) {
    name += '.apk';
  }
  if (name.toLowerCase() === '.apk' || name.length === 0) {
    return 'release.apk';
  }
  return name;
}

export function formatContentDisposition(filename: string): string {
  // ASCII fallback for filename="..." parameter
  const asciiFallback = filename.replace(/[^\x20-\x7E]|["\\]/g, '_');
  // RFC 5987 / RFC 6266 percent encoding for filename* parameter
  const encodedUtf8 = encodeURIComponent(filename)
    .replace(/['()]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/\*/g, '%2A');

  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodedUtf8}`;
}

// Configure Multer for APK Uploads (memory storage, 50 MB limit)
const uploadApkMulter = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_APK_SIZE_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (ext === '.apk') {
      cb(null, true);
    } else {
      cb(new Error('Only Android Package files (.apk) are accepted.'));
    }
  },
});

function handleApkUpload(req: express.Request, res: express.Response, next: express.NextFunction) {
  uploadApkMulter.single('apk')(req, res, (err: any) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'APK file exceeds maximum allowed size of 50 MB on Supabase Free' });
      }
      return res.status(400).json({ error: `Upload error: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ error: err.message || 'Invalid upload' });
    }
    next();
  });
}

// ==========================================
// PUBLIC API ENDPOINTS
// ==========================================

// GET /api/games - Public catalog
app.get('/api/games', async (req, res) => {
  try {
    let games = await db.getGames();

    // Filters
    const { genre, platform, status, search, featured } = req.query;

    if (featured === 'true') {
      games = games.filter((g) => g.featured);
    }

    if (platform && typeof platform === 'string') {
      games = games.filter((g) => g.platforms.some((p) => p.toLowerCase() === platform.toLowerCase()));
    }

    if (genre && typeof genre === 'string') {
      games = games.filter((g) => g.genre.some((gr) => gr.toLowerCase() === genre.toLowerCase()));
    }

    if (status && typeof status === 'string') {
      games = games.filter((g) => g.status.toLowerCase() === status.toLowerCase());
    }

    if (search && typeof search === 'string') {
      const q = search.toLowerCase();
      games = games.filter(
        (g) =>
          g.title.toLowerCase().includes(q) ||
          g.tagline.toLowerCase().includes(q) ||
          g.description.toLowerCase().includes(q) ||
          g.genre.some((item) => item.toLowerCase().includes(q))
      );
    }

    // Attach latest release info to each game
    const populated = await Promise.all(
      games.map(async (game) => {
        const latestRelease = await db.getLatestReleaseByGameId(game.id, true);
        return {
          ...game,
          latest_release: latestRelease || undefined,
        };
      })
    );

    res.json({ games: populated });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch games' });
  }
});

// GET /api/games/:slug - Detailed game info
app.get('/api/games/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const game = await db.getGameBySlug(slug);

    if (!game) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }

    const [latestRelease, allReleases] = await Promise.all([
      db.getLatestReleaseByGameId(game.id, true),
      db.getReleasesByGameId(game.id),
    ]);

    const allPublishedReleases = allReleases
      .filter((r) => r.is_published)
      .sort((a, b) => b.version_code - a.version_code);

    res.json({
      game: {
        ...game,
        latest_release: latestRelease || undefined,
        releases: allPublishedReleases,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch game details' });
  }
});

// GET /api/products - Public products catalog (published only)
app.get('/api/products', async (req, res) => {
  try {
    let products = await db.getProducts(false); // Published only
    const { category, search, featured, include_games } = req.query;

    // Bridge published games into unified products catalog under 'Games' category
    if (include_games !== 'false') {
      const allGames = await db.getGames();
      const publishedGames = allGames.filter((g) => g.status === 'Available' || g.status === 'Updated');
      for (const g of publishedGames) {
        const alreadyExists = products.some((p) => p.slug.toLowerCase() === g.slug.toLowerCase());
        if (!alreadyExists) {
          const latestRelease = await db.getLatestReleaseByGameId(g.id, true);
          products.push({
            id: g.id,
            name: g.title,
            slug: g.slug,
            short_description: g.tagline || 'Native Android Interactive Game',
            description: g.description,
            category: 'Games',
            cover_image: g.cover_image || '/uploads/images/default_cover.jpg',
            gallery: g.screenshots || [],
            technologies: ['Android SDK', 'Kotlin', 'Jetpack Compose', 'Preferences DataStore'],
            project_url: `/games/${g.slug}`,
            apk_download_url: latestRelease?.apk_download_url,
            platform: 'Android',
            status: 'Published',
            featured: g.featured,
            display_order: 10,
            created_at: g.created_at,
            updated_at: g.updated_at,
            published_at: g.created_at,
          });
        }
      }
    }

    // Filter by category
    if (category && typeof category === 'string' && category !== 'All') {
      products = products.filter((p) => p.category.toLowerCase() === category.toLowerCase());
    }

    // Filter by featured
    if (featured === 'true') {
      products = products.filter((p) => p.featured);
    }

    // Filter by search
    if (search && typeof search === 'string') {
      const q = search.toLowerCase();
      products = products.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.slug.toLowerCase().includes(q) ||
          p.short_description.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.technologies.some((t) => t.toLowerCase().includes(q))
      );
    }

    // Enforce descending chronological order (newest-first) across unified catalog
    products.sort((a, b) => {
      const timeDiff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (timeDiff !== 0) return timeDiff;
      return (b.id || '').localeCompare(a.id || '');
    });

    res.json({ products });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch products' });
  }
});

// GET /api/products/:slug - Public product details
app.get('/api/products/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    let product = await db.getProductBySlug(slug, false);

    // If not in products collection, check if it's a published game
    if (!product) {
      const game = await db.getGameBySlug(slug);
      if (game && (game.status === 'Available' || game.status === 'Updated')) {
        const latestRelease = await db.getLatestReleaseByGameId(game.id, true);
        product = {
          id: game.id,
          name: game.title,
          slug: game.slug,
          short_description: game.tagline || 'Native Android Interactive Game',
          description: game.description,
          category: 'Games',
          cover_image: game.cover_image || '/uploads/images/default_cover.jpg',
          gallery: game.screenshots || [],
          technologies: ['Android SDK', 'Kotlin', 'Jetpack Compose', 'Preferences DataStore'],
          project_url: `/games/${game.slug}`,
          apk_download_url: latestRelease?.apk_download_url,
          platform: 'Android',
          status: 'Published',
          featured: game.featured,
          display_order: 10,
          created_at: game.created_at,
          updated_at: game.updated_at,
          published_at: game.created_at,
        };
      }
    }

    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    res.json({ product });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch product details' });
  }
});

// GET /api/releases/:id/download - Stream/download release APK
app.get('/api/releases/:id/download', async (req, res) => {
  try {
    const { id } = req.params;
    const release = await db.getReleaseById(id);

    if (!release) {
      res.status(404).json({ error: 'Release not found' });
      return;
    }

    if (!release.is_published) {
      res.status(403).json({ error: 'This release has not been published yet' });
      return;
    }

    // Step 1: Check Supabase Storage first for the APK object
    let storageMetadata = null;
    try {
      storageMetadata = await storageService.getObjectMetadata('release-apks', release.apk_filename);
    } catch (err: any) {
      console.warn(`[Storage Warning] Error checking metadata for ${release.apk_filename}:`, err.message);
    }

    const localApkPath = path.join(APKS_DIR, release.apk_filename);
    const existsLocally = fs.existsSync(localApkPath);

    if (!storageMetadata && !existsLocally) {
      res.status(404).json({ error: 'Release file is missing on storage' });
      return;
    }

    // Format RFC 6266 / RFC 5987 compliant Content-Disposition
    const downloadFilename = sanitizeOriginalFilename(release.original_filename, release.apk_filename);
    const contentDisposition = formatContentDisposition(downloadFilename);

    // If available in Supabase Storage, stream directly from private Storage
    if (storageMetadata) {
      const download = await storageService.downloadPrivate('release-apks', release.apk_filename);

      // Successfully initialized storage stream: atomically increment download counter
      await db.incrementDownload(release.id);

      res.setHeader('Content-Disposition', contentDisposition);
      res.setHeader('Content-Type', download.contentType || 'application/vnd.android.package-archive');
      if (download.contentLength) {
        res.setHeader('Content-Length', download.contentLength.toString());
      }
      if (download.eTag) {
        res.setHeader('ETag', download.eTag);
      }
      res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');

      download.stream.on('error', (_streamErr: any) => {
        if (!res.headersSent) {
          res.status(500).json({ error: 'Download stream error' });
        }
      });

      download.stream.pipe(res);
      return;
    }

    // Fallback: local disk file (dev environment without Supabase Storage)
    await db.incrementDownload(release.id);
    res.setHeader('Content-Disposition', contentDisposition);
    res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    res.sendFile(
      localApkPath,
      {
        headers: {
          'Content-Disposition': contentDisposition,
        },
      },
      (err) => {
        if (err && !res.headersSent) {
          res.status(500).json({ error: 'Download failed during transfer' });
        }
      }
    );
  } catch (err: any) {
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || 'Download error' });
    }
  }
});

// GET /api/stats - Public studio stats
app.get('/api/stats', async (_req, res) => {
  try {
    const [games, releases, products, settings] = await Promise.all([
      db.getGames(),
      db.getReleases(),
      db.getProducts(true),
      db.getSettings(),
    ]);
    const totalDownloads = releases.reduce((sum, r) => sum + (r.download_count || 0), 0);

    res.json({
      stats: {
        total_games: games.length,
        available_games: games.filter((g) => g.status === 'Available').length,
        total_releases: releases.filter((r) => r.is_published).length,
        total_downloads: totalDownloads,
        total_products: products.length,
        published_products: products.filter((p) => p.status === 'Published').length,
        draft_products: products.filter((p) => p.status === 'Draft').length,
      },
      settings,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/support and /api/contact - Inquiries, Contact and Support
app.post(['/api/support', '/api/contact'], (req, res) => {
  const { name, email, category, game, subject, message } = req.body;
  if (!name || !email || !message) {
    res.status(400).json({ error: 'Name, email, and message are required.' });
    return;
  }
  const topic = category || game || 'General Inquiry';
  console.log(`[Contact / Support] From: ${name} <${email}> | Topic: ${topic} | Subject: ${subject || 'No Subject'}`);
  res.json({ success: true, message: 'Your transmission has been received by Karsh Tech. Our team will review it and reply shortly.' });
});

// ==========================================
// SEO / GEO / AEO DISCOVERY ENDPOINTS
// ==========================================
const DOMAIN = process.env.PRODUCTION_DOMAIN || 'https://tech.aadirishi.in';

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '&':
        return '&amp;';
      case '\'':
        return '&apos;';
      case '"':
        return '&quot;';
      default:
        return c;
    }
  });
}

function getReliableLastmod(dateStr?: string | null): string | undefined {
  if (!dateStr || typeof dateStr !== 'string') return undefined;
  const parsed = Date.parse(dateStr);
  if (isNaN(parsed)) return undefined;
  return new Date(parsed).toISOString().split('T')[0];
}

// GET /sitemap.xml - Dynamic XML Sitemap
app.get('/sitemap.xml', async (_req, res) => {
  try {
    const [games, publishedProducts] = await Promise.all([
      db.getGames(),
      db.getProducts(false),
    ]);

    interface SitemapEntry {
      loc: string;
      lastmod?: string;
      changefreq?: string;
      priority?: string;
    }

    const staticUrls: SitemapEntry[] = [
      { loc: `${DOMAIN}/`, priority: '1.0', changefreq: 'daily' },
      { loc: `${DOMAIN}/products`, priority: '0.9', changefreq: 'weekly' },
      { loc: `${DOMAIN}/services`, priority: '0.9', changefreq: 'weekly' },
      { loc: `${DOMAIN}/portfolio`, priority: '0.8', changefreq: 'weekly' },
      { loc: `${DOMAIN}/games`, priority: '0.8', changefreq: 'weekly' },
      { loc: `${DOMAIN}/studio`, priority: '0.8', changefreq: 'weekly' },
      { loc: `${DOMAIN}/contact`, priority: '0.8', changefreq: 'monthly' },
      { loc: `${DOMAIN}/support`, priority: '0.7', changefreq: 'monthly' },
      { loc: `${DOMAIN}/privacy`, priority: '0.5', changefreq: 'monthly' },
      { loc: `${DOMAIN}/terms`, priority: '0.5', changefreq: 'monthly' },
    ];

    const productUrls: SitemapEntry[] = publishedProducts
      .filter((p) => p && p.slug)
      .map((p) => ({
        loc: `${DOMAIN}/products/${encodeURIComponent(p.slug)}`,
        lastmod: getReliableLastmod(p.updated_at || p.created_at),
        priority: '0.8',
        changefreq: 'weekly',
      }));

    const gameUrls: SitemapEntry[] = games
      .filter((g) => g && g.slug)
      .map((game) => ({
        loc: `${DOMAIN}/games/${encodeURIComponent(game.slug)}`,
        lastmod: getReliableLastmod(game.updated_at || game.created_at),
        priority: '0.8',
        changefreq: 'weekly',
      }));

    // Deduplicate URLs while preserving order
    const seenLocs = new Set<string>();
    const deduplicatedUrls: SitemapEntry[] = [];
    for (const entry of [...staticUrls, ...productUrls, ...gameUrls]) {
      if (!seenLocs.has(entry.loc)) {
        seenLocs.add(entry.loc);
        deduplicatedUrls.push(entry);
      }
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${deduplicatedUrls
  .map((u) => {
    const lines = [
      `    <loc>${escapeXml(u.loc)}</loc>`,
      u.lastmod ? `    <lastmod>${escapeXml(u.lastmod)}</lastmod>` : null,
      u.changefreq ? `    <changefreq>${escapeXml(u.changefreq)}</changefreq>` : null,
      u.priority ? `    <priority>${escapeXml(u.priority)}</priority>` : null,
    ].filter(Boolean);
    return `  <url>\n${lines.join('\n')}\n  </url>`;
  })
  .join('\n')}
</urlset>`;

    res.header('Content-Type', 'application/xml; charset=utf-8');
    res.send(xml);
  } catch (err: any) {
    res.status(500).send('Error generating sitemap');
  }
});

// GET /robots.txt
app.get('/robots.txt', (_req, res) => {
  const robots = `User-agent: *
Allow: /
Disallow: /admin
Disallow: /admin/
Disallow: /api/admin
Disallow: /api/admin/
Disallow: /api/auth
Disallow: /api/auth/

Sitemap: ${DOMAIN}/sitemap.xml
`;
  res.header('Content-Type', 'text/plain; charset=utf-8');
  res.send(robots);
});

// GET /llms.txt - Generative Engine Optimization (GEO) Knowledge Document
app.get('/llms.txt', async (_req, res) => {
  try {
    const games = await db.getGames();
    const gamesList = games
      .map(
        (g) =>
          `- **${g.title}**: ${g.tagline || g.description} (Category: Games / Mobile | Platforms: ${g.platforms.join(', ')} | Status: ${g.status} | URL: ${DOMAIN}/games/${g.slug})`
      )
      .join('\n');

    const content = `# Karsh Tech
> Technology & Digital Product Development Organization

- **Website**: ${DOMAIN}
- **Official Contact**: karshhtech@gmail.com
- **Organization Identity**: Karsh Tech is an independent technology organization that creates modern websites, web applications, mobile applications, interactive games, and custom software solutions.
- **Flagship Products**: Arrow Puzzle (native Android spatial logic game) and Karsh Tech Platform (autonomous technology publishing portal).

## Services & Core Disciplines
- **Websites**: Modern, responsive, high-performance websites for businesses, creators, and digital brands.
- **Web Applications**: Interactive platforms, client portals, SaaS dashboards, and browser-based systems built with modern reactive architectures.
- **Mobile Applications**: Native and responsive Android applications engineered with Kotlin, Jetpack Compose, and sub-16ms latency.
- **Game Development**: Distraction-free, mindful games featuring deterministic spatial logic, algorithmic solvability guarantees, and zero telemetry bloat.
- **Custom Software**: Purpose-built desktop tools, developer utilities, automated operational workflows, and robust backend APIs.

## Products & Portfolio
${gamesList || '- Arrow Puzzle: Native Android spatial logic puzzle game.'}

## Primary Resources & Navigation
- Official Portal: ${DOMAIN}
- Services Overview: ${DOMAIN}/services
- Portfolio & Projects: ${DOMAIN}/portfolio
- Games Catalog: ${DOMAIN}/games
- About Karsh Tech: ${DOMAIN}/studio
- Contact Us: ${DOMAIN}/contact
- Support & FAQ: ${DOMAIN}/support
- Privacy Policy: ${DOMAIN}/privacy
- Terms of Service: ${DOMAIN}/terms
`;
    res.header('Content-Type', 'text/plain; charset=utf-8');
    res.send(content);
  } catch (err: any) {
    res.status(500).send('Error generating llms.txt');
  }
});

// ==========================================
// AUTHENTICATION ENDPOINTS
// ==========================================

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  try {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const rateCheck = checkLoginRateLimit(ip);
    if (!rateCheck.allowed) {
      res.status(429).json({
        error: `Too many failed login attempts. Please wait ${rateCheck.remainingSeconds} seconds before trying again.`,
      });
      return;
    }

    const { username, password } = req.body;
    const cleanUsername = typeof username === 'string' ? username.trim() : '';
    if (!cleanUsername || !password) {
      res.status(400).json({ error: 'Username and password are required' });
      return;
    }

    const user = await db.getUserByUsername(cleanUsername);
    if (!user) {
      recordFailedLogin(ip);
      res.status(401).json({ error: 'Invalid username or password' });
      return;
    }

    const valid = await comparePassword(password, user.password_hash);
    if (!valid) {
      recordFailedLogin(ip);
      res.status(401).json({ error: 'Invalid username or password' });
      return;
    }

    clearLoginAttempts(ip);

    const token = generateToken({
      userId: user.id,
      username: user.username,
      role: user.role,
    });

    setSessionCookie(res, token);

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
      token,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Login error' });
  }
});

// POST /api/auth/logout
app.post('/api/auth/logout', (_req, res) => {
  clearSessionCookie(res);
  res.json({ success: true, message: 'Logged out successfully' });
});

// GET /api/auth/me
app.get('/api/auth/me', requireAdmin, (req, res) => {
  const user = (req as any).user;
  res.json({
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
    },
  });
});

// POST /api/auth/change-password
app.post('/api/auth/change-password', requireAdmin, async (req, res) => {
  try {
    const user = (req as any).user;
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      res.status(400).json({ error: 'Current password and new password are required' });
      return;
    }

    if (new_password.length < 8) {
      res.status(400).json({ error: 'New password must be at least 8 characters long' });
      return;
    }

    const valid = await comparePassword(current_password, user.password_hash);
    if (!valid) {
      res.status(401).json({ error: 'Current password does not match' });
      return;
    }

    const newHash = await hashPassword(new_password);
    await db.updateUserPassword(user.id, newHash);

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Password update failed' });
  }
});

// ==========================================
// PROTECTED ADMIN ENDPOINTS
// ==========================================

// GET /api/admin/stats
app.get('/api/admin/stats', requireAdmin, async (_req, res) => {
  try {
    const [games, releases, products] = await Promise.all([
      db.getGames(),
      db.getReleases(),
      db.getProducts(true),
    ]);
    const totalDownloads = releases.reduce((sum, r) => sum + (r.download_count || 0), 0);

    const recentReleasesRaw = releases.slice(-5).reverse();
    const recent_releases = await Promise.all(
      recentReleasesRaw.map(async (r) => {
        const game = await db.getGameById(r.game_id);
        return {
          ...r,
          game_title: game?.title || 'Unknown Game',
        };
      })
    );

    res.json({
      stats: {
        total_games: games.length,
        published_games: games.filter((g) => g.status === 'Available' || g.status === 'Updated').length,
        total_releases: releases.length,
        total_downloads: totalDownloads,
        total_products: products.length,
        published_products: products.filter((p) => p.status === 'Published').length,
        draft_products: products.filter((p) => p.status === 'Draft').length,
      },
      recent_releases,
      recent_products: products.slice(0, 5),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/games
app.get('/api/admin/games', requireAdmin, async (_req, res) => {
  try {
    const games = await db.getGames();
    const populated = await Promise.all(
      games.map(async (g) => {
        const [latest_release, releases] = await Promise.all([
          db.getLatestReleaseByGameId(g.id, false),
          db.getReleasesByGameId(g.id),
        ]);
        return {
          ...g,
          latest_release,
          releases_count: releases.length,
        };
      })
    );
    res.json({ games: populated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/games
app.post('/api/admin/games', requireAdmin, async (req, res) => {
  try {
    const {
      title,
      slug,
      tagline,
      description,
      genre,
      platforms,
      status,
      featured,
      cover_image,
      banner_image,
      screenshots,
      trailer_url,
      features,
      controls,
      requirements,
      developer,
    } = req.body;

    if (!title || !description) {
      res.status(400).json({ error: 'Title and description are required.' });
      return;
    }

    const finalSlug = (slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')) || `game-${Date.now()}`;

    // Check slug collision
    const existing = await db.getGameBySlug(finalSlug);
    if (existing) {
      res.status(400).json({ error: `Game with slug "${finalSlug}" already exists.` });
      return;
    }

    const created = await db.createGame({
      title,
      slug: finalSlug,
      tagline: tagline || '',
      description,
      genre: Array.isArray(genre) ? genre : ['Indie'],
      platforms: Array.isArray(platforms) ? platforms : ['Android'],
      status: status || 'Available',
      featured: Boolean(featured),
      cover_image: cover_image || '/uploads/images/default_cover.jpg',
      banner_image: banner_image || undefined,
      screenshots: Array.isArray(screenshots) ? screenshots : [],
      trailer_url: trailer_url || undefined,
      features: Array.isArray(features) ? features : [],
      controls: Array.isArray(controls) ? controls : [],
      requirements: requirements || {},
      developer: developer || 'Karsh Tech',
    });

    res.status(201).json({ success: true, game: created });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/games/:id
app.put('/api/admin/games/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body || {};

    // Collect any game media assets being updated/referenced
    const assetsToLock: Array<{ bucket: string; path: string }> = [];
    if (body.cover_image && typeof body.cover_image === 'string') {
      assetsToLock.push({ bucket: 'game-assets', path: body.cover_image });
    }
    if (body.banner_image && typeof body.banner_image === 'string') {
      assetsToLock.push({ bucket: 'game-assets', path: body.banner_image });
    }
    if (Array.isArray(body.screenshots)) {
      for (const s of body.screenshots) {
        if (typeof s === 'string' && s.trim()) {
          assetsToLock.push({ bucket: 'game-assets', path: s });
        }
      }
    }

    const updated = await assetConcurrency.runExclusiveMany(assetsToLock, async () => {
      // Validate that any introduced storage assets exist in storage
      for (const item of assetsToLock) {
        const clean = item.path.split('?')[0].trim();
        // If placeholder, skip storage verification
        if (clean.startsWith('/uploads/') || clean.startsWith('/brand/')) continue;
        if ((clean.startsWith('http://') || clean.startsWith('https://')) && !clean.includes('/game-assets/')) continue;

        const basename = path.basename(clean);
        const meta = await storageService.getObjectMetadata(item.bucket as StorageBucket, basename);
        if (!meta) {
          const err: any = new Error(`Storage asset "${basename}" does not exist in bucket "${item.bucket}". Cannot reference nonexistent asset.`);
          err.statusCode = 404;
          throw err;
        }
      }

      const resUpdate = await db.updateGame(id, req.body);
      if (!resUpdate) {
        const err: any = new Error('Game not found.');
        err.statusCode = 404;
        throw err;
      }
      return resUpdate;
    });

    res.json({ success: true, game: updated });
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

// DELETE /api/admin/games/:id
app.delete('/api/admin/games/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await db.deleteGame(id);
    if (!deleted) {
      res.status(404).json({ error: 'Game not found.' });
      return;
    }
    res.json({ success: true, message: 'Game and associated releases deleted.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// ADMIN PRODUCTS ENDPOINTS
// ==========================================

// GET /api/admin/products
app.get('/api/admin/products', requireAdmin, async (_req, res) => {
  try {
    const products = await db.getProducts(true);
    res.json({ products });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch admin products' });
  }
});

// GET /api/admin/products/:id
app.get('/api/admin/products/:id', requireAdmin, async (req, res) => {
  try {
    const product = await db.getProductById(req.params.id);
    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    res.json({ product });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch product' });
  }
});

// POST /api/admin/products
app.post('/api/admin/products', requireAdmin, async (req, res) => {
  try {
    const {
      name,
      slug,
      short_description,
      description,
      category,
      cover_image,
      gallery,
      technologies,
      project_url,
      github_url,
      play_store_url,
      apk_download_url,
      platform,
      status,
      featured,
      display_order,
    } = req.body;

    if (!name || !description || !category) {
      res.status(400).json({ error: 'Name, description, and category are required' });
      return;
    }

    const generatedSlug = slug
      ? slug.toLowerCase().trim().replace(/[^a-z0-9_-]/g, '-')
      : name.toLowerCase().trim().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-');

    const existing = await db.getProductBySlug(generatedSlug, true);
    if (existing) {
      res.status(400).json({ error: `A product with slug "${generatedSlug}" already exists` });
      return;
    }

    const newProduct = await db.createProduct({
      name: name.trim(),
      slug: generatedSlug,
      short_description: short_description ? short_description.trim() : '',
      description: description.trim(),
      category,
      cover_image: cover_image || '/brand/karsh-tech-k.png',
      gallery: Array.isArray(gallery) ? gallery : [],
      technologies: Array.isArray(technologies) ? technologies : [],
      project_url: project_url ? project_url.trim() : undefined,
      github_url: github_url ? github_url.trim() : undefined,
      play_store_url: play_store_url ? play_store_url.trim() : undefined,
      apk_download_url: apk_download_url ? apk_download_url.trim() : undefined,
      platform: platform || 'Web',
      status: status || 'Draft',
      featured: Boolean(featured),
      display_order: Number(display_order) || 0,
    });

    res.status(201).json({ success: true, product: newProduct });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to create product' });
  }
});

// PUT /api/admin/products/:id
app.put('/api/admin/products/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await db.getProductById(id);
    if (!existing) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    const updates = { ...req.body };
    if (updates.slug && updates.slug !== existing.slug) {
      const slugCheck = await db.getProductBySlug(updates.slug, true);
      if (slugCheck && slugCheck.id !== id) {
        res.status(400).json({ error: `A product with slug "${updates.slug}" already exists` });
        return;
      }
    }

    // Collect any product media assets being updated/referenced
    const assetsToLock: Array<{ bucket: string; path: string }> = [];
    if (updates.cover_image && typeof updates.cover_image === 'string') {
      assetsToLock.push({ bucket: 'product-assets', path: updates.cover_image });
    }
    if (Array.isArray(updates.gallery)) {
      for (const img of updates.gallery) {
        if (typeof img === 'string' && img.trim()) {
          assetsToLock.push({ bucket: 'product-assets', path: img });
        }
      }
    }

    const updated = await assetConcurrency.runExclusiveMany(assetsToLock, async () => {
      // Validate that any introduced storage assets exist in storage
      for (const item of assetsToLock) {
        const clean = item.path.split('?')[0].trim();
        if (clean.startsWith('/uploads/') || clean.startsWith('/brand/')) continue;
        if ((clean.startsWith('http://') || clean.startsWith('https://')) && !clean.includes('/product-assets/')) continue;

        const basename = path.basename(clean);
        const meta = await storageService.getObjectMetadata(item.bucket as StorageBucket, basename);
        if (!meta) {
          const err: any = new Error(`Storage asset "${basename}" does not exist in bucket "${item.bucket}". Cannot reference nonexistent asset.`);
          err.statusCode = 404;
          throw err;
        }
      }

      return await db.updateProduct(id, updates);
    });

    res.json({ success: true, product: updated });
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ error: err.message || 'Failed to update product' });
  }
});

// DELETE /api/admin/products/:id
app.delete('/api/admin/products/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const success = await db.deleteProduct(id);
    if (!success) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    res.json({ success: true, message: 'Product deleted successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to delete product' });
  }
});

// PATCH /api/admin/products/:id/status
app.patch('/api/admin/products/:id/status', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (status !== 'Draft' && status !== 'Published') {
      res.status(400).json({ error: 'Status must be Draft or Published' });
      return;
    }
    const updated = await db.updateProduct(id, { status });
    if (!updated) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    res.json({ success: true, product: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update product status' });
  }
});

// PATCH /api/admin/products/:id/featured
app.patch('/api/admin/products/:id/featured', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { featured } = req.body;
    const updated = await db.updateProduct(id, { featured: Boolean(featured) });
    if (!updated) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    res.json({ success: true, product: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update product featured status' });
  }
});

// GET /api/admin/releases
app.get('/api/admin/releases', requireAdmin, async (_req, res) => {
  try {
    const releases = await db.getReleases();
    const enriched = await Promise.all(
      releases.map(async (r) => {
        const game = (await db.getGameById(r.game_id)) || (await db.getGameBySlug(r.game_id));
        return {
          ...r,
          game_title: game?.title || 'Unknown Game',
          game_slug: game?.slug || '',
        };
      })
    );
    res.json({ releases: enriched });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/releases
app.post('/api/admin/releases', requireAdmin, async (req, res) => {
  try {
    const {
      game_id,
      version_name,
      version_code,
      release_date,
      release_notes,
      apk_filename,
      original_filename,
      apk_file_size,
      min_sdk,
      target_sdk,
      is_published,
    } = req.body;

    const rawGameId = game_id || req.body.gameId;

    if (!rawGameId || !version_name || !apk_filename) {
      res.status(400).json({ error: 'Game, version name, and APK file are required.' });
      return;
    }

    const game = (await db.getGameById(rawGameId)) || (await db.getGameBySlug(rawGameId));
    if (!game) {
      res.status(404).json({ error: 'Associated game does not exist in Game Catalog.' });
      return;
    }

    const sanitizedOriginal = sanitizeOriginalFilename(
      original_filename || req.body.original_name || req.body.originalFilename,
      apk_filename
    );

    const created = await db.createRelease({
      game_id: game.id,
      version_name,
      version_code: Number(version_code) || 1,
      release_date: release_date || new Date().toISOString().split('T')[0],
      release_notes: release_notes || 'General performance updates and optimizations.',
      apk_filename,
      original_filename: sanitizedOriginal,
      apk_file_size: Number(apk_file_size) || 0,
      apk_download_url: '',
      min_sdk: Number(min_sdk) || 26,
      target_sdk: Number(target_sdk) || 35,
      is_published: Boolean(is_published ?? true),
    });

    // Set download URL
    const updated = await db.updateRelease(created.id, {
      apk_download_url: `/api/releases/${created.id}/download`,
    });

    res.status(201).json({ success: true, release: updated || created });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/releases/:id
app.put('/api/admin/releases/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await db.getReleaseById(id);
    if (!existing) {
      res.status(404).json({ error: 'Release not found' });
      return;
    }

    const updates = { ...req.body };
    const rawGameId = updates.game_id || updates.gameId;
    if (rawGameId) {
      const game = (await db.getGameById(rawGameId)) || (await db.getGameBySlug(rawGameId));
      if (!game) {
        res.status(404).json({ error: 'Associated game does not exist.' });
        return;
      }
      updates.game_id = game.id;
      delete updates.gameId;
    }

    if (updates.original_filename) {
      updates.original_filename = sanitizeOriginalFilename(updates.original_filename, existing.apk_filename);
    } else if (updates.apk_filename && !existing.original_filename) {
      updates.original_filename = sanitizeOriginalFilename(updates.apk_filename);
    }
    const updated = await db.updateRelease(id, updates);
    res.json({ success: true, release: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/releases/:id
app.delete('/api/admin/releases/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await db.deleteRelease(id);
    if (!deleted) {
      res.status(404).json({ error: 'Release not found' });
      return;
    }
    res.json({ success: true, message: 'Release deleted.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/upload/image
app.post('/api/admin/upload/image', requireAdmin, handleImageUpload, async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      res.status(400).json({ error: 'No image file uploaded' });
      return;
    }

    // Validate magic bytes and mime type
    const validation = validateImageBuffer(req.file.buffer, req.file.originalname, req.file.mimetype);
    if (!validation.valid) {
      res.status(400).json({ error: validation.error || 'Invalid image file content' });
      return;
    }

    // Determine target bucket
    const requestedBucket = req.body?.bucket || req.query?.bucket;
    const bucket: StorageBucket =
      requestedBucket === 'product-assets' || req.body?.category === 'product'
        ? 'product-assets'
        : 'game-assets';

    // Generate collision-resistant unique path
    const objectPath = generateObjectPath('', req.file.originalname);

    // Upload to Supabase Storage
    const result = await storageService.upload({
      bucket,
      path: objectPath,
      buffer: req.file.buffer,
      contentType: validation.contentType || req.file.mimetype,
      preventOverwrite: true,
    });

    res.json({
      success: true,
      filename: result.path,
      url: result.url,
      size: result.size,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Image upload failed' });
  }
});

// POST /api/admin/upload/apk
app.post('/api/admin/upload/apk', requireAdmin, handleApkUpload, async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      res.status(400).json({ error: 'No APK file uploaded' });
      return;
    }

    // Validate magic bytes (PK\x03\x04 + AndroidManifest.xml)
    const validation = validateApkBuffer(req.file.buffer, req.file.originalname, req.file.mimetype);
    if (!validation.valid) {
      res.status(400).json({ error: validation.error || 'Invalid APK file content' });
      return;
    }

    const sanitizedOriginal = sanitizeOriginalFilename(req.file.originalname);
    const objectPath = generateObjectPath('', sanitizedOriginal);

    // Upload to private release-apks bucket
    const result = await storageService.upload({
      bucket: 'release-apks',
      path: objectPath,
      buffer: req.file.buffer,
      contentType: validation.contentType || 'application/vnd.android.package-archive',
      preventOverwrite: true,
    });

    res.json({
      success: true,
      filename: result.path,
      stored_filename: result.path,
      original_filename: sanitizedOriginal,
      original_name: sanitizedOriginal,
      size: result.size,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'APK upload failed' });
  }
});

// GET /api/admin/settings
app.get('/api/admin/settings', requireAdmin, async (_req, res) => {
  try {
    const settings = await db.getSettings();
    res.json({ settings });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/settings
app.put('/api/admin/settings', requireAdmin, async (req, res) => {
  try {
    const updated = await db.updateSettings(req.body);
    res.json({ success: true, settings: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/system/storage
app.get('/api/admin/system/storage', requireAdmin, async (_req, res) => {
  try {
    const storageInfo = await db.getStorageInfo();
    res.json({
      success: true,
      storage: {
        ...storageInfo,
        uploadsDir: UPLOADS_DIR,
        imagesDir: IMAGES_DIR,
        apksDir: APKS_DIR,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// MEDIA & ASSET MANAGER ENDPOINTS (PHASE 4.3.6)
// ==========================================

export interface MediaReference {
  type: 'game' | 'product' | 'release';
  id: string;
  title: string;
  field: string;
}

export function findAssetReferences(
  bucket: StorageBucket,
  objectPath: string,
  objectName: string,
  publicUrl: string | null,
  games: any[],
  products: any[],
  releases: any[]
): MediaReference[] {
  const references: MediaReference[] = [];
  const cleanPath = objectPath.replace(/^\/+/, '');
  const basename = objectName || path.basename(cleanPath);

  // Check Release references (APK files)
  if (bucket === 'release-apks') {
    for (const r of releases) {
      const relApk = r.apk_filename ? String(r.apk_filename).replace(/^\/+/, '') : '';
      const relBase = path.basename(relApk);
      if (relApk === cleanPath || relBase === basename) {
        references.push({
          type: 'release',
          id: r.id,
          title: `${r.version_name || 'Release'} (${r.id})`,
          field: 'apk_filename',
        });
      }
    }
  }

  // Helper to match URL, path, or basename
  const isMatch = (targetUrlOrPath: string | undefined | null): boolean => {
    if (!targetUrlOrPath || typeof targetUrlOrPath !== 'string') return false;
    const cleanTarget = targetUrlOrPath.trim();
    if (!cleanTarget) return false;

    // Exact string match
    if (cleanTarget === cleanPath || cleanTarget === basename) return true;

    // Canonical public URL match
    if (publicUrl && cleanTarget === publicUrl) return true;

    // Basename match
    const targetBase = path.basename(cleanTarget.split('?')[0]);
    if (targetBase === basename) return true;

    // Suffix or URL path segment match
    if (cleanTarget.endsWith('/' + cleanPath) || cleanTarget.includes('/' + bucket + '/' + cleanPath)) {
      return true;
    }

    return false;
  };

  // Inspect Games
  for (const g of games) {
    if (isMatch(g.cover_image)) {
      references.push({ type: 'game', id: g.id, title: g.title, field: 'cover_image' });
    }
    if (isMatch(g.banner_image)) {
      references.push({ type: 'game', id: g.id, title: g.title, field: 'banner_image' });
    }
    if (Array.isArray(g.screenshots)) {
      for (const s of g.screenshots) {
        if (isMatch(s)) {
          references.push({ type: 'game', id: g.id, title: g.title, field: 'screenshots' });
          break; // Avoid duplicate references for the same game
        }
      }
    }
  }

  // Inspect Products
  for (const p of products) {
    if (isMatch(p.cover_image)) {
      references.push({ type: 'product', id: p.id, title: p.name || p.title, field: 'cover_image' });
    }
    if (Array.isArray(p.gallery)) {
      for (const img of p.gallery) {
        if (isMatch(img)) {
          references.push({ type: 'product', id: p.id, title: p.name || p.title, field: 'gallery' });
          break; // Avoid duplicate references for the same product
        }
      }
    }
  }

  return references;
}

// ==========================================
// MEDIA & ASSET MANAGER CONCURRENCY & VALIDATION
// ==========================================

export class AssetConcurrencyManager {
  private queues = new Map<string, Promise<void>>();

  public makeKey(bucket: string, objectPath: string): string {
    if (!objectPath || typeof objectPath !== 'string') return '';
    let clean = objectPath.split('?')[0].split('#')[0].trim().replace(/^\/+/, '');
    try {
      clean = decodeURIComponent(clean);
    } catch {}
    const basename = path.basename(clean);
    return `${(bucket || '').toLowerCase().trim()}::${basename}`;
  }

  async runExclusive<T>(bucket: string, objectPath: string, fn: () => Promise<T>): Promise<T> {
    return this.runExclusiveMany([{ bucket, path: objectPath }], fn);
  }

  async runExclusiveMany<T>(
    items: Array<{ bucket: string; path: string }>,
    fn: () => Promise<T>
  ): Promise<T> {
    if (!items || items.length === 0) {
      return await fn();
    }

    // Deduplicate and deterministically sort keys to prevent deadlocks (ABBA)
    const uniqueKeys = Array.from(
      new Set(items.map((i) => this.makeKey(i.bucket, i.path)).filter((k) => Boolean(k) && !k.endsWith('::')))
    ).sort();

    if (uniqueKeys.length === 0) {
      return await fn();
    }

    // Chained FIFO promise for each key
    const releases: Array<() => void> = [];
    const acquiredNextPromises: Array<{ key: string; promise: Promise<void> }> = [];
    const prevPromises: Array<Promise<void>> = [];

    for (const key of uniqueKeys) {
      const prev = this.queues.get(key) || Promise.resolve();
      prevPromises.push(prev);

      let release: () => void;
      const next = new Promise<void>((resolve) => {
        release = resolve;
      });
      releases.push(release!);
      acquiredNextPromises.push({ key, promise: next });
      this.queues.set(key, next);
    }

    // Wait for all previous operations on all keys to complete
    await Promise.all(prevPromises);

    try {
      return await fn();
    } finally {
      // Release all locks
      for (const rel of releases) {
        rel();
      }
      // Clean up map entries for keys where no subsequent request is waiting
      for (const item of acquiredNextPromises) {
        if (this.queues.get(item.key) === item.promise) {
          this.queues.delete(item.key);
        }
      }
    }
  }
}

export const assetConcurrency = new AssetConcurrencyManager();

export async function validateAttachmentTarget(
  rawUrlOrPath: string,
  targetType: 'game' | 'product',
  storage: typeof storageService
): Promise<{
  valid: boolean;
  status: number;
  error?: string;
  bucket?: StorageBucket;
  objectPath?: string;
  canonicalUrl?: string;
}> {
  if (!rawUrlOrPath || typeof rawUrlOrPath !== 'string' || !rawUrlOrPath.trim()) {
    return { valid: false, status: 400, error: 'Attachment URL or path is required.' };
  }

  const raw = rawUrlOrPath.trim();
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {}

  // 1. Path traversal & null byte defense
  if (
    raw.includes('..') ||
    raw.includes('\0') ||
    decoded.includes('..') ||
    decoded.includes('\0') ||
    /%2e%2e|%2f|%5c|%00/i.test(raw)
  ) {
    return { valid: false, status: 400, error: 'Malformed or path traversal sequence detected in attachment path.' };
  }

  // 2. Private APK & binary restriction
  if (raw.toLowerCase().endsWith('.apk') || raw.includes('release-apks')) {
    return { valid: false, status: 400, error: 'Android APK binaries and private assets cannot be attached as screenshots or gallery images.' };
  }

  // 3. Allowed file extensions
  const ALLOWED_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);
  const cleanForExt = raw.split('?')[0].split('#')[0];
  const ext = path.extname(cleanForExt).toLowerCase();
  if (!ALLOWED_EXTS.has(ext)) {
    return { valid: false, status: 400, error: `Invalid image extension "${ext}". Allowed: PNG, JPG, JPEG, WEBP, GIF.` };
  }

  // 4. Resolve target bucket and objectPath
  let bucket: StorageBucket = targetType === 'game' ? 'game-assets' : 'product-assets';
  let objectPath = '';

  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(raw);
    } catch {
      return { valid: false, status: 400, error: 'Invalid URL format.' };
    }

    const pathname = parsedUrl.pathname;
    const match = pathname.match(/\/(game-assets|product-assets)\/(.+)$/);
    if (!match) {
      return {
        valid: false,
        status: 400,
        error: 'External URLs are not permitted. Only assets hosted on Karsh Tech storage may be attached.',
      };
    }
    bucket = match[1] as StorageBucket;
    objectPath = match[2];
  } else {
    const cleanRelative = raw.replace(/^\/+/, '');
    if (cleanRelative.startsWith('game-assets/')) {
      bucket = 'game-assets';
      objectPath = cleanRelative.replace(/^game-assets\//, '');
    } else if (cleanRelative.startsWith('product-assets/')) {
      bucket = 'product-assets';
      objectPath = cleanRelative.replace(/^product-assets\//, '');
    } else {
      objectPath = cleanRelative;
    }
  }

  objectPath = objectPath.replace(/^\/+/, '');
  if (!objectPath) {
    return { valid: false, status: 400, error: 'Storage object path cannot be empty.' };
  }

  // 5. Verify the object actually exists in storage before attaching
  const meta = await storage.getObjectMetadata(bucket, objectPath);
  if (!meta) {
    return {
      valid: false,
      status: 404,
      error: `Storage object "${objectPath}" does not exist in storage bucket "${bucket}". Cannot attach nonexistent asset.`,
    };
  }

  // 6. Canonical public URL
  const canonicalUrl = storage.getPublicUrl(bucket, objectPath);

  return {
    valid: true,
    status: 200,
    bucket,
    objectPath,
    canonicalUrl,
  };
}

// GET /api/admin/media - List media assets across storage buckets
app.get('/api/admin/media', requireAdmin, async (req, res) => {
  try {
    const bucketParam = (req.query.bucket as string) || 'all';
    const typeParam = (req.query.type as string) || 'all';
    const searchParam = ((req.query.search as string) || '').toLowerCase().trim();
    const associationParam = (req.query.association as string) || 'all';
    const sortParam = (req.query.sort as string) || 'date_desc';

    // Determine target buckets
    let targetBuckets: StorageBucket[] = ['game-assets', 'product-assets', 'release-apks'];
    if (bucketParam !== 'all') {
      if (!['game-assets', 'product-assets', 'release-apks'].includes(bucketParam)) {
        res.status(400).json({ error: `Invalid bucket "${bucketParam}". Must be one of: game-assets, product-assets, release-apks` });
        return;
      }
      targetBuckets = [bucketParam as StorageBucket];
    } else if (typeParam === 'image') {
      targetBuckets = ['game-assets', 'product-assets'];
    } else if (typeParam === 'apk') {
      targetBuckets = ['release-apks'];
    }

    // List storage objects (fail closed on storage failure, do not swallow errors)
    const [listResults, games, products, releases] = await Promise.all([
      Promise.all(
        targetBuckets.map(async (bucket) => {
          const objects = await storageService.listObjects(bucket);
          return { bucket, objects };
        })
      ),
      db.getGames(),
      db.getProducts(true),
      db.getReleases(),
    ]);

    const allAssets: any[] = [];

    for (const { bucket, objects } of listResults) {
      const visibility = storageService.getBucketVisibility(bucket);
      for (const obj of objects) {
        const objectPath = obj.name;
        const basename = path.basename(objectPath);
        const isProtected = PROTECTED_STORAGE_OBJECTS.has(basename);

        let url: string | null = null;
        if (bucket !== 'release-apks') {
          try {
            url = storageService.getPublicUrl(bucket, objectPath);
          } catch {}
        }

        const refs = findAssetReferences(bucket, objectPath, basename, url, games, products, releases);

        allAssets.push({
          id: obj.id || `${bucket}::${objectPath}`,
          name: basename,
          path: objectPath,
          bucket,
          size: obj.size,
          contentType:
            obj.contentType ||
            (bucket === 'release-apks' ? 'application/vnd.android.package-archive' : 'image/jpeg'),
          createdAt: obj.createdAt || new Date().toISOString(),
          updatedAt: obj.updatedAt || new Date().toISOString(),
          url, // strictly null for private release-apks
          visibility,
          is_referenced: refs.length > 0,
          is_protected: isProtected,
          referenced_by: refs,
        });
      }
    }

    // Apply search filter
    let filtered = allAssets;
    if (searchParam) {
      filtered = filtered.filter(
        (a) =>
          a.name.toLowerCase().includes(searchParam) ||
          a.path.toLowerCase().includes(searchParam)
      );
    }

    // Apply association filter
    if (associationParam === 'associated') {
      filtered = filtered.filter((a) => a.is_referenced);
    } else if (associationParam === 'unassociated') {
      filtered = filtered.filter((a) => !a.is_referenced);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      if (sortParam === 'name_asc') return a.name.localeCompare(b.name);
      if (sortParam === 'name_desc') return b.name.localeCompare(a.name);
      if (sortParam === 'size_asc') return a.size - b.size;
      if (sortParam === 'size_desc') return b.size - a.size;
      if (sortParam === 'date_asc') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    res.json({
      success: true,
      count: filtered.length,
      assets: filtered,
    });
  } catch (err: any) {
    res.status(502).json({ error: err.message || 'Failed to list media assets' });
  }
});

// GET /api/admin/media/stats - Summary metrics and bucket health
app.get('/api/admin/media/stats', requireAdmin, async (_req, res) => {
  try {
    const buckets: StorageBucket[] = ['game-assets', 'product-assets', 'release-apks'];
    const bucketStats: Record<string, { count: number; bytes: number; visibility: string }> = {};

    let totalAssets = 0;
    let totalBytes = 0;
    let imageAssets = 0;
    let gameImages = 0;
    let productImages = 0;
    let apkReleases = 0;

    await Promise.all(
      buckets.map(async (bucket) => {
        const visibility = storageService.getBucketVisibility(bucket);
        const objects = await storageService.listObjects(bucket);
        const count = objects.length;
        const bytes = objects.reduce((sum, o) => sum + (o.size || 0), 0);

        bucketStats[bucket] = { count, bytes, visibility };
        totalAssets += count;
        totalBytes += bytes;

        if (bucket === 'game-assets') {
          gameImages += count;
          imageAssets += count;
        } else if (bucket === 'product-assets') {
          productImages += count;
          imageAssets += count;
        } else if (bucket === 'release-apks') {
          apkReleases += count;
        }
      })
    );

    res.json({
      success: true,
      stats: {
        total_assets: totalAssets,
        image_assets: imageAssets,
        game_images: gameImages,
        product_images: productImages,
        apk_releases: apkReleases,
        total_storage_bytes: totalBytes,
        storage_by_bucket: bucketStats,
      },
    });
  } catch (err: any) {
    res.status(502).json({ error: err.message || 'Failed to get media stats' });
  }
});

// DELETE /api/admin/media - Reference-aware storage deletion with strict protection for canonical assets & releases
app.delete('/api/admin/media', requireAdmin, async (req, res) => {
  try {
    const bucket = (req.body.bucket || req.query.bucket) as StorageBucket;
    const rawPath = String(
      req.body.path || req.body.name || req.body.filename ||
      req.query.path || req.query.name || req.query.filename || ''
    ).trim();

    if (!bucket || !rawPath) {
      res.status(400).json({ error: 'Bucket and path are required for media deletion.' });
      return;
    }

    const validBuckets: StorageBucket[] = ['game-assets', 'product-assets', 'release-apks'];
    if (!validBuckets.includes(bucket)) {
      res.status(400).json({ error: `Invalid bucket "${bucket}". Must be one of: ${validBuckets.join(', ')}` });
      return;
    }

    // Path traversal & encoded separator defense
    let decodedPath = rawPath;
    try {
      decodedPath = decodeURIComponent(rawPath);
    } catch {}

    if (
      rawPath.includes('..') ||
      rawPath.includes('\0') ||
      decodedPath.includes('..') ||
      decodedPath.includes('\0') ||
      /%2e%2e|%2f|%5c|%00/i.test(rawPath)
    ) {
      res.status(400).json({ error: 'Invalid object path: Path traversal detected.' });
      return;
    }

    const cleanPath = rawPath.replace(/^\/+/, '');
    const basename = path.basename(cleanPath);

    // Concurrency Lock: serialize operations on this asset to prevent race conditions
    return await assetConcurrency.runExclusive(bucket, cleanPath, async () => {
      // 1. Check Protected Storage Objects
      if (PROTECTED_STORAGE_OBJECTS.has(basename)) {
        res.status(403).json({
          error: `Cannot delete protected production asset "${basename}". Deletion is permanently restricted.`,
        });
        return;
      }

      // 2. Fetch database records inside lock (fail closed on DB error)
      let games: any[] = [];
      let products: any[] = [];
      let releases: any[] = [];

      try {
        [games, products, releases] = await Promise.all([
          db.getGames(),
          db.getProducts(true),
          db.getReleases(),
        ]);
      } catch (dbErr: any) {
        res.status(500).json({
          error: `Database error while checking asset references: ${dbErr.message}. Deletion aborted for safety.`,
        });
        return;
      }

      let publicUrl: string | null = null;
      if (bucket !== 'release-apks') {
        try {
          publicUrl = storageService.getPublicUrl(bucket, cleanPath);
        } catch {}
      }

      const refs = findAssetReferences(bucket, cleanPath, basename, publicUrl, games, products, releases);
      if (refs.length > 0) {
        const refDescriptions = refs.map((r) => `${r.type} "${r.title}" (${r.field})`).join(', ');
        res.status(409).json({
          error: `Asset is actively referenced and cannot be deleted. Referencing entities: ${refDescriptions}. Detach or reassign references before deleting.`,
          referenced_by: refs,
        });
        return;
      }

      // 3. Delete from storage
      const deleted = await storageService.deleteObject(bucket, cleanPath);
      if (!deleted) {
        res.status(404).json({
          error: `Failed to delete asset "${cleanPath}" from bucket "${bucket}". Storage provider did not confirm deletion or object was not found.`,
        });
        return;
      }

      res.json({
        success: true,
        message: `Asset "${cleanPath}" deleted successfully from "${bucket}".`,
      });
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Media deletion failed' });
  }
});

// ==========================================
// GAME SCREENSHOT MANAGEMENT (PHASE 4.3.6)
// ==========================================

// POST /api/admin/games/:id/screenshots - Attach screenshot to game
app.post('/api/admin/games/:id/screenshots', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const rawUrl = req.body.url || req.body.path;

    const validation = await validateAttachmentTarget(rawUrl, 'game', storageService);
    if (!validation.valid) {
      res.status(validation.status).json({ error: validation.error });
      return;
    }

    const { bucket, objectPath, canonicalUrl } = validation;

    return await assetConcurrency.runExclusive(bucket!, objectPath!, async () => {
      // 1. Verify existence in storage inside lock
      const meta = await storageService.getObjectMetadata(bucket!, objectPath!);
      if (!meta) {
        res.status(404).json({
          error: `Storage object "${objectPath}" was not found in bucket "${bucket}". Cannot attach nonexistent asset.`,
        });
        return;
      }

      // 2. Fetch game
      const game = await db.getGameById(id);
      if (!game) {
        res.status(404).json({ error: 'Game not found.' });
        return;
      }

      // 3. Prevent duplicate attachment
      const currentScreenshots = Array.isArray(game.screenshots) ? [...game.screenshots] : [];
      const isDuplicate = currentScreenshots.some(
        (s) => s === canonicalUrl || path.basename(s.split('?')[0]) === path.basename(objectPath!)
      );
      if (isDuplicate) {
        res.status(409).json({ error: `Screenshot "${path.basename(objectPath!)}" is already attached to this game.` });
        return;
      }

      currentScreenshots.push(canonicalUrl!);
      const updated = await db.updateGame(id, { screenshots: currentScreenshots });
      res.json({ success: true, screenshots: currentScreenshots, game: updated });
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to attach screenshot' });
  }
});

// DELETE /api/admin/games/:id/screenshots - Detach screenshot from game (storage object retained)
app.delete('/api/admin/games/:id/screenshots', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const rawUrl = req.body.url || (req.query.url as string);
    if (!rawUrl || typeof rawUrl !== 'string' || !rawUrl.trim()) {
      res.status(400).json({ error: 'Screenshot URL or path to detach is required.' });
      return;
    }

    const target = rawUrl.trim();
    const targetBase = path.basename(target.split('?')[0]);

    return await assetConcurrency.runExclusive('game-assets', targetBase, async () => {
      const game = await db.getGameById(id);
      if (!game) {
        res.status(404).json({ error: 'Game not found.' });
        return;
      }

      const currentScreenshots = Array.isArray(game.screenshots) ? game.screenshots : [];

      // Filter out target (exact match or basename match)
      const newScreenshots = currentScreenshots.filter((s) => {
        if (s === target) return false;
        if (path.basename(s.split('?')[0]) === targetBase) return false;
        return true;
      });

      const updated = await db.updateGame(id, { screenshots: newScreenshots });
      res.json({
        success: true,
        message: 'Screenshot detached from game (storage object retained).',
        screenshots: newScreenshots,
        game: updated,
      });
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to detach screenshot' });
  }
});

// PUT /api/admin/games/:id/screenshots - Reorder game screenshots
app.put('/api/admin/games/:id/screenshots', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { screenshots } = req.body;
    if (!Array.isArray(screenshots)) {
      res.status(400).json({ error: 'Screenshots must be an array of strings.' });
      return;
    }

    // Traversal & null byte defense on array elements
    for (const s of screenshots) {
      if (typeof s !== 'string' || s.includes('..') || s.includes('\0') || /%2e%2e|%2f|%5c|%00/i.test(s)) {
        res.status(400).json({ error: 'Screenshots array contains invalid or malformed path values.' });
        return;
      }
    }

    // Deduplication check
    const uniqueSet = new Set(screenshots);
    if (uniqueSet.size !== screenshots.length) {
      res.status(400).json({ error: 'Screenshots array cannot contain duplicate entries.' });
      return;
    }

    const game = await db.getGameById(id);
    if (!game) {
      res.status(404).json({ error: 'Game not found.' });
      return;
    }

    const sanitizedScreenshots = screenshots.filter((s) => typeof s === 'string' && s.trim().length > 0);
    const lockItems = sanitizedScreenshots.map((s) => ({ bucket: 'game-assets', path: s }));

    return await assetConcurrency.runExclusiveMany(lockItems, async () => {
      const updated = await db.updateGame(id, { screenshots: sanitizedScreenshots });
      res.json({ success: true, screenshots: sanitizedScreenshots, game: updated });
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to reorder screenshots' });
  }
});

// ==========================================
// PRODUCT GALLERY MANAGEMENT (PHASE 4.3.6)
// ==========================================

// POST /api/admin/products/:id/gallery - Attach image to product gallery
app.post('/api/admin/products/:id/gallery', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const rawUrl = req.body.url || req.body.path;

    const validation = await validateAttachmentTarget(rawUrl, 'product', storageService);
    if (!validation.valid) {
      res.status(validation.status).json({ error: validation.error });
      return;
    }

    const { bucket, objectPath, canonicalUrl } = validation;

    return await assetConcurrency.runExclusive(bucket!, objectPath!, async () => {
      // 1. Verify existence in storage inside lock
      const meta = await storageService.getObjectMetadata(bucket!, objectPath!);
      if (!meta) {
        res.status(404).json({
          error: `Storage object "${objectPath}" was not found in bucket "${bucket}". Cannot attach nonexistent asset.`,
        });
        return;
      }

      // 2. Fetch product
      const product = await db.getProductById(id);
      if (!product) {
        res.status(404).json({ error: 'Product not found.' });
        return;
      }

      // 3. Prevent duplicate attachment
      const currentGallery = Array.isArray(product.gallery) ? [...product.gallery] : [];
      const isDuplicate = currentGallery.some(
        (img) => img === canonicalUrl || path.basename(img.split('?')[0]) === path.basename(objectPath!)
      );
      if (isDuplicate) {
        res.status(409).json({ error: `Image "${path.basename(objectPath!)}" is already attached to this product gallery.` });
        return;
      }

      currentGallery.push(canonicalUrl!);
      const updated = await db.updateProduct(id, { gallery: currentGallery });
      res.json({ success: true, gallery: currentGallery, product: updated });
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to attach gallery image' });
  }
});

// DELETE /api/admin/products/:id/gallery - Detach image from product gallery (storage object retained)
app.delete('/api/admin/products/:id/gallery', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const rawUrl = req.body.url || (req.query.url as string);
    if (!rawUrl || typeof rawUrl !== 'string' || !rawUrl.trim()) {
      res.status(400).json({ error: 'Gallery image URL or path to detach is required.' });
      return;
    }

    const target = rawUrl.trim();
    const targetBase = path.basename(target.split('?')[0]);

    return await assetConcurrency.runExclusive('product-assets', targetBase, async () => {
      const product = await db.getProductById(id);
      if (!product) {
        res.status(404).json({ error: 'Product not found.' });
        return;
      }

      const currentGallery = Array.isArray(product.gallery) ? product.gallery : [];

      const newGallery = currentGallery.filter((img) => {
        if (img === target) return false;
        if (path.basename(img.split('?')[0]) === targetBase) return false;
        return true;
      });

      const updated = await db.updateProduct(id, { gallery: newGallery });
      res.json({
        success: true,
        message: 'Image detached from product gallery (storage object retained).',
        gallery: newGallery,
        product: updated,
      });
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to detach gallery image' });
  }
});

// PUT /api/admin/products/:id/gallery - Reorder product gallery
app.put('/api/admin/products/:id/gallery', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { gallery } = req.body;
    if (!Array.isArray(gallery)) {
      res.status(400).json({ error: 'Gallery must be an array of strings.' });
      return;
    }

    // Traversal & null byte defense on array elements
    for (const img of gallery) {
      if (typeof img !== 'string' || img.includes('..') || img.includes('\0') || /%2e%2e|%2f|%5c|%00/i.test(img)) {
        res.status(400).json({ error: 'Gallery array contains invalid or malformed path values.' });
        return;
      }
    }

    // Deduplication check
    const uniqueSet = new Set(gallery);
    if (uniqueSet.size !== gallery.length) {
      res.status(400).json({ error: 'Gallery array cannot contain duplicate entries.' });
      return;
    }

    const product = await db.getProductById(id);
    if (!product) {
      res.status(404).json({ error: 'Product not found.' });
      return;
    }

    const sanitizedGallery = gallery.filter((img) => typeof img === 'string' && img.trim().length > 0);
    const lockItems = sanitizedGallery.map((img) => ({ bucket: 'product-assets', path: img }));

    return await assetConcurrency.runExclusiveMany(lockItems, async () => {
      const updated = await db.updateProduct(id, { gallery: sanitizedGallery });
      res.json({ success: true, gallery: sanitizedGallery, product: updated });
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to reorder gallery' });
  }
});

// ==========================================
// CENTRALIZED ERROR HANDLER
// ==========================================
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err.type === 'entity.too.large' || err.status === 413) {
    return res.status(413).json({ error: 'Payload too large. Maximum size is 10MB.' });
  }
  if (err instanceof SyntaxError && 'status' in err && (err as any).status === 400) {
    return res.status(400).json({ error: 'Malformed JSON payload' });
  }
  const status = typeof err.status === 'number' ? err.status : 500;
  res.status(status).json({ error: err.expose ? err.message : 'Internal Server Error' });
});

// ==========================================
// PRODUCTION FRONTEND HANDLER
// ==========================================
const distPath = path.resolve(process.cwd(), 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Start Server
async function startServer() {
  ensureStorageDirectories();
  await db.init();
  await seedDatabase();

  try {
    await storageService.init();
  } catch (err: any) {
    console.warn('[Karsh Tech Server] Storage service initialization warning:', err.message);
  }

  const server = app.listen(PORT, () => {
    console.log(`[Karsh Tech Server] Running securely on http://localhost:${PORT}`);
    console.log(`[Karsh Tech Server] Database provider: ${db.getProviderName()}`);
    console.log(`[Karsh Tech Server] Storage: persistent=${IS_PERSISTENT_STORAGE}, uploads=${UPLOADS_DIR}`);
  });

  const handleShutdown = async (signal: string) => {
    console.log(`[Karsh Tech Server] ${signal} signal received: closing HTTP server and database pool.`);
    server.close(async () => {
      try {
        await db.close();
        console.log('[Karsh Tech Server] Shutdown complete.');
        process.exit(0);
      } catch (err) {
        console.error('[Karsh Tech Server] Error during shutdown:', err);
        process.exit(1);
      }
    });
  };

  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));
}

export { app, storageService, setStorageService };

// Only automatically start HTTP listener when run directly, not when imported in test suites
const isDirectEntry = Boolean(
  process.argv[1] &&
  (process.argv[1].endsWith('index.ts') ||
   process.argv[1].endsWith('index.js') ||
   process.argv[1].endsWith('server.ts') ||
   process.argv[1].endsWith('server.js'))
);

if (isDirectEntry) {
  startServer().catch((err) => {
    console.error('[Karsh Tech Server] Fatal startup failure:', err?.message || err);
    process.exit(1);
  });
}
