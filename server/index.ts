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

const app = express();
const PORT = process.env.PORT || 3001;

// Upload Directories
const UPLOADS_DIR = path.resolve(process.cwd(), 'server', 'uploads');
const IMAGES_DIR = path.join(UPLOADS_DIR, 'images');
const APKS_DIR = path.join(UPLOADS_DIR, 'apks');

fs.mkdirSync(IMAGES_DIR, { recursive: true });
fs.mkdirSync(APKS_DIR, { recursive: true });

// Middleware
app.use(
  cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000'],
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static file serving for uploads
app.use('/uploads', express.static(UPLOADS_DIR));

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

// Configure Multer for APK Uploads
const apkStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, APKS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeBase = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .substring(0, 40);
    const uniqueName = `${safeBase}_${Date.now()}${ext || '.apk'}`;
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

    // Stream download
    res.download(apkPath, release.apk_filename, (err) => {
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
    const totalDownloads = releases.reduce((sum, r) => sum + (r.download_count || 0), 0);

    res.json({
      stats: {
        total_games: games.length,
        available_games: games.filter((g) => g.status === 'Available').length,
        total_releases: releases.filter((r) => r.is_published).length,
        total_downloads: totalDownloads,
      },
      settings: db.getSettings(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/support - Contact and issue reporting
app.post('/api/support', (req, res) => {
  const { name, email, game, subject, message } = req.body;
  if (!name || !email || !message) {
    res.status(400).json({ error: 'Name, email, and message are required.' });
    return;
  }
  // In production, send via SendGrid / Resend / Mailgun.
  console.log(`[Support Ticket] From: ${name} <${email}> | Game: ${game || 'General'} | Subject: ${subject}`);
  res.json({ success: true, message: 'Your message has been received. Our team will review it shortly.' });
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
    const totalDownloads = releases.reduce((sum, r) => sum + (r.download_count || 0), 0);

    res.json({
      stats: {
        total_games: games.length,
        published_games: games.filter((g) => g.status === 'Available' || g.status === 'Updated').length,
        total_releases: releases.length,
        total_downloads: totalDownloads,
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

// GET /api/admin/releases
app.get('/api/admin/releases', requireAdmin, (_req, res) => {
  try {
    const releases = db.getReleases();
    const enriched = releases.map((r) => {
      const game = db.getGameById(r.game_id);
      return {
        ...r,
        game_title: game?.title || 'Unknown Game',
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
      apk_file_size,
      min_sdk,
      target_sdk,
      is_published,
    } = req.body;

    if (!game_id || !version_name || !apk_filename) {
      res.status(400).json({ error: 'Game, version name, and APK file are required.' });
      return;
    }

    const game = db.getGameById(game_id);
    if (!game) {
      res.status(404).json({ error: 'Associated game does not exist.' });
      return;
    }

    const created = db.createRelease({
      game_id,
      version_name,
      version_code: Number(version_code) || 1,
      release_date: release_date || new Date().toISOString().split('T')[0],
      release_notes: release_notes || 'General performance updates and optimizations.',
      apk_filename,
      apk_file_size: Number(apk_file_size) || 0,
      apk_download_url: '',
      min_sdk: Number(min_sdk) || 26,
      target_sdk: Number(target_sdk) || 35,
      is_published: Boolean(is_published ?? true),
    });

    // Set download URL
    db.updateRelease(created.id, {
      apk_download_url: `/api/releases/${created.id}/download`,
    });

    res.status(201).json({ success: true, release: { ...created, apk_download_url: `/api/releases/${created.id}/download` } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/releases/:id
app.put('/api/admin/releases/:id', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const updated = db.updateRelease(id, req.body);
    if (!updated) {
      res.status(404).json({ error: 'Release not found' });
      return;
    }
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
    res.json({
      success: true,
      filename: req.file.filename,
      size: req.file.size,
      original_name: req.file.originalname,
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
  await seedDatabase();
  app.listen(PORT, () => {
    console.log(`[Karsh Tech Server] Running securely on http://localhost:${PORT}`);
  });
}

startServer();
