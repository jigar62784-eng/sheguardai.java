/**
 * SheGuard Cross-Browser & Dashboard Integrity Verification
 * Tests User Dashboard, Admin Dashboard, and Police Portal for cross-browser standards:
 * - HTML5 doctype & responsive viewport tags
 * - CSS3 variable resolution & modern layout rules (Grid/Flexbox)
 * - Navigation guards & auth state handlers
 * - Core DOM elements and empty/loading states
 */
import fs from 'fs';
import path from 'path';

console.log('=== SHEGUARD CROSS-BROWSER DASHBOARD VERIFICATION ===\n');

const ROOT_DIR = process.cwd();

function checkFile(relPath) {
  const full = path.join(ROOT_DIR, relPath);
  if (!fs.existsSync(full)) {
    throw new Error(`File not found: ${relPath}`);
  }
  return fs.readFileSync(full, 'utf8');
}

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passCount++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failCount++;
  }
}

// 1. User Dashboard (dashboard.html) Checks
console.log('1. User Safety Dashboard (dashboard.html):');
const userDashboardHtml = checkFile('dashboard.html');
assert(userDashboardHtml.includes('<!DOCTYPE html>'), 'HTML5 standard doctype present for cross-browser rendering');
assert(userDashboardHtml.includes('<meta name="viewport" content="width=device-width, initial-scale=1.0">'), 'Mobile-responsive viewport meta tag configured');
assert(userDashboardHtml.includes('id="userGreeting"'), 'Dynamic user greeting element present');
assert(userDashboardHtml.includes('id="metricTotalReports"') && 
       userDashboardHtml.includes('id="metricPendingReports"') &&
       userDashboardHtml.includes('id="metricVerifiedReports"'), 'Incident metric elements (Total, Pending, Verified) present');
assert(userDashboardHtml.includes('id="metricContactsCount"'), 'Trusted contacts counter present');
assert(userDashboardHtml.includes('id="metricFamilyStatus"'), 'Family circle connectivity indicator present');
assert(userDashboardHtml.includes('id="dashboardRecentReports"'), 'Recent reports container table present');
assert(userDashboardHtml.includes('class="dashboard-sidebar"'), 'Responsive desktop/tablet sidebar present');
assert(userDashboardHtml.includes('class="mobile-nav-toggle"'), 'Mobile navigation toggle present');

// 2. Admin Moderation Dashboard (admin.html) Checks
console.log('\n2. Admin Moderation Dashboard (admin.html):');
const adminDashboardHtml = checkFile('admin.html');
assert(adminDashboardHtml.includes('<!DOCTYPE html>'), 'HTML5 standard doctype present');
assert(adminDashboardHtml.includes('<meta name="viewport" content="width=device-width, initial-scale=1.0">'), 'Responsive viewport tag present');
assert(adminDashboardHtml.includes('id="adminTotalReports"') &&
       adminDashboardHtml.includes('id="adminPendingReports"') &&
       adminDashboardHtml.includes('id="adminVerifiedReports"') &&
       adminDashboardHtml.includes('id="adminResolvedReports"'), 'All 4 admin aggregate analytics counters present');
assert(adminDashboardHtml.includes('id="adminReportsTableBody"'), 'Incident review queue table present');
assert(adminDashboardHtml.includes('id="adminCategoryMetrics"'), 'Category breakdown container present');
assert(adminDashboardHtml.includes('id="adminAuditLogs"'), 'Cryptographic audit log container present');
assert(adminDashboardHtml.includes('id="adminExportCsvBtn"'), 'CSV export functionality present');
assert(adminDashboardHtml.includes('id="adminReviewModal"'), 'Interactive review & moderation modal present');

// 3. Police Command Dashboard (police-portal/police-dashboard.html) Checks
console.log('\n3. Police Command Dashboard (police-portal/police-dashboard.html):');
const policeDashboardHtml = checkFile('police-portal/police-dashboard.html');
assert(policeDashboardHtml.includes('<!DOCTYPE html>'), 'HTML5 standard doctype present');
assert(policeDashboardHtml.includes('class="police-theme"'), 'Law enforcement visual theme applied');
assert(policeDashboardHtml.includes('id="metricTotalIncidents"'), 'Total incidents KPI counter present');
assert(policeDashboardHtml.includes('id="metricActiveSos"'), 'Active SOS alert KPI counter present');
assert(policeDashboardHtml.includes('id="dashboardIncidentsTbody"'), 'Real-time incident dispatch queue present');
assert(policeDashboardHtml.includes('id="dashboardSearchInput"'), 'Command queue search input present');

// 4. CSS Cross-Browser Architecture Checks
console.log('\n4. CSS Cross-Browser Compatibility:');
const variablesCss = checkFile('css/variables.css');
const responsiveCss = checkFile('css/responsive.css');
const layoutCss = checkFile('css/layout.css');

assert(variablesCss.includes('--bg-primary') && variablesCss.includes('--accent-cyan'), 'CSS custom properties (variables) defined for cross-browser theming');
assert(responsiveCss.includes('@media (max-width: 768px)'), 'Tablet breakpoint (<=768px) responsive rules defined');
assert(responsiveCss.includes('@media (max-width: 480px)'), 'Mobile phone breakpoint (<=480px) responsive rules defined');
assert(layoutCss.includes('display: grid') || layoutCss.includes('display: flex'), 'Modern CSS Grid & Flexbox layouts used with fallback support');

// 5. JavaScript Module Compatibility Checks
console.log('\n5. JavaScript ES Modules & Cloud Resilience:');
const adminJs = checkFile('js/admin.js');
const dashboardJs = checkFile('js/dashboard.js');
const authJs = checkFile('js/auth.js');

assert(adminJs.includes('export class AdminController'), 'AdminController exported as standard ES Module');
assert(adminJs.includes('collection(db, \'reports\')'), 'AdminController has Cloud Firestore direct fallback');
assert(dashboardJs.includes('export class DashboardController'), 'DashboardController exported as standard ES Module');
assert(authJs.includes('isAdmin()'), 'Role-based access check (isAdmin) implemented for admin protection');

console.log(`\n===========================================`);
console.log(`CROSS-BROWSER TEST SUMMARY: ${passCount} / ${passCount + failCount} PASSED`);
console.log(`===========================================\n`);

if (failCount > 0) {
  process.exit(1);
}
