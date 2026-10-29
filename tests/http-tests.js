/**
 * Automated HTTP Server & Web Endpoint Probe Test
 */
import http from 'node:http';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const TEST_PORT = 5599;

console.log('=== STARTING HTTP INTEGRATION TEST ===\n');

const serverProcess = spawn('node', [path.join(rootDir, 'scripts', 'dev-server.js'), String(TEST_PORT)], {
  cwd: rootDir,
  stdio: 'inherit'
});

// Wait for server to boot
await new Promise(resolve => setTimeout(resolve, 800));

function fetchEndpoint(urlPath) {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${TEST_PORT}${urlPath}`, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    }).on('error', (err) => {
      reject(new Error(`${err.code || err.message}`));
    });
  });
}

const endpointsToTest = [
  { path: '/', expectedStatus: 200, contentType: 'text/html' },
  { path: '/index.html', expectedStatus: 200, contentType: 'text/html' },
  { path: '/login.html', expectedStatus: 200, contentType: 'text/html' },
  { path: '/register.html', expectedStatus: 200, contentType: 'text/html' },
  { path: '/forgot-password.html', expectedStatus: 200, contentType: 'text/html' },
  { path: '/verify-email.html', expectedStatus: 200, contentType: 'text/html' },
  { path: '/dashboard.html', expectedStatus: 200, contentType: 'text/html' },
  { path: '/report-incident.html', expectedStatus: 200, contentType: 'text/html' },
  { path: '/my-reports.html', expectedStatus: 200, contentType: 'text/html' },
  { path: '/safety-map.html', expectedStatus: 200, contentType: 'text/html' },
  { path: '/family-locator.html', expectedStatus: 200, contentType: 'text/html' },
  { path: '/family.html', expectedStatus: 200, contentType: 'text/html' },
  { path: '/emergency.html', expectedStatus: 200, contentType: 'text/html' },
  { path: '/trusted-contacts.html', expectedStatus: 200, contentType: 'text/html' },
  { path: '/admin.html', expectedStatus: 200, contentType: 'text/html' },
  { path: '/settings.html', expectedStatus: 200, contentType: 'text/html' },
  // CSS files
  { path: '/css/variables.css', expectedStatus: 200, contentType: 'text/css' },
  { path: '/css/base.css', expectedStatus: 200, contentType: 'text/css' },
  { path: '/css/layout.css', expectedStatus: 200, contentType: 'text/css' },
  { path: '/css/components.css', expectedStatus: 200, contentType: 'text/css' },
  { path: '/css/responsive.css', expectedStatus: 200, contentType: 'text/css' },
  { path: '/css/pages.css', expectedStatus: 200, contentType: 'text/css' },
  // Key JavaScript modules
  { path: '/js/guards.js', expectedStatus: 200, contentType: 'application/javascript' },
  { path: '/js/auth.js', expectedStatus: 200, contentType: 'application/javascript' },
  { path: '/js/distance.js', expectedStatus: 200, contentType: 'application/javascript' },
  { path: '/js/family-locator.js', expectedStatus: 200, contentType: 'application/javascript' },
  { path: '/js/emergency.js', expectedStatus: 200, contentType: 'application/javascript' },
  { path: '/js/api.js', expectedStatus: 200, contentType: 'application/javascript' },
  // 404 test
  { path: '/non-existent-page-xyz.html', expectedStatus: 404, contentType: 'text/html' }
];

let failed = 0;

for (const ep of endpointsToTest) {
  try {
    const res = await fetchEndpoint(ep.path);
    const ct = res.headers['content-type'] || '';
    if (res.status === ep.expectedStatus && ct.includes(ep.contentType)) {
      console.log(`  ✓ [HTTP ${res.status}] ${ep.path} (Content-Type: ${ct})`);
    } else {
      console.error(`  ✗ FAIL ${ep.path}: Expected ${ep.expectedStatus} with ${ep.contentType}, got ${res.status} with ${ct}`);
      failed++;
    }
  } catch (err) {
    console.error(`  ✗ FAIL ${ep.path}: Request error: ${err.message}`);
    failed++;
  }
}

serverProcess.kill('SIGTERM');

console.log(`\n===========================================`);
console.log(`HTTP TEST RESULTS: ${endpointsToTest.length - failed} / ${endpointsToTest.length} PASSED`);
console.log(`===========================================\n`);

if (failed > 0) {
  process.exit(1);
}
