import fs from 'fs';
import path from 'path';

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
 * Ensures all required runtime storage directories exist.
 * If running on an external persistent volume, safely migrates default repository assets (such as team avatars).
 */
export function ensureStorageDirectories(): void {
  const dirsToEnsure = [DATA_DIR, BACKUPS_DIR, UPLOADS_DIR, IMAGES_DIR, APKS_DIR];
  for (const dir of dirsToEnsure) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  // If using an external persistent uploads directory, copy bundled repository avatars if not present
  if (path.resolve(UPLOADS_DIR) !== path.resolve(DEFAULT_REPO_UPLOADS_DIR)) {
    const repoImagesDir = path.join(DEFAULT_REPO_UPLOADS_DIR, 'images');
    if (fs.existsSync(repoImagesDir)) {
      try {
        const repoFiles = fs.readdirSync(repoImagesDir);
        for (const file of repoFiles) {
          // Copy avatars and default assets if missing in target persistent storage
          if (file.startsWith('avatar_') || file.startsWith('default_') || file.endsWith('.png') || file.endsWith('.jpg')) {
            const srcPath = path.join(repoImagesDir, file);
            const destPath = path.join(IMAGES_DIR, file);
            if (!fs.existsSync(destPath) && fs.statSync(srcPath).isFile()) {
              fs.copyFileSync(srcPath, destPath);
            }
          }
        }
      } catch (err) {
        console.warn('[Storage] Warning syncing bundled assets to persistent storage:', err);
      }
    }
  }
}
