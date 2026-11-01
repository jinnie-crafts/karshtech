import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Authoritative storage directory paths
export const DEFAULT_REPO_DATA_DIR = path.resolve(process.cwd(), 'server', 'data');
export const DEFAULT_REPO_UPLOADS_DIR = path.resolve(process.cwd(), 'server', 'uploads');

// When DATA_DIR is provided (e.g. Render Persistent Disk mount '/var/data'),
// db.json, backups, and uploads persist across container rebuilds.
export const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : DEFAULT_REPO_DATA_DIR;

export const DB_FILE = path.join(DATA_DIR, 'db.json');
export const BACKUPS_DIR = path.join(DATA_DIR, 'backups');

export const UPLOADS_DIR = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : process.env.DATA_DIR
  ? path.join(DATA_DIR, 'uploads')
  : DEFAULT_REPO_UPLOADS_DIR;

export const IMAGES_DIR = path.join(UPLOADS_DIR, 'images');
export const APKS_DIR = path.join(UPLOADS_DIR, 'apks');

export const IS_PERSISTENT_STORAGE = Boolean(process.env.DATA_DIR || process.env.UPLOADS_DIR);

/**
 * Computes SHA-256 digest of a file on disk. Returns null if file does not exist or cannot be read.
 */
export function getFileSha256(filePath: string): string | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return null;
    const content = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(content).digest('hex');
  } catch {
    return null;
  }
}

/**
 * Safely synchronizes a bundled source asset to destination using SHA-256 cryptographic verification.
 * Copies only when source exists and destination hash differs from source hash.
 * Preserves existing destination file if source is unavailable.
 */
export function syncFileWithHash(srcPath: string, destPath: string): boolean {
  if (!fs.existsSync(srcPath)) return false;
  const srcStat = fs.statSync(srcPath);
  if (!srcStat.isFile()) return false;

  if (!fs.existsSync(destPath)) {
    fs.copyFileSync(srcPath, destPath);
    return true;
  }

  const srcHash = getFileSha256(srcPath);
  const destHash = getFileSha256(destPath);

  if (srcHash && destHash && srcHash !== destHash) {
    fs.copyFileSync(srcPath, destPath);
    return true;
  }

  return false;
}

// Canonical bundled system assets that should be maintained in sync
export const BUNDLED_SYSTEM_ASSETS = new Set([
  'avatar_harsh.png',
  'avatar_aditya.png',
  'avatar_komal.png',
  'default_cover.jpg',
]);

/**
 * Ensures all required runtime storage directories exist.
 * If running on an external persistent volume, safely synchronizes default repository assets
 * (such as team avatars) using SHA-256 hash comparison, without touching user-uploaded files.
 */
export function ensureStorageDirectories(): void {
  const dirsToEnsure = [DATA_DIR, BACKUPS_DIR, UPLOADS_DIR, IMAGES_DIR, APKS_DIR];
  for (const dir of dirsToEnsure) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  // If using an external persistent uploads directory, synchronize bundled repository avatars and assets
  if (path.resolve(UPLOADS_DIR) !== path.resolve(DEFAULT_REPO_UPLOADS_DIR)) {
    const repoImagesDir = path.join(DEFAULT_REPO_UPLOADS_DIR, 'images');
    if (fs.existsSync(repoImagesDir)) {
      try {
        const repoFiles = fs.readdirSync(repoImagesDir);
        for (const file of repoFiles) {
          // Strictly synchronize known bundled system assets; NEVER overwrite user-uploaded files
          if (BUNDLED_SYSTEM_ASSETS.has(file) || file.startsWith('avatar_')) {
            const srcPath = path.join(repoImagesDir, file);
            const destPath = path.join(IMAGES_DIR, file);
            const updated = syncFileWithHash(srcPath, destPath);
            if (updated) {
              console.log(`[Storage] Synchronized bundled asset "${file}" via SHA-256 verification.`);
            }
          }
        }
      } catch (err) {
        console.warn('[Storage] Warning syncing bundled assets to persistent storage:', err);
      }
    }
  }
}
