import fs from 'fs';
import path from 'path';
import { db } from './db.js';
import { hashPassword } from './auth.js';
import {
  IMAGES_DIR,
  APKS_DIR,
  DEFAULT_REPO_UPLOADS_DIR,
  ensureStorageDirectories,
} from './paths.js';

export async function seedDatabase(): Promise<void> {
  // Ensure storage directories are initialized
  ensureStorageDirectories();

  // 1. Seed or Migrate Admin User
  const defaultUsername = process.env.ADMIN_USERNAME || 'khrgosh';
  const defaultPassword = process.env.ADMIN_PASSWORD || 'KarshTechAdmin2026!';
  const existingUsers = db.getUsers();

  const oldAdmin = existingUsers.find((u) => u.username.toLowerCase() === 'admin');
  if (oldAdmin) {
    db.updateUserUsername(oldAdmin.id, defaultUsername);
    console.log(`[Seed] Migrated admin account username to "${defaultUsername}" (id: ${oldAdmin.id})`);
  } else if (existingUsers.length === 0) {
    const passwordHash = await hashPassword(defaultPassword);
    db.createUser({
      username: defaultUsername,
      password_hash: passwordHash,
      role: 'superadmin',
    });
    console.log(`[Seed] Initial superadmin account initialized: username="${defaultUsername}"`);
  }

  // 2. Ensure studio settings are initialized
  const settings = db.getSettings();
  if (!settings || !settings.studio_name) {
    db.updateSettings({
      studio_name: 'Karsh Tech',
      tagline: 'Turning Ideas into Digital Reality',
      contact_email: 'karshhtech@gmail.com',
      updated_at: new Date().toISOString(),
      initial_seeded: true,
    });
  }

  // 3. Ensure bundled avatars are copied to active uploads directory if missing
  try {
    const repoImagesDir = path.join(DEFAULT_REPO_UPLOADS_DIR, 'images');
    if (fs.existsSync(repoImagesDir)) {
      const avatars = ['avatar_harsh.png', 'avatar_aditya.png', 'avatar_komal.png'];
      for (const av of avatars) {
        const src = path.join(repoImagesDir, av);
        const dest = path.join(IMAGES_DIR, av);
        if (fs.existsSync(src) && !fs.existsSync(dest)) {
          fs.copyFileSync(src, dest);
        }
      }
    }
  } catch (err) {
    console.warn('[Seed] Warning copying default avatars:', err);
  }

  // 4. DEMO DATA SEEDING SAFEGUARD:
  // Production data MUST NEVER be overwritten or seeded with dummy records on container restarts.
  // Demo games and placeholder releases are ONLY seeded if:
  // - NODE_ENV is NOT 'production'
  // - SEED_DEMO_DATA is explicitly 'true'
  // - initial_seeded is not yet true
  // - games list is completely empty
  const isProduction = process.env.NODE_ENV === 'production';
  const explicitDemoRequested = process.env.SEED_DEMO_DATA === 'true';

  if (isProduction || !explicitDemoRequested) {
    if (!settings.initial_seeded) {
      db.updateSettings({ initial_seeded: true });
    }
    return;
  }

  // If initial seeding has already been recorded, never resurrect deleted records
  if (settings.initial_seeded) {
    return;
  }

  // Only seed demo game if game catalog is empty
  const existingGames = db.getGames();
  if (existingGames.length === 0) {
    console.log('[Seed] Seeding initial developer demo Arrow Puzzle game (explicitly enabled)...');

    const apkFilename = 'arrow-puzzle-release-v1.0.0.apk';
    const targetApkPath = path.join(APKS_DIR, apkFilename);
    const repoApk = path.join(DEFAULT_REPO_UPLOADS_DIR, 'apks', apkFilename);

    let apkFileSize = 2885749;
    if (fs.existsSync(repoApk)) {
      try {
        if (!fs.existsSync(targetApkPath)) {
          fs.copyFileSync(repoApk, targetApkPath);
        }
        apkFileSize = fs.statSync(targetApkPath).size;
      } catch (err) {
        console.warn('[Seed] Warning copying repo demo APK:', err);
      }
    }

    const coverImage = '/uploads/images/arrow_puzzle_screenshot_1.jpg';
    const screenshotsList = [
      '/uploads/images/arrow_puzzle_screenshot_1.jpg',
      '/uploads/images/arrow_puzzle_screenshot_2.jpg',
      '/uploads/images/arrow_puzzle_screenshot_3.jpg',
      '/uploads/images/arrow_puzzle_screenshot_4.jpg',
      '/uploads/images/arrow_puzzle_screenshot_5.jpg',
      '/uploads/images/arrow_puzzle_screenshot_6.jpg',
    ];

    const createdGame = db.createGame({
      title: 'Arrow Puzzle',
      slug: 'arrow-puzzle',
      tagline: 'A Calming, Tactile Logic Puzzle for Mindful Spatial Focus',
      description:
        'Arrow Puzzle is an addictive logic game for Android where players clear a dense board of interlocking arrows by inspecting corridors and safely releasing unobstructed paths. Featuring a clean porcelain visual aesthetic, tactile haptic feedback, and hundreds of escalating spatial challenges.',
      genre: ['Puzzle', 'Logic', 'Casual', 'Brain Training'],
      platforms: ['Android'],
      status: 'Available',
      featured: true,
      cover_image: coverImage,
      banner_image: screenshotsList[1] || coverImage,
      screenshots: screenshotsList,
      features: [
        'Tactile Directional Mechanics: Guide interlocking arrows off the board without path collision',
        'Spatial Reasoning Challenge: Progressive board layouts with complex bends, zigzags, and U-turns',
        'Calming Minimalist Aesthetics: Clean porcelain surfaces, soothing color palettes, and fluid motion',
        '100% Offline-First Architecture: Play seamlessly on the go without requiring internet access',
        'Optimized Android Performance: Native Jetpack Compose rendering running at smooth 60+ FPS',
      ],
      controls: [
        'Inspect the board to identify arrows with unobstructed escape routes',
        'Tap a free arrow to watch it slide smoothly off the game grid',
        'Avoid tapping blocked arrows to prevent collision feedback',
        'Clear all arrows sequentially to advance to the next puzzle level',
      ],
      requirements: {
        min_android: 'Android 8.0 (Oreo, API level 26)',
        target_android: 'Android 15 (API level 35)',
        storage: '25 MB free storage space',
        ram: '2 GB RAM or higher',
        internet: 'None required (100% Offline)',
      },
      developer: 'Karsh Tech Studio',
    });

    const release = db.createRelease({
      game_id: createdGame.id,
      version_name: '1.0.0',
      version_code: 1,
      release_date: '2026-10-24',
      release_notes:
        'Initial production release of Arrow Puzzle. Features over 100 hand-crafted spatial logic levels, full offline gameplay, optimized touch response, and fluid Jetpack Compose physics animations.',
      apk_filename: apkFilename,
      original_filename: apkFilename,
      apk_file_size: apkFileSize,
      apk_download_url: '',
      min_sdk: 26,
      target_sdk: 35,
      is_published: true,
    });

    db.updateRelease(release.id, {
      apk_download_url: `/api/releases/${release.id}/download`,
    });

    console.log(`[Seed] Demo Arrow Puzzle seeded with ID: ${createdGame.id}`);
  }

  // Mark initial seeding complete so demo data is never regenerated
  db.updateSettings({ initial_seeded: true });
}
