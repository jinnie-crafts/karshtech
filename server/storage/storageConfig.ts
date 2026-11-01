import path from 'path';

// Free-tier per-file maximum upload limits
export const MAX_IMAGE_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB
export const MAX_APK_SIZE_BYTES = 50 * 1024 * 1024;   // 50 MB (Supabase Free limit)

export const ALLOWED_IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);

export const MIME_BY_EXTENSION: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.apk': 'application/vnd.android.package-archive',
};

// Protected production assets that must never be deleted
export const PROTECTED_STORAGE_OBJECTS = new Set([
  'arrow_puzzle_screenshot_1.jpg',
  'arrow_puzzle_screenshot_2.jpg',
  'arrow_puzzle_screenshot_3.jpg',
  'arrow_puzzle_screenshot_4.jpg',
  'arrow_puzzle_screenshot_5.jpg',
  'arrow_puzzle_screenshot_6.jpg',
  'avatar_harsh.png',
  'avatar_aditya.png',
  'avatar_komal.png',
  'default_cover.jpg',
  'arrow-puzzle-release-v1.0.0.apk',
]);

export interface ValidationResult {
  valid: boolean;
  error?: string;
  contentType: string;
}

/**
 * Validates image buffer magic bytes and extension against supported types.
 */
export function validateImageBuffer(
  buffer: Buffer,
  originalFilename: string,
  declaredMime?: string
): ValidationResult {
  if (!buffer || buffer.length === 0) {
    return { valid: false, error: 'File buffer is empty', contentType: '' };
  }

  if (buffer.length > MAX_IMAGE_SIZE_BYTES) {
    return {
      valid: false,
      error: `Image exceeds maximum allowed size of 15 MB (actual: ${(buffer.length / (1024 * 1024)).toFixed(2)} MB)`,
      contentType: '',
    };
  }

  const ext = path.extname(originalFilename || '').toLowerCase();
  if (!ALLOWED_IMAGE_EXTENSIONS.has(ext)) {
    return {
      valid: false,
      error: `Invalid file extension "${ext}". Allowed image extensions: PNG, JPG, JPEG, WEBP, GIF`,
      contentType: '',
    };
  }

  // Magic bytes inspection
  // JPEG: FF D8 FF
  const isJpeg = buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  const isPng =
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a;
  // GIF: GIF87a or GIF89a
  const isGif =
    buffer.length >= 6 &&
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38 &&
    (buffer[4] === 0x37 || buffer[4] === 0x39) &&
    buffer[5] === 0x61;
  // WEBP: RIFF....WEBP
  const isWebp =
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50;

  let detectedContentType = '';
  if (isJpeg) detectedContentType = 'image/jpeg';
  else if (isPng) detectedContentType = 'image/png';
  else if (isWebp) detectedContentType = 'image/webp';
  else if (isGif) detectedContentType = 'image/gif';

  if (!detectedContentType) {
    return {
      valid: false,
      error: 'File content does not match any valid image signature (magic bytes check failed)',
      contentType: '',
    };
  }

  // Check extension matches detected content type
  const expectedMime = MIME_BY_EXTENSION[ext];
  if (expectedMime && expectedMime !== detectedContentType) {
    return {
      valid: false,
      error: `Mismatched file content: Extension "${ext}" claims ${expectedMime} but content is ${detectedContentType}`,
      contentType: '',
    };
  }

  return { valid: true, contentType: detectedContentType };
}

/**
 * Validates APK buffer structure (ZIP container + Android package marker).
 */
export function validateApkBuffer(
  buffer: Buffer,
  originalFilename: string,
  declaredMime?: string
): ValidationResult {
  if (!buffer || buffer.length === 0) {
    return { valid: false, error: 'APK buffer is empty', contentType: '' };
  }

  if (buffer.length > MAX_APK_SIZE_BYTES) {
    return {
      valid: false,
      error: `APK file exceeds maximum allowed size of 50 MB on Supabase Free (actual: ${(buffer.length / (1024 * 1024)).toFixed(2)} MB)`,
      contentType: '',
    };
  }

  const ext = path.extname(originalFilename || '').toLowerCase();
  if (ext !== '.apk') {
    return {
      valid: false,
      error: `Invalid file extension "${ext}". Only .apk Android packages are accepted.`,
      contentType: '',
    };
  }

  // ZIP Local File Header magic bytes: 50 4B 03 04 (PK\x03\x04)
  const isZip =
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04;

  if (!isZip) {
    return {
      valid: false,
      error: 'File is not a valid ZIP/APK archive (missing PK\\x03\\x04 signature)',
      contentType: '',
    };
  }

  // Look for AndroidManifest.xml marker in the ZIP archive
  const manifestMarker = Buffer.from('AndroidManifest.xml');
  const hasManifest = buffer.indexOf(manifestMarker) !== -1;
  if (!hasManifest) {
    return {
      valid: false,
      error: 'Corrupt or invalid Android package: Missing AndroidManifest.xml archive entry',
      contentType: '',
    };
  }

  return { valid: true, contentType: 'application/vnd.android.package-archive' };
}

/**
 * Generates a sanitized, collision-resistant object path.
 */
export function generateObjectPath(
  prefix: string,
  originalFilename: string,
  forcedExt?: string
): string {
  const ext = forcedExt || path.extname(originalFilename || '').toLowerCase();
  const safeBase = path
    .basename(originalFilename || 'asset', ext)
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .substring(0, 36)
    .replace(/^_+|_+$/g, '') || 'file';

  const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const filename = `${safeBase}_${uniqueSuffix}${ext}`;

  if (prefix) {
    const cleanPrefix = prefix.replace(/^\/+|\/+$/g, '');
    return `${cleanPrefix}/${filename}`;
  }
  return filename;
}
