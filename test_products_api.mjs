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
  console.log('=== STARTING KARSH TECH PRODUCTS API VERIFICATION SUITE ===\n');
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

  // 1. Public GET /api/products
  try {
    const res = await fetchJson(`${BASE_URL}/api/products`);
    const productsList = res.data?.products || [];
    const isArray = Array.isArray(productsList);
    const hasArrow = isArray && productsList.some((p) => p.slug === 'arrow-puzzle' && p.category === 'Games');
    const hasPlatform = isArray && productsList.some((p) => p.slug === 'karsh-tech-platform' && p.category === 'Web Applications');
    assert(1, 'GET /api/products returns array with bridged games & products', res.status === 200 && hasArrow && hasPlatform, `Status: ${res.status}, hasArrow: ${hasArrow}, hasPlatform: ${hasPlatform}`);
  } catch (err) {
    assert(1, 'GET /api/products returns array with bridged games & products', false, err.message);
  }

  // 2. Public Category Filtering
  try {
    const resGames = await fetchJson(`${BASE_URL}/api/products?category=Games`);
    const gamesList = resGames.data?.products || [];
    const allGames = Array.isArray(gamesList) && gamesList.length > 0 && gamesList.every((p) => p.category === 'Games');
    const resWeb = await fetchJson(`${BASE_URL}/api/products?category=Web Applications`);
    const webList = resWeb.data?.products || [];
    const allWeb = Array.isArray(webList) && webList.length > 0 && webList.every((p) => p.category === 'Web Applications');
    assert(2, 'Category filter returns category-specific products', resGames.status === 200 && allGames && allWeb, `allGames: ${allGames}, allWeb: ${allWeb}`);
  } catch (err) {
    assert(2, 'Category filter returns category-specific products', false, err.message);
  }

  // 3. Public GET /api/products/:slug for game and product
  try {
    const resGame = await fetchJson(`${BASE_URL}/api/products/arrow-puzzle`);
    const resProd = await fetchJson(`${BASE_URL}/api/products/karsh-tech-platform`);
    const gameOk = resGame.status === 200 && resGame.data?.product?.name === 'Arrow Puzzle';
    const prodOk = resProd.status === 200 && resProd.data?.product?.slug === 'karsh-tech-platform';
    assert(3, 'GET /api/products/:slug resolves both bridged game and native product', gameOk && prodOk, `gameOk: ${gameOk}, prodOk: ${prodOk}`);
  } catch (err) {
    assert(3, 'GET /api/products/:slug resolves both bridged game and native product', false, err.message);
  }

  // 4. Admin Auth Protection for Products API
  try {
    const resNoToken = await fetchJson(`${BASE_URL}/api/admin/products`);
    const resPostNoToken = await fetchJson(`${BASE_URL}/api/admin/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test Product' }),
    });
    assert(4, 'Admin products routes reject unauthenticated requests with 401', resNoToken.status === 401 && resPostNoToken.status === 401, `GET: ${resNoToken.status}, POST: ${resPostNoToken.status}`);
  } catch (err) {
    assert(4, 'Admin products routes reject unauthenticated requests with 401', false, err.message);
  }

  // 5. Admin Login with khrgosh
  let token = '';
  try {
    const loginRes = await fetchJson(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'khrgosh', password: 'KarshTechAdmin2026!' }),
    });
    token = loginRes.data?.token || '';
    assert(5, 'Admin login with khrgosh returns valid JWT', loginRes.status === 200 && !!token, `Status: ${loginRes.status}`);
  } catch (err) {
    assert(5, 'Admin login with khrgosh returns valid JWT', false, err.message);
  }

  // 6. Admin GET /api/admin/products
  try {
    const res = await fetchJson(`${BASE_URL}/api/admin/products`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const productsList = res.data?.products || [];
    assert(6, 'Admin GET /api/admin/products succeeds with Bearer token', res.status === 200 && Array.isArray(productsList), `Status: ${res.status}`);
  } catch (err) {
    assert(6, 'Admin GET /api/admin/products succeeds with Bearer token', false, err.message);
  }

  // 7. Admin POST /api/admin/products (Create draft)
  let createdProductId = '';
  try {
    const res = await fetchJson(`${BASE_URL}/api/admin/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: 'Automated Test Tool',
        category: 'Custom Software',
        platform: 'Desktop',
        short_description: 'An internal test utility suite',
        description: 'Detailed description for test utility suite engineered by Karsh Tech.',
        technologies: ['Node.js', 'TypeScript', 'Jest'],
        status: 'Draft',
        featured: false,
        display_order: 10,
      }),
    });
    createdProductId = res.data?.product?.id || '';
    const slug = res.data?.product?.slug;
    assert(7, 'Admin POST /api/admin/products creates product record with auto-slug', res.status === 201 && !!createdProductId && slug === 'automated-test-tool', `Status: ${res.status}, ID: ${createdProductId}, slug: ${slug}`);
  } catch (err) {
    assert(7, 'Admin POST /api/admin/products creates product record with auto-slug', false, err.message);
  }

  // 8. Verify draft is not public
  try {
    const res = await fetchJson(`${BASE_URL}/api/products/automated-test-tool`);
    assert(8, 'Draft product is NOT publicly accessible via GET /api/products/:slug', res.status === 404, `Status: ${res.status}`);
  } catch (err) {
    assert(8, 'Draft product is NOT publicly accessible via GET /api/products/:slug', false, err.message);
  }

  // 9. PATCH /api/admin/products/:id/status (Publish product)
  try {
    const res = await fetchJson(`${BASE_URL}/api/admin/products/${createdProductId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status: 'Published' }),
    });
    assert(9, 'PATCH status updates product to Published', res.status === 200 && res.data?.product?.status === 'Published', `Status: ${res.status}`);
  } catch (err) {
    assert(9, 'PATCH status updates product to Published', false, err.message);
  }

  // 10. Verify published product is now publicly accessible
  try {
    const res = await fetchJson(`${BASE_URL}/api/products/automated-test-tool`);
    assert(10, 'Published product IS publicly accessible', res.status === 200 && res.data?.product?.name === 'Automated Test Tool', `Status: ${res.status}`);
  } catch (err) {
    assert(10, 'Published product IS publicly accessible', false, err.message);
  }

  // 11. PATCH /api/admin/products/:id/featured
  try {
    const res = await fetchJson(`${BASE_URL}/api/admin/products/${createdProductId}/featured`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ featured: true }),
    });
    assert(11, 'PATCH featured updates product featured flag', res.status === 200 && res.data?.product?.featured === true, `Status: ${res.status}`);
  } catch (err) {
    assert(11, 'PATCH featured updates product featured flag', false, err.message);
  }

  // 12. PUT /api/admin/products/:id (Update product)
  try {
    const res = await fetchJson(`${BASE_URL}/api/admin/products/${createdProductId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: 'Automated Test Tool Pro',
        technologies: ['Node.js', 'TypeScript', 'Jest', 'Docker'],
      }),
    });
    assert(12, 'PUT /api/admin/products/:id updates product fields', res.status === 200 && res.data?.product?.name === 'Automated Test Tool Pro' && res.data?.product?.technologies.includes('Docker'), `Status: ${res.status}`);
  } catch (err) {
    assert(12, 'PUT /api/admin/products/:id updates product fields', false, err.message);
  }

  // 13. DELETE /api/admin/products/:id
  try {
    const res = await fetchJson(`${BASE_URL}/api/admin/products/${createdProductId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    const verifyRes = await fetchJson(`${BASE_URL}/api/products/automated-test-tool`);
    assert(13, 'DELETE /api/admin/products/:id removes product cleanly', res.status === 200 && verifyRes.status === 404, `Delete Status: ${res.status}, Verify Status: ${verifyRes.status}`);
  } catch (err) {
    assert(13, 'DELETE /api/admin/products/:id removes product cleanly', false, err.message);
  }

  // 14. Verify Stats include product telemetry
  try {
    const res = await fetchJson(`${BASE_URL}/api/admin/stats`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const s = res.data?.stats;
    const hasProductStats = typeof s?.total_products === 'number' && typeof s?.published_products === 'number';
    assert(14, 'Admin stats telemetry includes total_products and published_products', res.status === 200 && hasProductStats, `total_products: ${s?.total_products}`);
  } catch (err) {
    assert(14, 'Admin stats telemetry includes total_products and published_products', false, err.message);
  }

  console.log(`\n=== SUITE COMPLETE: ${passed} PASSED, ${failed} FAILED ===\n`);
  if (failed > 0) throw new Error(`${failed} tests failed in Products test suite`);
  return { passed, failed };
}
