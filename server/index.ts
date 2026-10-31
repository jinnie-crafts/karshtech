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

const app = express();
const PORT = process.env.PORT || 3001;

ensureStorageDirectories();

// Allowed origins for CORS and CSRF protection
const ALLOWED_ORIGINS = [
  'https://tech.aadirishi.in',
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
        callback(new Error('CORS policy: Origin not allowed'));
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

// Static file serving for uploads
app.use('/uploads', express.static(UPLOADS_DIR));
if (path.resolve(UPLOADS_DIR) !== path.resolve(DEFAULT_REPO_UPLOADS_DIR) && fs.existsSync(DEFAULT_REPO_UPLOADS_DIR)) {
  app.use('/uploads', express.static(DEFAULT_REPO_UPLOADS_DIR));
}

// Configure Multer for Image Uploads
const imageStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, IMAGES_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeBase = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .substring(0, 30);
    const uniqueName = `${safeBase}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}${ext}`;
    cb(null, uniqueName);
  },
});

const uploadImage = multer({
  storage: imageStorage,
  limits: { fileSize: 12 * 1024 * 1024 }, // 12 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid image file type. Allowed: PNG, JPG, JPEG, WEBP, SVG'));
    }
  },
});


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

// Configure Multer for APK Uploads
const apkStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, APKS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.apk';
    const safeBase = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .substring(0, 40)
      .replace(/^_+|_+$/g, '');
    const prefix = safeBase || 'release';
    const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const uniqueName = `${prefix}_${uniqueSuffix}${ext}`;
    cb(null, uniqueName);
  },
});

const uploadApk = multer({
  storage: apkStorage,
  limits: { fileSize: 150 * 1024 * 1024 }, // 150 MB max APK size
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.apk') {
      cb(null, true);
    } else {
      cb(new Error('Only Android Package files (.apk) are accepted.'));
    }
  },
});

// ==========================================
// PUBLIC API ENDPOINTS
// ==========================================

// GET /api/games - Public catalog
app.get('/api/games', (req, res) => {
  try {
    let games = db.getGames();

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
    const populated = games.map((game) => {
      const latestRelease = db.getLatestReleaseByGameId(game.id, true);
      return {
        ...game,
        latest_release: latestRelease || undefined,
      };
    });

    res.json({ games: populated });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch games' });
  }
});

