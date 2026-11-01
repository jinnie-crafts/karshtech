import {
  MAX_IMAGE_SIZE_BYTES,
  MAX_APK_SIZE_BYTES,
  ALLOWED_IMAGE_EXTENSIONS,
  validateImageBuffer,
  validateApkBuffer,
  generateObjectPath,
} from '../server/storage/storageConfig.js';
import { MockStorageService } from '../server/testing/MockStorageService.js';

export interface TestReport {
  num: number;
  name: string;
  category: string;
  passed: boolean;
  error?: string;
}

export async function runStorageUploadTests(): Promise<TestReport[]> {
  const reports: TestReport[] = [];
  let testNum = 0;

  function run(category: string, name: string, fn: () => void | Promise<void>) {
    testNum++;
    try {
      fn();
      reports.push({ num: testNum, name, category, passed: true });
      console.log(`  ✓ [PASS] [${category}] ${name}`);
    } catch (err: any) {
      reports.push({ num: testNum, name, category, passed: false, error: err.message });
      console.error(`  ✗ [FAIL] [${category}] ${name}: ${err.message}`);
    }
  }

  async function runAsync(category: string, name: string, fn: () => Promise<void>) {
    testNum++;
    try {
      await fn();
      reports.push({ num: testNum, name, category, passed: true });
      console.log(`  ✓ [PASS] [${category}] ${name}`);
    } catch (err: any) {
      reports.push({ num: testNum, name, category, passed: false, error: err.message });
      console.error(`  ✗ [FAIL] [${category}] ${name}: ${err.message}`);
    }
  }

  function assert(condition: boolean, msg: string) {
    if (!condition) throw new Error(msg);
  }

  console.log('================================================================');
  console.log('KARSH TECH — PHASE 4.3.3 STORAGE UPLOAD & BUFFER VALIDATION TESTS');
  console.log('================================================================\n');

  // --- 1. Image Buffer & Signature Validation ---
  console.log('--- 1. Image Magic Bytes & Content Inspection ---');

  const validPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00]);
  run('ImageValidation', 'Valid PNG magic bytes detected as image/png', () => {
    const res = validateImageBuffer(validPng, 'screenshot.png');
    assert(res.valid === true, 'PNG validation passed');
    assert(res.contentType === 'image/png', 'Content-Type is image/png');
  });

  const validJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
  run('ImageValidation', 'Valid JPEG magic bytes detected as image/jpeg', () => {
    const res = validateImageBuffer(validJpeg, 'photo.jpg');
    assert(res.valid === true, 'JPEG validation passed');
    assert(res.contentType === 'image/jpeg', 'Content-Type is image/jpeg');
  });

  const validWebp = Buffer.concat([
    Buffer.from('RIFF'),
    Buffer.alloc(4),
    Buffer.from('WEBPVP8 '),
    Buffer.alloc(16),
  ]);
  run('ImageValidation', 'Valid WebP magic bytes detected as image/webp', () => {
    const res = validateImageBuffer(validWebp, 'cover.webp');
    assert(res.valid === true, 'WebP validation passed');
    assert(res.contentType === 'image/webp', 'Content-Type is image/webp');
  });

  const validGif = Buffer.concat([Buffer.from('GIF89a'), Buffer.alloc(16)]);
  run('ImageValidation', 'Valid GIF magic bytes detected as image/gif', () => {
    const res = validateImageBuffer(validGif, 'anim.gif');
    assert(res.valid === true, 'GIF validation passed');
    assert(res.contentType === 'image/gif', 'Content-Type is image/gif');
  });

  run('ImageValidation', 'Empty image buffer rejected', () => {
    const res = validateImageBuffer(Buffer.alloc(0), 'empty.png');
    assert(res.valid === false, 'Empty buffer rejected');
    assert(res.error?.includes('empty') === true, 'Error identifies empty buffer');
  });

  run('ImageValidation', 'Disallowed file extension rejected (.exe, .sh, .svg)', () => {
    const res1 = validateImageBuffer(validPng, 'payload.exe');
    assert(res1.valid === false, 'Disallowed .exe rejected');
    const res2 = validateImageBuffer(validPng, 'script.sh');
    assert(res2.valid === false, 'Disallowed .sh rejected');
    const res3 = validateImageBuffer(validPng, 'vector.svg');
    assert(res3.valid === false, 'SVG rejected (XML injection defense)');
  });

  run('ImageValidation', 'Plain text disguised as PNG rejected by magic bytes', () => {
    const textBuffer = Buffer.from('<html><script>alert(1)</script></html>');
    const res = validateImageBuffer(textBuffer, 'exploit.png');
    assert(res.valid === false, 'Fake PNG rejected');
    assert(res.error?.includes('magic bytes') === true, 'Identifies magic bytes failure');
  });

  run('ImageValidation', 'Mismatched extension and content rejected (JPEG named .png)', () => {
    const res = validateImageBuffer(validJpeg, 'mismatch.png');
    assert(res.valid === false, 'Mismatched content rejected');
    assert(res.error?.includes('Mismatched') === true, 'Error explains MIME/extension mismatch');
  });

  run('ImageValidation', 'Oversized image buffer (> 15 MB) rejected', () => {
    const oversized = Buffer.concat([validPng, Buffer.alloc(MAX_IMAGE_SIZE_BYTES + 1024)]);
    const res = validateImageBuffer(oversized, 'huge.png');
    assert(res.valid === false, 'Oversized image rejected');
    assert(res.error?.includes('15 MB') === true, 'Error cites 15 MB limit');
  });

  // --- 2. APK Buffer & Structure Validation ---
  console.log('\n--- 2. APK Buffer & Structural Inspection ---');

  const validApk = Buffer.concat([
    Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x08, 0x00]),
    Buffer.from('AndroidManifest.xml'),
    Buffer.alloc(128),
  ]);
  run('ApkValidation', 'Valid synthetic APK buffer accepted with ZIP header & manifest marker', () => {
    const res = validateApkBuffer(validApk, 'arrow-puzzle.apk');
    assert(res.valid === true, 'Valid synthetic APK accepted');
    assert(res.contentType === 'application/vnd.android.package-archive', 'Correct APK MIME type');
  });

  run('ApkValidation', 'Empty APK buffer rejected', () => {
    const res = validateApkBuffer(Buffer.alloc(0), 'app.apk');
    assert(res.valid === false, 'Empty APK buffer rejected');
  });

  run('ApkValidation', 'Non-ZIP payload with .apk extension rejected', () => {
    const textAsApk = Buffer.from('This is definitely not an android package');
    const res = validateApkBuffer(textAsApk, 'fake.apk');
    assert(res.valid === false, 'Non-ZIP APK rejected');
    assert(res.error?.includes('PK\\x03\\x04') === true, 'Identifies missing ZIP header');
  });

  run('ApkValidation', 'ZIP archive lacking AndroidManifest.xml rejected', () => {
    const zipWithoutManifest = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]),
      Buffer.from('readme.txt'),
      Buffer.alloc(64),
    ]);
    const res = validateApkBuffer(zipWithoutManifest, 'archive.apk');
    assert(res.valid === false, 'Missing AndroidManifest rejected');
    assert(res.error?.includes('AndroidManifest.xml') === true, 'Cites missing manifest entry');
  });

  run('ApkValidation', 'Valid APK payload with non-.apk extension rejected', () => {
    const res = validateApkBuffer(validApk, 'package.zip');
    assert(res.valid === false, 'Non-.apk extension rejected');
  });

  run('ApkValidation', 'Oversized APK buffer (> 50 MB) rejected', () => {
    const oversizedApk = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x03, 0x04]),
      Buffer.from('AndroidManifest.xml'),
      Buffer.alloc(MAX_APK_SIZE_BYTES + 1024),
    ]);
    const res = validateApkBuffer(oversizedApk, 'giant.apk');
    assert(res.valid === false, 'Oversized APK rejected');
    assert(res.error?.includes('50 MB') === true, 'Cites 50 MB Free tier limit');
  });

  // --- 3. Filename & Path Normalization ---
  console.log('\n--- 3. Path Generation & Filename Sanitization ---');

  run('PathGeneration', 'Generates unique collision-resistant names for identical filenames', () => {
    const p1 = generateObjectPath('', 'my_game_cover.png');
    const p2 = generateObjectPath('', 'my_game_cover.png');
    assert(p1 !== p2, 'Different timestamps/random salts ensure uniqueness');
    assert(p1.endsWith('.png') && p2.endsWith('.png'), 'Extensions preserved');
  });

  run('PathGeneration', 'Sanitizes special characters and quotes from original filenames', () => {
    const specialName = 'My App (Super Version) [Final] "v1"!.jpg';
    const path = generateObjectPath('game-assets', specialName);
    assert(!/[^a-zA-Z0-9_/.-]/.test(path), 'Path only contains safe characters');
    assert(path.startsWith('game-assets/'), 'Prefix path applied correctly');
  });

  run('PathGeneration', 'Falls back safely when original filename is empty or dot-only', () => {
    const pEmpty = generateObjectPath('', '');
    assert(pEmpty.startsWith('asset_') || pEmpty.startsWith('file_'), 'Fallback to safe prefix for empty input');
    const pDots = generateObjectPath('', '....');
    assert(pDots.startsWith('file_') || pDots.startsWith('asset_'), 'Fallback to safe prefix for dot-only input');
  });

  // --- 4. Mock Storage Service Upload Integration ---
  console.log('\n--- 4. Mock Storage Upload Integration ---');

  const mockStorage = new MockStorageService();
  await mockStorage.init();

  await runAsync('StorageUpload', 'Upload image to public game-assets bucket', async () => {
    const uploadRes = await mockStorage.upload({
      bucket: 'game-assets',
      path: 'covers/test_cover.png',
      buffer: validPng,
      contentType: 'image/png',
      preventOverwrite: true,
    });
    assert(uploadRes.success === true, 'Upload succeeded');
    assert(uploadRes.url.includes('game-assets/covers/test_cover.png'), 'URL includes bucket and path');
    assert(uploadRes.size === validPng.length, 'Size matches buffer length');
  });

  await runAsync('StorageUpload', 'Upload APK to private release-apks bucket', async () => {
    const uploadRes = await mockStorage.upload({
      bucket: 'release-apks',
      path: 'releases/test_app.apk',
      buffer: validApk,
      contentType: 'application/vnd.android.package-archive',
      preventOverwrite: true,
    });
    assert(uploadRes.success === true, 'APK upload succeeded');
    assert(uploadRes.url === '/api/releases/download', 'Returns internal download reference');
  });

  await runAsync('StorageUpload', 'Public URL generation strictly denied for release-apks bucket', async () => {
    let securityViolationCaught = false;
    try {
      mockStorage.getPublicUrl('release-apks', 'releases/test_app.apk');
    } catch (err: any) {
      securityViolationCaught = true;
      assert(err.message.includes('Security Violation'), 'Identifies security violation');
    }
    assert(securityViolationCaught, 'Exception thrown when requesting public URL for private APK');
  });

  const passed = reports.filter(r => r.passed).length;
  const failed = reports.filter(r => !r.passed).length;
  console.log(`\n================================================================`);
  console.log(`STORAGE UPLOAD SUITE: ${reports.length} Tests | ${passed} Passed | ${failed} Failed`);
  console.log(`================================================================\n`);

  if (failed > 0) {
    throw new Error(`${failed} tests failed in Storage Upload Suite`);
  }

  return reports;
}

if (process.argv[1]?.endsWith('test_storage_upload.ts')) {
  runStorageUploadTests().catch((err) => {
    console.error('[FATAL ERROR IN STORAGE UPLOAD SUITE]', err);
    process.exit(1);
  });
}
