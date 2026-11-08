/**
 * SheGuard Law Enforcement Portal - Route Guards & Command Shell Injector
 * Architecture: FRONTEND 2 (Dedicated Navigation, Command Topbar & Guards)
 */

import { policeAuth } from './police-auth.js';
import { policeApi } from './police-api.js';

/**
 * Route Guard: Requires authenticated police personnel with role verification
 */
export function requirePoliceAuth(allowedRoles = null) {
  const officer = policeAuth.getOfficer();
  if (!officer) {
    const currentPath = encodeURIComponent(window.location.pathname);
    window.location.href = `police-login.html?redirect=${currentPath}`;
    return null;
  }

  if (allowedRoles) {
    const isAllowed = policeAuth.hasRole(allowedRoles);
    if (!isAllowed) {
      alert(`Access Restricted: This department module requires [${Array.isArray(allowedRoles) ? allowedRoles.join(', ') : allowedRoles}] authorization.`);
      window.location.href = 'police-dashboard.html';
      return null;
    }
  }

  return officer;
}

/**
 * Route Guard: Redirects authenticated officers from login page directly to dashboard
 */
export function requirePoliceGuest(redirectUrl = 'police-dashboard.html') {
  const officer = policeAuth.getOfficer();
  if (officer) {
    window.location.href = redirectUrl;
    return false;
  }
  return true;
}

/**
 * Injects Command Sidebar, Sticky Topbar, Live Military Clock, and SOS Ticker
 */
export function setupPoliceAppShell(activePage = 'dashboard') {
  const officer = policeAuth.getOfficer();
  if (!officer) return;

  // 1. Setup Live Clock
  startMilitaryClock();

  // 2. Setup SOS Ticker Polling
  checkActiveEmergencyAlerts();
  setInterval(checkActiveEmergencyAlerts, 15000);

  // 3. Highlight active nav link
  const currentNav = document.querySelector(`.police-nav-link[data-page="${activePage}"]`);
  if (currentNav) {
    currentNav.classList.add('active');
  }

  // 4. Bind Duty Status Toggle
  const dutyBtn = document.getElementById('topbarDutyToggle');
  if (dutyBtn) {
    updateDutyButtonUI(dutyBtn, officer.dutyStatus);
    dutyBtn.addEventListener('click', () => {
      const newStatus = policeAuth.toggleDutyStatus();
      updateDutyButtonUI(dutyBtn, newStatus);
      showPoliceToast(`Duty status updated to ${newStatus}`, newStatus === 'ON_DUTY' ? 'success' : 'warning');
    });
  }

  // 5. Bind Logout Button
  const logoutBtn = document.getElementById('topbarLogoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (confirm('Confirm Sign Out from Law Enforcement Command System?')) {
        policeAuth.logout();
      }
    });
  }

  // 6. Mobile Sidebar Toggle
  const mobileToggle = document.getElementById('policeMobileToggle');
  const sidebar = document.querySelector('.police-sidebar');
  if (mobileToggle && sidebar) {
    mobileToggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });
  }
}

function updateDutyButtonUI(btn, status) {
  if (status === 'ON_DUTY') {
    btn.className = 'police-duty-btn';
    btn.innerHTML = `<span class="police-status-indicator"></span><span>ON DUTY</span>`;
  } else {
    btn.className = 'police-duty-btn off-duty';
    btn.innerHTML = `<span style="width: 8px; height: 8px; border-radius: 50%; background: #64748B;"></span><span>OFF DUTY</span>`;
  }
}

function startMilitaryClock() {
  const clockEl = document.getElementById('topbarMilitaryClock');
  if (!clockEl) return;

  function update() {
    const now = new Date();
    const utcHours = String(now.getUTCHours()).padStart(2, '0');
    const utcMins = String(now.getUTCMinutes()).padStart(2, '0');
    const utcSecs = String(now.getUTCSeconds()).padStart(2, '0');

    const locHours = String(now.getHours()).padStart(2, '0');
    const locMins = String(now.getMinutes()).padStart(2, '0');
    const locSecs = String(now.getSeconds()).padStart(2, '0');

    clockEl.innerHTML = `<span>🕒 ${locHours}:${locMins}:${locSecs} LOCAL</span> <span style="opacity: 0.5;">|</span> <span>${utcHours}:${utcMins}:${utcSecs}Z</span>`;
  }

  update();
  setInterval(update, 1000);
}

async function checkActiveEmergencyAlerts() {
  const ticker = document.getElementById('policeEmergencyTicker');
  const navBadge = document.getElementById('navEmergencyCounter');

  try {
    const alerts = await policeApi.getEmergencyAlerts();
    const active = alerts.filter(a => a.status === 'SENT' || a.status === 'ACTIVE' || a.status === 'PENDING' || a.status === 'LOGGED_NO_CONTACTS');

    if (navBadge) {
      navBadge.textContent = active.length;
      if (active.length > 0) {
        navBadge.classList.add('alert-active');
      } else {
        navBadge.classList.remove('alert-active');
      }
    }

    if (ticker) {
      if (active.length > 0) {
        ticker.classList.add('visible');
        ticker.innerHTML = `
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 16px;">🚨</span>
            <span>TACTICAL SOS ALERT: ${active.length} active distress signal(s) require immediate field dispatch.</span>
          </div>
          <a href="police-emergency.html" class="police-btn police-btn-sm" style="background: #fff; color: #DC2626; font-weight: 700;">
            Open Tactical Monitor &rarr;
          </a>
        `;
      } else {
        ticker.classList.remove('visible');
      }
    }
  } catch (e) {
    // Silent fail on background ticker check
  }
}

/**
 * Tactical UI Toast
 */
export function showPoliceToast(message, type = 'info') {
  let container = document.getElementById('policeToastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'policeToastContainer';
    container.className = 'police-toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `police-toast ${type}`;
  
  const iconMap = {
    success: '✅',
    danger: '🚨',
    warning: '⚠️',
    info: 'ℹ️'
  };

  toast.innerHTML = `<span>${iconMap[type] || 'ℹ️'}</span><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.25s ease';
    setTimeout(() => toast.remove(), 250);
  }, 4000);
}