// GET /api/games/:slug - Detailed game info
app.get('/api/games/:slug', (req, res) => {
  try {
    const { slug } = req.params;
    const game = db.getGameBySlug(slug);

    if (!game) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }

    const latestRelease = db.getLatestReleaseByGameId(game.id, true);
    const allPublishedReleases = db
      .getReleasesByGameId(game.id)
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
app.get('/api/products', (req, res) => {
  try {
    let products = db.getProducts(false); // Published only
    const { category, search, featured, include_games } = req.query;

    // Bridge published games into unified products catalog under 'Games' category
    if (include_games !== 'false') {
      const publishedGames = db.getGames().filter((g) => g.status === 'Available' || g.status === 'Updated');
      for (const g of publishedGames) {
        const alreadyExists = products.some((p) => p.slug.toLowerCase() === g.slug.toLowerCase());
        if (!alreadyExists) {
          const latestRelease = db.getLatestReleaseByGameId(g.id, true);
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
app.get('/api/products/:slug', (req, res) => {
  try {
    const { slug } = req.params;
    let product = db.getProductBySlug(slug, false);

    // If not in products collection, check if it's a published game
    if (!product) {
      const game = db.getGameBySlug(slug);
      if (game && (game.status === 'Available' || game.status === 'Updated')) {
        const latestRelease = db.getLatestReleaseByGameId(game.id, true);
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
app.get('/api/releases/:id/download', (req, res) => {
  try {
    const { id } = req.params;
    const release = db.getReleaseById(id);

    if (!release) {
      res.status(404).json({ error: 'Release not found' });
      return;
    }

    if (!release.is_published) {
      res.status(403).json({ error: 'This release has not been published yet' });
      return;
    }

    const apkPath = path.join(APKS_DIR, release.apk_filename);
    if (!fs.existsSync(apkPath)) {
      res.status(404).json({ error: 'Release file is missing on storage' });
      return;
    }

    // Increment download counter
    db.incrementDownload(release.id);

    // Stream download with RFC 6266 / RFC 5987 compliant Content-Disposition
    const downloadFilename = sanitizeOriginalFilename(release.original_filename, release.apk_filename);
    const contentDisposition = formatContentDisposition(downloadFilename);

    res.setHeader('Content-Disposition', contentDisposition);
    res.setHeader('Content-Type', 'application/vnd.android.package-archive');

    res.sendFile(apkPath, {
      headers: {
        'Content-Disposition': contentDisposition,
      },
    }, (err) => {
      if (err && !res.headersSent) {
        res.status(500).json({ error: 'Download failed during transfer' });
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Download error' });
  }
});

// GET /api/stats - Public studio stats
app.get('/api/stats', (_req, res) => {
  try {
    const games = db.getGames();
    const releases = db.getReleases();
    const products = db.getProducts(true);
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
      settings: db.getSettings(),
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

// GET /sitemap.xml - Dynamic XML Sitemap
app.get('/sitemap.xml', (_req, res) => {
  const games = db.getGames();
  interface SitemapEntry {
    loc: string;
    priority: string;
    changefreq: string;
    lastmod?: string;
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

  const publishedProducts = db.getProducts(false);
  const productUrls: SitemapEntry[] = publishedProducts.map((p) => ({
    loc: `${DOMAIN}/products/${encodeURIComponent(p.slug)}`,
    lastmod: (p.updated_at || p.created_at || new Date().toISOString()).split('T')[0],
    priority: '0.8',
    changefreq: 'weekly',
  }));

  const gameUrls: SitemapEntry[] = games.map((game) => ({
    loc: `${DOMAIN}/games/${encodeURIComponent(game.slug)}`,
    lastmod: (game.updated_at || game.created_at || new Date().toISOString()).split('T')[0],
    priority: '0.8',
    changefreq: 'weekly',
  }));

  const allUrls = [...staticUrls, ...productUrls, ...gameUrls];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls
  .map(
    (u) => `  <url>
    <loc>${u.loc}</loc>
    ${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>`;

  res.header('Content-Type', 'application/xml');
  res.send(xml);
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
  res.header('Content-Type', 'text/plain');
  res.send(robots);
});

// GET /llms.txt - Generative Engine Optimization (GEO) Knowledge Document
app.get('/llms.txt', (_req, res) => {
  const games = db.getGames();
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
    if (!username || !password) {
      res.status(400).json({ error: 'Username and password are required' });
      return;
    }

    const user = db.getUserByUsername(username);
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
    db.updateUserPassword(user.id, newHash);

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Password update failed' });
  }
});

// ==========================================
// PROTECTED ADMIN ENDPOINTS
// ==========================================

// GET /api/admin/stats
app.get('/api/admin/stats', requireAdmin, (_req, res) => {
  try {
    const games = db.getGames();
    const releases = db.getReleases();
    const products = db.getProducts(true);
    const totalDownloads = releases.reduce((sum, r) => sum + (r.download_count || 0), 0);

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
      recent_releases: releases
        .slice(-5)
        .reverse()
        .map((r) => {
          const game = db.getGameById(r.game_id);
          return {
            ...r,
            game_title: game?.title || 'Unknown Game',
          };
        }),
      recent_products: products.slice(0, 5),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/games
app.get('/api/admin/games', requireAdmin, (_req, res) => {
  try {
    const games = db.getGames();
    const populated = games.map((g) => ({
      ...g,
      latest_release: db.getLatestReleaseByGameId(g.id, false),
      releases_count: db.getReleasesByGameId(g.id).length,
    }));
    res.json({ games: populated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/games
app.post('/api/admin/games', requireAdmin, (req, res) => {
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
    const existing = db.getGameBySlug(finalSlug);
    if (existing) {
      res.status(400).json({ error: `Game with slug "${finalSlug}" already exists.` });
      return;
    }

    const created = db.createGame({
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
app.put('/api/admin/games/:id', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const updated = db.updateGame(id, req.body);
    if (!updated) {
      res.status(404).json({ error: 'Game not found.' });
      return;
    }
    res.json({ success: true, game: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/games/:id
app.delete('/api/admin/games/:id', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const deleted = db.deleteGame(id);
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
app.get('/api/admin/products', requireAdmin, (_req, res) => {
  try {
    const products = db.getProducts(true);
    res.json({ products });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch admin products' });
  }
});

// GET /api/admin/products/:id
app.get('/api/admin/products/:id', requireAdmin, (req, res) => {
  try {
    const product = db.getProductById(req.params.id);
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
app.post('/api/admin/products', requireAdmin, (req, res) => {
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

    const existing = db.getProductBySlug(generatedSlug, true);
    if (existing) {
      res.status(400).json({ error: `A product with slug "${generatedSlug}" already exists` });
      return;
    }

    const newProduct = db.createProduct({
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
app.put('/api/admin/products/:id', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.getProductById(id);
    if (!existing) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    const updates = { ...req.body };
    if (updates.slug && updates.slug !== existing.slug) {
      const slugCheck = db.getProductBySlug(updates.slug, true);
      if (slugCheck && slugCheck.id !== id) {
        res.status(400).json({ error: `A product with slug "${updates.slug}" already exists` });
        return;
      }
    }

    const updated = db.updateProduct(id, updates);
    res.json({ success: true, product: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update product' });
  }
});

// DELETE /api/admin/products/:id
app.delete('/api/admin/products/:id', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const success = db.deleteProduct(id);
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
app.patch('/api/admin/products/:id/status', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (status !== 'Draft' && status !== 'Published') {
      res.status(400).json({ error: 'Status must be Draft or Published' });
      return;
    }
    const updated = db.updateProduct(id, { status });
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
app.patch('/api/admin/products/:id/featured', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const { featured } = req.body;
    const updated = db.updateProduct(id, { featured: Boolean(featured) });
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
app.get('/api/admin/releases', requireAdmin, (_req, res) => {
  try {
    const releases = db.getReleases();
    const enriched = releases.map((r) => {
      const game = db.getGameById(r.game_id) || db.getGameBySlug(r.game_id);
      return {
        ...r,
        game_title: game?.title || 'Unknown Game',
        game_slug: game?.slug || '',
      };
    });
    res.json({ releases: enriched });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/releases
app.post('/api/admin/releases', requireAdmin, (req, res) => {
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

    const game = db.getGameById(rawGameId) || db.getGameBySlug(rawGameId);
    if (!game) {
      res.status(404).json({ error: 'Associated game does not exist in Game Catalog.' });
      return;
    }

    const sanitizedOriginal = sanitizeOriginalFilename(
      original_filename || req.body.original_name || req.body.originalFilename,
      apk_filename
    );

    const created = db.createRelease({
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
    const updated = db.updateRelease(created.id, {
      apk_download_url: `/api/releases/${created.id}/download`,
    });

    res.status(201).json({ success: true, release: updated || created });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/releases/:id
app.put('/api/admin/releases/:id', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.getReleaseById(id);
    if (!existing) {
      res.status(404).json({ error: 'Release not found' });
      return;
    }

    const updates = { ...req.body };
    const rawGameId = updates.game_id || updates.gameId;
    if (rawGameId) {
      const game = db.getGameById(rawGameId) || db.getGameBySlug(rawGameId);
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
    const updated = db.updateRelease(id, updates);
    res.json({ success: true, release: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/releases/:id
app.delete('/api/admin/releases/:id', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const deleted = db.deleteRelease(id);
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
app.post('/api/admin/upload/image', requireAdmin, uploadImage.single('image'), (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No image file uploaded' });
      return;
    }
    const publicUrl = `/uploads/images/${req.file.filename}`;
    res.json({
      success: true,
      filename: req.file.filename,
      url: publicUrl,
      size: req.file.size,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Image upload failed' });
  }
});

// POST /api/admin/upload/apk
app.post('/api/admin/upload/apk', requireAdmin, uploadApk.single('apk'), (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No APK file uploaded' });
      return;
    }
    const sanitizedOriginal = sanitizeOriginalFilename(req.file.originalname);
    res.json({
      success: true,
      filename: req.file.filename,
      stored_filename: req.file.filename,
      original_filename: sanitizedOriginal,
      original_name: sanitizedOriginal,
      size: req.file.size,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'APK upload failed' });
  }
});

// GET /api/admin/settings
app.get('/api/admin/settings', requireAdmin, (_req, res) => {
  res.json({ settings: db.getSettings() });
});

// PUT /api/admin/settings
app.put('/api/admin/settings', requireAdmin, (req, res) => {
  const updated = db.updateSettings(req.body);
  res.json({ success: true, settings: updated });
});

// GET /api/admin/system/storage
app.get('/api/admin/system/storage', requireAdmin, (_req, res) => {
  res.json({
    success: true,
    storage: {
      ...db.getStorageInfo(),
      uploadsDir: UPLOADS_DIR,
      imagesDir: IMAGES_DIR,
      apksDir: APKS_DIR,
    },
  });
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
  await seedDatabase();
  app.listen(PORT, () => {
    console.log(`[Karsh Tech Server] Running securely on http://localhost:${PORT}`);
    console.log(`[Karsh Tech Server] Storage: persistent=${IS_PERSISTENT_STORAGE}, uploads=${UPLOADS_DIR}`);
  });
}

startServer();
