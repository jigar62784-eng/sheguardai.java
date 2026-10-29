/**
 * SheGuard - Navigation Guards & Session-Aware Nav Updates
 */
import { authService } from './auth.js';
import { showToast } from './ui.js';

/**
 * Route Guard: Requires authenticated user
 */
export async function requireAuth(redirectUrl = 'login.html') {
  const user = await authService.waitForAuth();
  if (!user) {
    const currentUrl = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.replace(`${redirectUrl}?redirect=${currentUrl}`);
    return null;
  }
  return user;
}

/**
 * Route Guard: Requires non-authenticated (guest) user
 */
export async function requireGuest(redirectUrl = 'dashboard.html') {
  const user = await authService.waitForAuth();
  if (user) {
    window.location.replace(redirectUrl);
    return null;
  }
  return true;
}

/**
 * Route Guard: Requires user with ADMIN role
 */
export async function requireAdmin(redirectUrl = 'dashboard.html') {
  const user = await requireAuth();
  if (!user) return null;

  await authService.loadUserProfile();
  if (!authService.isAdmin()) {
    showToast('Access denied: Administrator privileges required.', 'danger');
    setTimeout(() => {
      window.location.replace(redirectUrl);
    }, 1500);
    return null;
  }
  return user;
}

/**
 * Dynamic Session-Aware Navigation Bar Synchronizer
 */
export function setupNavigation() {
  const navContainer = document.querySelector('.nav-container');
  if (!navContainer) return;

  // Setup mobile navigation toggle
  const mobileToggle = document.querySelector('.mobile-nav-toggle');
  const navLinks = document.querySelector('.nav-links');
  if (mobileToggle && navLinks) {
    mobileToggle.addEventListener('click', () => {
      const isExpanded = mobileToggle.getAttribute('aria-expanded') === 'true';
      mobileToggle.setAttribute('aria-expanded', !isExpanded);
      navLinks.classList.toggle('open');
    });
  }

  // Session-aware link adjustments
  authService.onAuthChange((user, profile) => {
    const navActions = document.querySelector('.nav-actions');
    const guestLinks = document.querySelectorAll('.nav-guest-only');
    const authLinks = document.querySelectorAll('.nav-auth-only');
    const adminLinks = document.querySelectorAll('.nav-admin-only');

    if (user) {
      guestLinks.forEach(el => el.style.display = 'none');
      authLinks.forEach(el => el.style.display = '');

      // Check admin status
      const isAdmin = authService.isAdmin();
      adminLinks.forEach(el => el.style.display = isAdmin ? '' : 'none');

      // Update Nav Actions
      if (navActions) {
        const displayName = (profile && profile.displayName) || user.displayName || user.email.split('@')[0];
        navActions.innerHTML = `
          <a href="emergency.html" class="sos-nav-btn" aria-label="Emergency SOS Alert">
            <span aria-hidden="true">🚨</span>
            <span>SOS</span>
          </a>
          <a href="settings.html" class="btn btn-secondary btn-sm" style="display: flex; align-items: center; gap: 6px;">
            <span aria-hidden="true">👤</span>
            <span>${escapeNavText(displayName)}</span>
          </a>
          <button id="navLogoutBtn" class="btn btn-outline btn-sm" aria-label="Sign out">
            <span>Log out</span>
          </button>
        `;

        document.getElementById('navLogoutBtn')?.addEventListener('click', async () => {
          try {
            await authService.logout();
            showToast('You have been logged out securely.', 'info');
            setTimeout(() => {
              window.location.href = 'index.html';
            }, 500);
          } catch (err) {
            showToast('Error during logout: ' + err.message, 'danger');
          }
        });
      }
    } else {
      guestLinks.forEach(el => el.style.display = '');
      authLinks.forEach(el => el.style.display = 'none');
      adminLinks.forEach(el => el.style.display = 'none');

      if (navActions) {
        navActions.innerHTML = `
          <a href="emergency.html" class="sos-nav-btn" aria-label="Emergency SOS Alert">
            <span aria-hidden="true">🚨</span>
            <span>SOS</span>
          </a>
          <a href="login.html" class="btn btn-secondary btn-sm">Log in</a>
          <a href="register.html" class="btn btn-primary btn-sm">Get Protected</a>
        `;
      }
    }
  });
}

function escapeNavText(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, '');
}

// Auto-run navigation setup on DOM load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupNavigation);
} else {
  setupNavigation();
}
