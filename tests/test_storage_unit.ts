import {
  MAX_IMAGE_SIZE_BYTES,
  MAX_APK_SIZE_BYTES,
  ALLOWED_IMAGE_EXTENSIONS,
  validateImageBuffer,
  validateApkBuffer,
  generateObjectPath,
  PROTECTED_STORAGE_OBJECTS,
  createStorageService,
  SupabaseStorageService,
} from '../server/storage/index.js';

export interface TestReport {
  num: number;
  name: string;
  category: string;
  passed: boolean;
  error?: string;
}

export async function runStorageUnitTests(): Promise<TestReport[]> {
  const reports: TestReport[] = [];
  let testNum = 0;

  function assert(condition: boolean, message: string) {
    testNum++;
    if (condition) {
      reports.push({ num: testNum, name: message, category: 'Storage Unit', passed: true });
      console.log(`  ✓ ${message}`);
    } else {
      reports.push({ num: testNum, name: message, category: 'Storage Unit', passed: false, error: message });
      console.error(`  ✗ FAIL: ${message}`);
    }
  }
  console.log('\n--- 1. Image Buffer & Magic Bytes Validation Tests ---');

  // Valid PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
  const validPngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00]);
  const pngRes = validateImageBuffer(validPngBuffer, 'test_screenshot.png');
  assert(pngRes.valid === true, 'Accepts valid PNG buffer with PNG signature');
  assert(pngRes.contentType === 'image/png', 'Detects image/png content-type');

  // Valid JPEG magic bytes: FF D8 FF
  const validJpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
  const jpegRes = validateImageBuffer(validJpegBuffer, 'banner.jpg');
  assert(jpegRes.valid === true, 'Accepts valid JPEG buffer with FF D8 FF');
  assert(jpegRes.contentType === 'image/jpeg', 'Detects image/jpeg content-type');

  // Valid GIF magic bytes: 47 49 46 38 39 61 (GIF89a)
  const validGifBuffer = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00]);
  const gifRes = validateImageBuffer(validGifBuffer, 'animation.gif');
  assert(gifRes.valid === true, 'Accepts valid GIF buffer with GIF89a');
  assert(gifRes.contentType === 'image/gif', 'Detects image/gif content-type');

  // Valid WebP magic bytes: RIFF....WEBP
  const validWebpBuffer = Buffer.concat([
    Buffer.from('RIFF'),
    Buffer.alloc(4),
    Buffer.from('WEBPVP8 '),
  ]);
  const webpRes = validateImageBuffer(validWebpBuffer, 'cover.webp');
  assert(webpRes.valid === true, 'Accepts valid WebP buffer with RIFF...WEBP');
  assert(webpRes.contentType === 'image/webp', 'Detects image/webp content-type');

  // Rejection: Invalid extension (.exe)
  const exeBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const exeExtRes = validateImageBuffer(exeBuffer, 'malicious.exe');
  assert(exeExtRes.valid === false, 'Rejects image with disallowed .exe extension');

  // Rejection: Mismatched content (fake PNG that is actually plain text)
  const textAsPng = Buffer.from('This is not an image');
  const textRes = validateImageBuffer(textAsPng, 'fake.png');
  assert(textRes.valid === false, 'Rejects file claiming .png with non-image magic bytes');

  // Rejection: Mismatched extension and header (JPEG header named .png)
  const jpegNamedPng = validateImageBuffer(validJpegBuffer, 'mismatch.png');
  assert(jpegNamedPng.valid === false, 'Rejects file when extension (.png) does not match magic bytes (image/jpeg)');

  // Rejection: Oversized buffer (> 15 MB)
  const fakeOversized = Buffer.alloc(MAX_IMAGE_SIZE_BYTES + 10);
  fakeOversized[0] = 0x89;
  fakeOversized[1] = 0x50;
  fakeOversized[2] = 0x4e;
  fakeOversized[3] = 0x47;
  fakeOversized[4] = 0x0d;
  fakeOversized[5] = 0x0a;
  fakeOversized[6] = 0x1a;
  fakeOversized[7] = 0x0a;
  const oversizedImgRes = validateImageBuffer(fakeOversized, 'huge.png');
  assert(oversizedImgRes.valid === false, 'Rejects image exceeding 15 MB limit');

  // Rejection: Empty buffer
  const emptyRes = validateImageBuffer(Buffer.alloc(0), 'empty.png');
  assert(emptyRes.valid === false, 'Rejects empty buffer');

  console.log('\n--- 2. APK Buffer & Structure Validation Tests ---');

  // Valid APK: PK\x03\x04 signature + AndroidManifest.xml marker
  const validApk = Buffer.concat([
    Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x08, 0x00]),
    Buffer.from('AndroidManifest.xml'),
    Buffer.alloc(32),
  ]);
  const apkRes = validateApkBuffer(validApk, 'arrow-puzzle.apk');
  assert(apkRes.valid === true, 'Accepts valid APK buffer with ZIP header and AndroidManifest.xml');
  assert(apkRes.contentType === 'application/vnd.android.package-archive', 'Detects APK MIME type');

  // Rejection: Non-ZIP file claiming .apk
  const textAsApk = Buffer.from('Just text');
  const nonZipApkRes = validateApkBuffer(textAsApk, 'corrupt.apk');
  assert(nonZipApkRes.valid === false, 'Rejects non-ZIP file with .apk extension');

  // Rejection: ZIP archive without AndroidManifest.xml
  const zipNoManifest = Buffer.concat([
    Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]),
    Buffer.from('readme.txt'),
  ]);
  const noManifestRes = validateApkBuffer(zipNoManifest, 'not_android.apk');
  assert(noManifestRes.valid === false, 'Rejects ZIP archive lacking AndroidManifest.xml');

  // Rejection: Non-.apk extension
  const apkWrongExt = validateApkBuffer(validApk, 'app.zip');
  assert(apkWrongExt.valid === false, 'Rejects valid APK payload if extension is not .apk');

  // Rejection: Oversized APK (> 50 MB)
  const fakeOversizedApk = Buffer.concat([
    Buffer.from([0x50, 0x4b, 0x03, 0x04]),
    Buffer.from('AndroidManifest.xml'),
    Buffer.alloc(MAX_APK_SIZE_BYTES + 100),
  ]);
  const oversizedApkRes = validateApkBuffer(fakeOversizedApk, 'giant.apk');
  assert(oversizedApkRes.valid === false, 'Rejects APK exceeding 50 MB Supabase Free limit');

  console.log('\n--- 3. Collision-Resistant Object Path Generation ---');
  const p1 = generateObjectPath('', 'My Super Photo (1)!.jpg');
  const p2 = generateObjectPath('', 'My Super Photo (1)!.jpg');
  assert(p1 !== p2, 'Generates unique collision-resistant paths for same input');
  assert(!/[^a-zA-Z0-9_.-]/.test(p1), 'Sanitizes special characters from filename');
  assert(p1.endsWith('.jpg'), 'Preserves original .jpg extension');

  const pWithPrefix = generateObjectPath('games/covers', 'cover.png');
  assert(pWithPrefix.startsWith('games/covers/'), 'Prepend prefix path correctly');
  assert(pWithPrefix.endsWith('.png'), 'Preserves extension in prefixed path');

  console.log('\n--- 4. Protected Storage Objects & Guardrails ---');
  assert(PROTECTED_STORAGE_OBJECTS.has('arrow-puzzle-release-v1.0.0.apk'), 'arrow-puzzle-release-v1.0.0.apk is protected');
  assert(PROTECTED_STORAGE_OBJECTS.has('arrow_puzzle_screenshot_1.jpg'), 'arrow_puzzle_screenshot_1.jpg is protected');
  assert(PROTECTED_STORAGE_OBJECTS.has('avatar_harsh.png'), 'avatar_harsh.png is protected');
  assert(PROTECTED_STORAGE_OBJECTS.has('avatar_aditya.png'), 'avatar_aditya.png is protected');
  assert(PROTECTED_STORAGE_OBJECTS.has('avatar_komal.png'), 'avatar_komal.png is protected');

  const dummyService = new SupabaseStorageService('https://dummy.supabase.co', 'dummy_key');
  const deleteProtectedAttempt = await dummyService.deleteObject('release-apks', 'arrow-puzzle-release-v1.0.0.apk');
  assert(deleteProtectedAttempt === false, 'deleteObject() refuses to delete protected production asset');

  console.log('\n--- 5. Public URL Generation & Access Control ---');
  const publicGameUrl = dummyService.getPublicUrl('game-assets', 'covers/game1.jpg');
  assert(
    publicGameUrl === 'https://dummy.supabase.co/storage/v1/object/public/game-assets/covers/game1.jpg',
    'Generates correct public CDN URL for game-assets'
  );

  let privateUrlError = false;
  try {
    dummyService.getPublicUrl('release-apks', 'secret.apk');
  } catch (err: any) {
    privateUrlError = true;
  }
  assert(privateUrlError === true, 'getPublicUrl() throws security error when called for private release-apks bucket');

  const passed = reports.filter(r => r.passed).length;
  const failed = reports.filter(r => !r.passed).length;
  console.log(`\n========================================`);
  console.log(`Unit Test Summary: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================\n`);

  if (failed > 0) {
    throw new Error(`${failed} tests failed in Storage Unit Tests`);
  }

  return reports;
}

if (process.argv[1]?.endsWith('test_storage_unit.ts')) {
  runStorageUnitTests().catch((err) => {
    console.error('Test error:', err);
    process.exit(1);
  });
}
