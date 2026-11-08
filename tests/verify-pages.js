/**
 * Verification script for all HTML pages and assets across TWO FRONTEND APPLICATIONS:
 * - Frontend 1: User Portal (Root)
 * - Frontend 2: Police Portal (police-portal/)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const policeDir = path.join(rootDir, 'police-portal');

const userHtmlFiles = [
  'index.html',
  'login.html',
  'register.html',
  'forgot-password.html',
  'verify-email.html',
  'dashboard.html',
  'report-incident.html',
  'my-reports.html',
  'safety-map.html',
  'family-locator.html',
  'family.html',
  'emergency.html',
  'trusted-contacts.html',
  'admin.html',
  'settings.html'
];

const policeHtmlFiles = [
  'index.html',
  'police-login.html',
  'police-dashboard.html',
  'police-reports.html',
  'police-investigation.html',
  'police-incident-map.html',
  'police-emergency.html',
  'police-analytics.html',
  'police-officers.html',
  'police-audit-logs.html',
  'police-settings.html'
];

console.log('=== VERIFYING FRONTEND 1: USER PORTAL ASSETS & PAGES ===\n');

let issues = 0;

for (const file of userHtmlFiles) {
  const filePath = path.join(rootDir, file);
  if (!fs.existsSync(filePath)) {
    console.error(`✗ Missing User HTML file: ${file}`);
    issues++;
    continue;
  }

  const content = fs.readFileSync(filePath, 'utf-8');

  // Check CSS links
  const cssMatches = [...content.matchAll(/href=["'](css\/[^"']+)["']/g)];
  for (const match of cssMatches) {
    const cssRelPath = match[1];
    const cssFullPath = path.join(rootDir, cssRelPath);
    if (!fs.existsSync(cssFullPath)) {
      console.error(`✗ In ${file}: CSS file not found: ${cssRelPath}`);
      issues++;
    }
  }

  // Check local script src
  const jsMatches = [...content.matchAll(/src=["'](js\/[^"']+)["']/g)];
  for (const match of jsMatches) {
    const jsRelPath = match[1];
    const jsFullPath = path.join(rootDir, jsRelPath);
    if (!fs.existsSync(jsFullPath)) {
      console.error(`✗ In ${file}: JS file not found: ${jsRelPath}`);
      issues++;
    }
  }

  // Check module imports in inline scripts
  const importMatches = [...content.matchAll(/import\s+.*?from\s+["'](\.[^"']+)["']/g)];
  for (const match of importMatches) {
    const importRel = match[1];
    const importFullPath = path.resolve(rootDir, importRel);
    if (!fs.existsSync(importFullPath)) {
      console.error(`✗ In ${file}: imported module not found: ${importRel} (resolved to ${importFullPath})`);
      issues++;
    }
  }

  console.log(`✓ ${file} verified (${cssMatches.length} stylesheets, ${jsMatches.length + importMatches.length} script imports)`);
}

console.log('\n=== VERIFYING FRONTEND 2: POLICE / ADMIN PORTAL ASSETS & PAGES ===\n');

for (const file of policeHtmlFiles) {
  const filePath = path.join(policeDir, file);
  if (!fs.existsSync(filePath)) {
    console.error(`✗ Missing Police HTML file: police-portal/${file}`);
    issues++;
    continue;
  }

  const content = fs.readFileSync(filePath, 'utf-8');

  // Check CSS links
  const cssMatches = [...content.matchAll(/href=["'](css\/[^"']+)["']/g)];
  for (const match of cssMatches) {
    const cssRelPath = match[1];
    const cssFullPath = path.join(policeDir, cssRelPath);
    if (!fs.existsSync(cssFullPath)) {
      console.error(`✗ In police-portal/${file}: CSS file not found: ${cssRelPath}`);
      issues++;
    }
  }

  // Check local script imports
  const importMatches = [...content.matchAll(/import\s+.*?from\s+["'](\.[^"']+)["']/g)];
  for (const match of importMatches) {
    const importRel = match[1];
    const importFullPath = path.resolve(policeDir, importRel);
    if (!fs.existsSync(importFullPath)) {
      console.error(`✗ In police-portal/${file}: imported module not found: ${importRel} (resolved to ${importFullPath})`);
      issues++;
    }
  }

  console.log(`✓ police-portal/${file} verified (${cssMatches.length} stylesheets, ${importMatches.length} script imports)`);
}

// Check imports inside js/ files
const jsDir = path.join(rootDir, 'js');
const jsFiles = fs.readdirSync(jsDir).filter(f => f.endsWith('.js'));

console.log('\n=== VERIFYING INTERNAL MODULE IMPORTS IN js/ ===');
for (const file of jsFiles) {
  const content = fs.readFileSync(path.join(jsDir, file), 'utf-8');
  const internalImports = [...content.matchAll(/from\s+["'](\.\/[^"']+)["']/g)];
  for (const match of internalImports) {
    const targetRel = match[1].replace('./', '');
    const targetFullPath = path.join(jsDir, targetRel);
    if (!fs.existsSync(targetFullPath)) {
      console.error(`✗ In js/${file}: imported internal file not found: ${targetRel}`);
      issues++;
    }
  }
}

// Check imports inside police-portal/js/ files
const policeJsDir = path.join(policeDir, 'js');
const policeJsFiles = fs.readdirSync(policeJsDir).filter(f => f.endsWith('.js'));

console.log('\n=== VERIFYING INTERNAL MODULE IMPORTS IN police-portal/js/ ===');
for (const file of policeJsFiles) {
  const content = fs.readFileSync(path.join(policeJsDir, file), 'utf-8');
  const internalImports = [...content.matchAll(/from\s+["'](\.\/[^"']+|\.\.\/[^"']+)["']/g)];
  for (const match of internalImports) {
    const targetRel = match[1];
    const targetFullPath = path.resolve(policeJsDir, targetRel);
    if (!fs.existsSync(targetFullPath)) {
      console.error(`✗ In police-portal/js/${file}: imported file not found: ${targetRel} (${targetFullPath})`);
      issues++;
    }
  }
}

console.log(`\n===========================================`);
if (issues === 0) {
  console.log('ALL 25 HTML PAGES & JAVASCRIPT MODULES HAVE 100% VALID ASSET PATHS!');
} else {
  console.error(`FOUND ${issues} MISSING ASSET OR IMPORT ISSUES.`);
  process.exit(1);
}
console.log(`===========================================\n`);
