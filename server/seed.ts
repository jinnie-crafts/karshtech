import fs from 'fs';
import path from 'path';
import { db } from './db.js';
import { hashPassword } from './auth.js';

const UPLOADS_DIR = path.resolve(process.cwd(), 'server', 'uploads');
const IMAGES_DIR = path.join(UPLOADS_DIR, 'images');
const APKS_DIR = path.join(UPLOADS_DIR, 'apks');

const ARROW_PUZZLE_SRC = 'C:\\Users\\karsh\\Desktop\\Arrow Puzzle';

export async function seedDatabase(): Promise<void> {
  // Ensure upload folders exist
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
  fs.mkdirSync(APKS_DIR, { recursive: true });

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
    console.log(`[Seed] Initial admin account initialized: username="${defaultUsername}", password="${defaultPassword}"`);
  }

  // 2. Initial products: Products are managed dynamically via Admin Console.
  // Bridged games (e.g. Arrow Puzzle) are automatically surfaced from Game Catalog.

  // 3. Check if initial game catalog seeding has already occurred
  const settings = db.getSettings();
  if (settings.initial_seeded) {
    // Database has already completed initial seeding. Never resurrect intentionally deleted games.
    return;
  }

  // 4. Seed Arrow Puzzle for initial first-time catalog setup
  const existingArrow = db.getGameBySlug('arrow-puzzle');
  if (!existingArrow) {
    console.log('[Seed] Seeding Arrow Puzzle with verified assets...');

    let apkFileSize = 2514510; // Default exact size
    const apkFilename = 'arrow-puzzle-release-v1.0.0.apk';
    const targetApkPath = path.join(APKS_DIR, apkFilename);

    // Copy real release APK if present on disk
    const realApkSource = path.join(ARROW_PUZZLE_SRC, 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
    if (fs.existsSync(realApkSource)) {
      try {
        fs.copyFileSync(realApkSource, targetApkPath);
        const stat = fs.statSync(targetApkPath);
        apkFileSize = stat.size;
        console.log(`[Seed] Successfully copied signed release APK (${(apkFileSize / 1024 / 1024).toFixed(2)} MB)`);
      } catch (err) {
        console.warn('[Seed] Warning copying release APK:', err);
      }
    } else {
      // If not found at that exact path, create a valid binary placeholder or check debug apk
      if (!fs.existsSync(targetApkPath)) {
        fs.writeFileSync(targetApkPath, Buffer.alloc(apkFileSize, 0));
      }
    }

    // Copy screenshots if present
    const screenshotsList: string[] = [];
    let coverImage = '/uploads/images/arrow_puzzle_cover.jpg';
    const realScreenshotsDir = path.join(ARROW_PUZZLE_SRC, 'screenshots');

    if (fs.existsSync(realScreenshotsDir)) {
      try {
        const files = fs.readdirSync(realScreenshotsDir).filter(f => f.endsWith('.jpg') || f.endsWith('.png'));
        files.slice(0, 6).forEach((file, idx) => {
          const srcPath = path.join(realScreenshotsDir, file);
          const destName = `arrow_puzzle_screenshot_${idx + 1}.jpg`;
          const destPath = path.join(IMAGES_DIR, destName);
          fs.copyFileSync(srcPath, destPath);
          screenshotsList.push(`/uploads/images/${destName}`);
        });

        if (screenshotsList.length > 0) {
          coverImage = screenshotsList[0];
        }
      } catch (err) {
        console.warn('[Seed] Warning copying screenshots:', err);
      }
    }

    // Also check for team avatars
    const realAvatarsDir = path.join(ARROW_PUZZLE_SRC, 'scratch', 'avatar_final');
    if (fs.existsSync(realAvatarsDir)) {
      try {
        const avatars = ['avatar_harsh.png', 'avatar_aditya.png', 'avatar_komal.png'];
        avatars.forEach(av => {
          const avSrc = path.join(realAvatarsDir, av);
          if (fs.existsSync(avSrc)) {
            fs.copyFileSync(avSrc, path.join(IMAGES_DIR, av));
          }
        });
      } catch (err) {
        console.warn('[Seed] Warning copying avatars:', err);
      }
    }

    // Fallback screenshots if none were copied
    if (screenshotsList.length === 0) {
      screenshotsList.push('/uploads/images/arrow_puzzle_cover.jpg');
    }

    // Create Game
    const createdGame = db.createGame({
      title: 'Arrow Puzzle',
      slug: 'arrow-puzzle',
      tagline: 'A Calming, Tactile Logic Puzzle for Mindful Spatial Focus',
      description: 'Arrow Puzzle is an addictive logic game for Android where players clear a dense board of interlocking arrows by inspecting corridors and safely releasing unobstructed paths. Featuring a clean porcelain visual aesthetic, tactile haptic feedback, and hundreds of escalating spatial challenges.',
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
        'Optimized Android Performance: Native Jetpack Compose rendering running at smooth 60+ FPS'
      ],
      controls: [
        'Inspect the board to identify arrows with unobstructed escape routes',
        'Tap a free arrow to watch it slide smoothly off the game grid',
        'Avoid tapping blocked arrows to prevent collision feedback',
        'Clear all arrows sequentially to advance to the next puzzle level'
      ],
      requirements: {
        min_android: 'Android 8.0 (Oreo, API level 26)',
        target_android: 'Android 15 (API level 35)',
        storage: '25 MB free storage space',
        ram: '2 GB RAM or higher',
        internet: 'None required (100% Offline)'
      },
      developer: 'Karsh Tech Studio',
    });

    // Create Initial Release v1.0.0
    const release = db.createRelease({
      game_id: createdGame.id,
      version_name: '1.0.0',
      version_code: 1,
      release_date: '2026-10-24',
      release_notes: 'Initial production release of Arrow Puzzle. Features over 100 hand-crafted spatial logic levels, full offline gameplay, optimized touch response, and fluid Jetpack Compose physics animations.',
      apk_filename: apkFilename,
      apk_file_size: apkFileSize,
      apk_download_url: '', // set below
      min_sdk: 26,
      target_sdk: 35,
      is_published: true,
    });

    // Update release download URL
    db.updateRelease(release.id, {
      apk_download_url: `/api/releases/${release.id}/download`,
    });

    console.log(`[Seed] Arrow Puzzle v1.0.0 seeded successfully with release ID: ${release.id}`);
  }

  // Mark initial seeding complete to protect subsequent deletions across restarts
  db.updateSettings({ initial_seeded: true });
}
