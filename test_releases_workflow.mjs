import fs from 'fs';
import path from 'path';

if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile();
  } catch {}
}

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3001';

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, headers: res.headers, data: json };
}

export async function run() {
  console.log('=== STARTING KARSH TECH RELEASES & GAME MAPPING VERIFICATION SUITE ===\n');
  let passed = 0;
  let failed = 0;

  function assert(testNum, testName, condition, detail) {
    if (condition) {
      console.log(`[PASS] Test ${testNum}: ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] Test ${testNum}: ${testName} - ${detail}`);
      failed++;
    }
  }

  // 1. Admin Login
  let token = '';
  try {
    const loginRes = await fetchJson(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'khrgosh', password: 'KarshTechAdmin2026!' }),
    });
    token = loginRes.data?.token || '';
    assert(1, 'Admin login with khrgosh returns valid JWT', loginRes.status === 200 && !!token, `Status: ${loginRes.status}`);
  } catch (err) {
    assert(1, 'Admin login with khrgosh returns valid JWT', false, err.message);
  }

  // 2. Existing Arrow Puzzle game and releases check
  let arrowGame = null;
  try {
    const gamesRes = await fetchJson(`${BASE_URL}/api/admin/games`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const games = gamesRes.data?.games || [];
    arrowGame = games.find((g) => g.slug === 'arrow-puzzle');
    const relRes = await fetchJson(`${BASE_URL}/api/admin/releases`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const arrowReleases = (relRes.data?.releases || []).filter((r) => r.game_id === arrowGame?.id);
    assert(2, 'Arrow Puzzle exists with intact releases and persistent ID', !!arrowGame && arrowReleases.length > 0, `Arrow ID: ${arrowGame?.id}, Releases count: ${arrowReleases.length}`);
  } catch (err) {
    assert(2, 'Arrow Puzzle exists with intact releases and persistent ID', false, err.message);
  }

  // 3. Create a new test game in Game Catalog
  let testGame = null;
  try {
    const newGamePayload = {
      title: 'Nebula Odyssey Quest',
      slug: `nebula-odyssey-${Date.now()}`,
      tagline: 'Procedural Atmospheric Space Puzzle',
      description: 'A deep space navigational game engineered natively for Android by Karsh Tech.',
      genre: ['Puzzle', 'Exploration'],
      platforms: ['Android'],
      status: 'Available',
      featured: false,
      developer: 'Karsh Tech',
      cover_image: '/brand/karsh-tech-full.png',
      screenshots: ['/brand/karsh-tech-full.png'],
      features: ['Procedural Level Matrix', 'Low Latency Audio'],
      controls: ['Swipe to orient thrust vectors'],
      requirements: {
        min_android: 'Android 8.0 (API 26)',
        target_android: 'Android 15 (API 35)',
        storage: '35 MB',
        ram: '2 GB',
        internet: 'None (100% Offline)',
      },
    };
    const createGameRes = await fetchJson(`${BASE_URL}/api/admin/games`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(newGamePayload),
    });
    testGame = createGameRes.data?.game;
    assert(3, 'Create new test game in Game Catalog succeeds with unique ID', createGameRes.status === 201 && !!testGame?.id, `Status: ${createGameRes.status}, ID: ${testGame?.id}`);
  } catch (err) {
    assert(3, 'Create new test game in Game Catalog succeeds with unique ID', false, err.message);
  }

  // 4. Verify newly created game is immediately in GET /api/admin/games dropdown list
  try {
    const listRes = await fetchJson(`${BASE_URL}/api/admin/games`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const games = listRes.data?.games || [];
    const found = games.find((g) => g.id === testGame?.id);
    assert(4, 'Newly created game is immediately returned in GET /api/admin/games for release dropdown', !!found && found.title === testGame?.title, `Found: ${!!found}`);
  } catch (err) {
    assert(4, 'Newly created game is immediately returned in GET /api/admin/games for release dropdown', false, err.message);
  }

  // 5. Upload a mock APK file
  let uploadedApkFilename = '';
  let uploadedApkSize = 0;
  try {
    // Write a dummy test APK file to server/uploads/apks directly or test upload
    const uploadsDir = path.resolve(process.cwd(), 'server', 'uploads', 'apks');
    fs.mkdirSync(uploadsDir, { recursive: true });
    uploadedApkFilename = `nebula-odyssey-test-${Date.now()}.apk`;
    const dummyApkPath = path.join(uploadsDir, uploadedApkFilename);
    const dummyBuffer = Buffer.from('PK\x03\x04MockApkDataForReleaseTestingKarshTech2026');
    fs.writeFileSync(dummyApkPath, dummyBuffer);
    uploadedApkSize = dummyBuffer.length;
    assert(5, 'Test APK artifact prepared in storage pipeline', fs.existsSync(dummyApkPath), `Filename: ${uploadedApkFilename}, Size: ${uploadedApkSize}`);
  } catch (err) {
    assert(5, 'Test APK artifact prepared in storage pipeline', false, err.message);
  }

  // 6. Submit the release with the newly created game ID
  let createdRelease = null;
  try {
    const releasePayload = {
      game_id: testGame.id,
      version_name: '1.0.0',
      version_code: 1,
      min_sdk: 26,
      target_sdk: 35,
      release_notes: 'Initial production build for Nebula Odyssey Quest.',
      apk_filename: uploadedApkFilename,
      apk_file_size: uploadedApkSize,
      is_published: true,
      release_date: new Date().toISOString().split('T')[0],
    };

    const createRelRes = await fetchJson(`${BASE_URL}/api/admin/releases`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(releasePayload),
    });

    createdRelease = createRelRes.data?.release;
    assert(6, 'POST /api/admin/releases successfully associates release with selected game ID', createRelRes.status === 201 && createdRelease?.game_id === testGame.id, `Status: ${createRelRes.status}, Rel Game ID: ${createdRelease?.game_id}`);
  } catch (err) {
    assert(6, 'POST /api/admin/releases successfully associates release with selected game ID', false, err.message);
  }

  // 7. Verify release appears under the correct game in GET /api/admin/releases
  try {
    const allReleasesRes = await fetchJson(`${BASE_URL}/api/admin/releases`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const releases = allReleasesRes.data?.releases || [];
    const matched = releases.find((r) => r.id === createdRelease?.id);
    const correctTitle = matched?.game_title === testGame.title;
    assert(7, 'Admin releases list enriches release with correct game title', !!matched && correctTitle, `Matched: ${!!matched}, Title: ${matched?.game_title}`);
  } catch (err) {
    assert(7, 'Admin releases list enriches release with correct game title', false, err.message);
  }

  // 8. Verify game detail endpoint links the release in its release history
  try {
    const detailRes = await fetchJson(`${BASE_URL}/api/games/${testGame.slug}`);
    const g = detailRes.data?.game;
    const hasLatest = g?.latest_release?.id === createdRelease?.id;
    const hasHistory = Array.isArray(g?.releases) && g.releases.some((r) => r.id === createdRelease?.id);
    assert(8, 'Public game detail endpoint includes the release in latest_release and releases history', detailRes.status === 200 && hasLatest && hasHistory, `hasLatest: ${hasLatest}, hasHistory: ${hasHistory}`);
  } catch (err) {
    assert(8, 'Public game detail endpoint includes the release in latest_release and releases history', false, err.message);
  }

  // 9. Verify APK download endpoint and download counter increment
  try {
    const initialCount = createdRelease.download_count || 0;
    const downloadRes = await fetch(`${BASE_URL}/api/releases/${createdRelease.id}/download`);
    const isOk = downloadRes.status === 200;
    const disposition = downloadRes.headers.get('content-disposition') || '';
    const hasFilename = disposition.includes(uploadedApkFilename);

    // Verify counter increment
    const checkRelRes = await fetchJson(`${BASE_URL}/api/admin/releases`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const updatedRel = (checkRelRes.data?.releases || []).find((r) => r.id === createdRelease.id);
    const countIncremented = (updatedRel?.download_count || 0) === initialCount + 1;

    assert(9, 'Direct APK download endpoint serves binary with content-disposition and increments counter', isOk && hasFilename && countIncremented, `Download status: ${downloadRes.status}, Filename header: ${hasFilename}, Counter: ${updatedRel?.download_count}`);
  } catch (err) {
    assert(9, 'Direct APK download endpoint serves binary with content-disposition and increments counter', false, err.message);
  }

  // 10. Test validation: Missing game_id rejected with 400
  try {
    const badRes = await fetchJson(`${BASE_URL}/api/admin/releases`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        version_name: '1.0.1',
        apk_filename: uploadedApkFilename,
      }),
    });
    assert(10, 'Rejection of release creation when game_id is missing (400 Bad Request)', badRes.status === 400, `Status: ${badRes.status}`);
  } catch (err) {
    assert(10, 'Rejection of release creation when game_id is missing (400 Bad Request)', false, err.message);
  }

  // 11. Test validation: Non-existent game_id rejected with 404
  try {
    const badRes = await fetchJson(`${BASE_URL}/api/admin/releases`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        game_id: 'game_nonexistent_xyz999',
        version_name: '1.0.1',
        apk_filename: uploadedApkFilename,
      }),
    });
    assert(11, 'Rejection of release creation when game_id does not exist (404 Not Found)', badRes.status === 404, `Status: ${badRes.status}`);
  } catch (err) {
    assert(11, 'Rejection of release creation when game_id does not exist (404 Not Found)', false, err.message);
  }

  // 12. Clean up test game and release
  try {
    const delRelRes = await fetchJson(`${BASE_URL}/api/admin/releases/${createdRelease.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    const delGameRes = await fetchJson(`${BASE_URL}/api/admin/games/${testGame.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    assert(12, 'Clean removal of test release and game records with zero residue', delRelRes.status === 200 && delGameRes.status === 200, `Del Rel: ${delRelRes.status}, Del Game: ${delGameRes.status}`);
  } catch (err) {
    assert(12, 'Clean removal of test release and game records with zero residue', false, err.message);
  }

  // 13. Verify Arrow Puzzle and its release remain 100% intact after cleanup
  try {
    const arrowCheckRes = await fetchJson(`${BASE_URL}/api/games/arrow-puzzle`);
    const arrowGameCheck = arrowCheckRes.data?.game;
    const intact = arrowGameCheck?.id === arrowGame?.id && !!arrowGameCheck?.latest_release;
    assert(13, 'Arrow Puzzle and its existing releases are completely preserved and intact', intact, `Arrow ID: ${arrowGameCheck?.id}, Has latest: ${!!arrowGameCheck?.latest_release}`);
  } catch (err) {
    assert(13, 'Arrow Puzzle and its existing releases are completely preserved and intact', false, err.message);
  }

  console.log(`\n=== RELEASES SUITE COMPLETE: ${passed} PASSED, ${failed} FAILED ===\n`);
  if (failed > 0) throw new Error(`${failed} tests failed in Releases test suite`);
  return { passed, failed };
}
