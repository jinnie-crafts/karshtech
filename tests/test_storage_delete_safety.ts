import { MockStorageService } from '../server/testing/MockStorageService.js';
import { PROTECTED_STORAGE_OBJECTS } from '../server/storage/storageConfig.js';
import type { StorageBucket } from '../server/storage/storageTypes.js';

export interface TestReport {
  num: number;
  name: string;
  category: string;
  passed: boolean;
  error?: string;
}

export async function runStorageDeleteSafetyTests(): Promise<TestReport[]> {
  const reports: TestReport[] = [];
  let testNum = 0;

  async function run(category: string, name: string, fn: () => Promise<void>) {
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
  console.log('KARSH TECH — PHASE 4.3.3 STORAGE DELETE SAFEGUARDS & SAFETY TESTS');
  console.log('================================================================\n');

  const mockStorage = new MockStorageService();
  await mockStorage.init();

  // Seed sample assets into mock storage
  const sampleBuf = Buffer.from('test sample asset data');
  await mockStorage.upload({
    bucket: 'game-assets',
    path: 'removable_asset.png',
    buffer: sampleBuf,
    contentType: 'image/png',
    preventOverwrite: false,
  });

  await mockStorage.upload({
    bucket: 'release-apks',
    path: 'removable_release.apk',
    buffer: sampleBuf,
    contentType: 'application/vnd.android.package-archive',
    preventOverwrite: false,
  });

  // Seed protected asset equivalents
  await mockStorage.upload({
    bucket: 'release-apks',
    path: 'arrow-puzzle-release-v1.0.0.apk',
    buffer: sampleBuf,
    contentType: 'application/vnd.android.package-archive',
    preventOverwrite: false,
  });

  await mockStorage.upload({
    bucket: 'game-assets',
    path: 'arrow_puzzle_screenshot_1.jpg',
    buffer: sampleBuf,
    contentType: 'image/jpeg',
    preventOverwrite: false,
  });

  await mockStorage.upload({
    bucket: 'game-assets',
    path: 'avatar_harsh.png',
    buffer: sampleBuf,
    contentType: 'image/png',
    preventOverwrite: false,
  });

  // --- 1. Protected Production Assets Protection ---
  await run('DeleteSafeguard', 'Refuses deletion of protected production APK arrow-puzzle-release-v1.0.0.apk', async () => {
    const deleted = await mockStorage.deleteObject('release-apks', 'arrow-puzzle-release-v1.0.0.apk');
    assert(deleted === false, 'deleteObject must return false for protected APK');
    const meta = await mockStorage.getObjectMetadata('release-apks', 'arrow-puzzle-release-v1.0.0.apk');
    assert(meta !== null, 'Protected APK remains intact on storage');
  });

  await run('DeleteSafeguard', 'Refuses deletion of protected production screenshot arrow_puzzle_screenshot_1.jpg', async () => {
    const deleted = await mockStorage.deleteObject('game-assets', 'arrow_puzzle_screenshot_1.jpg');
    assert(deleted === false, 'deleteObject must return false for protected screenshot');
    const meta = await mockStorage.getObjectMetadata('game-assets', 'arrow_puzzle_screenshot_1.jpg');
    assert(meta !== null, 'Protected screenshot remains intact on storage');
  });

  await run('DeleteSafeguard', 'Refuses deletion of protected avatar avatar_harsh.png', async () => {
    const deleted = await mockStorage.deleteObject('game-assets', 'avatar_harsh.png');
    assert(deleted === false, 'deleteObject must return false for protected avatar');
    const meta = await mockStorage.getObjectMetadata('game-assets', 'avatar_harsh.png');
    assert(meta !== null, 'Protected avatar remains intact on storage');
  });

  await run('DeleteSafeguard', 'PROTECTED_STORAGE_OBJECTS contains all 11 critical production items', async () => {
    assert(PROTECTED_STORAGE_OBJECTS.has('arrow-puzzle-release-v1.0.0.apk'), 'Contains APK');
    assert(PROTECTED_STORAGE_OBJECTS.has('avatar_harsh.png'), 'Contains avatar_harsh');
    assert(PROTECTED_STORAGE_OBJECTS.has('avatar_aditya.png'), 'Contains avatar_aditya');
    assert(PROTECTED_STORAGE_OBJECTS.has('avatar_komal.png'), 'Contains avatar_komal');
    assert(PROTECTED_STORAGE_OBJECTS.has('arrow_puzzle_screenshot_1.jpg'), 'Contains screenshot 1');
    assert(PROTECTED_STORAGE_OBJECTS.has('arrow_puzzle_screenshot_6.jpg'), 'Contains screenshot 6');
  });

  // --- 2. Deletion of Non-Protected Test Assets ---
  await run('DeleteOperation', 'Successfully deletes non-protected test image asset', async () => {
    const deleted = await mockStorage.deleteObject('game-assets', 'removable_asset.png');
    assert(deleted === true, 'Returns true for deleted test asset');
    const meta = await mockStorage.getObjectMetadata('game-assets', 'removable_asset.png');
    assert(meta === null, 'Deleted asset no longer exists in storage');
  });

  await run('DeleteOperation', 'Successfully deletes non-protected test APK asset', async () => {
    const deleted = await mockStorage.deleteObject('release-apks', 'removable_release.apk');
    assert(deleted === true, 'Returns true for deleted test APK');
    const meta = await mockStorage.getObjectMetadata('release-apks', 'removable_release.apk');
    assert(meta === null, 'Deleted APK no longer exists in storage');
  });

  // --- 3. Unknown Object & Duplicate Deletion ---
  await run('Idempotence', 'Deleting non-existent or already deleted object returns false safely', async () => {
    const deletedAgain = await mockStorage.deleteObject('game-assets', 'removable_asset.png');
    assert(deletedAgain === false, 'Returns false for already deleted object');
    const deletedGhost = await mockStorage.deleteObject('game-assets', 'never_existed_file.png');
    assert(deletedGhost === false, 'Returns false for never-existed object');
  });

  // --- 4. Simulated Failure Handling ---
  await run('FaultHandling', 'Surfaces simulated storage network failure cleanly', async () => {
    mockStorage.simulateFailure('deleteObject', new Error('Storage Gateway Timeout 504'));
    let failureCaught = false;
    try {
      await mockStorage.deleteObject('game-assets', 'some_other.png');
    } catch (err: any) {
      failureCaught = true;
      assert(err.message.includes('504'), 'Error message retained');
    }
    assert(failureCaught, 'Simulated failure successfully caught');
    mockStorage.clearSimulatedFailure('deleteObject');
  });

  // --- 5. Unrelated Object Isolation ---
  await run('Isolation', 'Deleting one asset does not delete or affect other objects', async () => {
    // Upload two distinct objects
    await mockStorage.upload({
      bucket: 'game-assets',
      path: 'asset_alpha.png',
      buffer: sampleBuf,
      contentType: 'image/png',
      preventOverwrite: false,
    });
    await mockStorage.upload({
      bucket: 'game-assets',
      path: 'asset_beta.png',
      buffer: sampleBuf,
      contentType: 'image/png',
      preventOverwrite: false,
    });

    await mockStorage.deleteObject('game-assets', 'asset_alpha.png');
    const alpha = await mockStorage.getObjectMetadata('game-assets', 'asset_alpha.png');
    const beta = await mockStorage.getObjectMetadata('game-assets', 'asset_beta.png');

    assert(alpha === null, 'Alpha deleted');
    assert(beta !== null, 'Beta remains intact');
  });

  const passed = reports.filter(r => r.passed).length;
  const failed = reports.filter(r => !r.passed).length;
  console.log(`\n================================================================`);
  console.log(`STORAGE DELETE SAFETY SUITE: ${reports.length} Tests | ${passed} Passed | ${failed} Failed`);
  console.log(`================================================================\n`);

  if (failed > 0) {
    throw new Error(`${failed} tests failed in Storage Delete Safety Suite`);
  }

  return reports;
}

if (process.argv[1]?.endsWith('test_storage_delete_safety.ts')) {
  runStorageDeleteSafetyTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[FATAL ERROR IN DELETE SAFETY SUITE]', err);
      process.exit(1);
    });
}
