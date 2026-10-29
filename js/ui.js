/**
 * SheGuard - Accessible UI Utilities
 */

// Toast container singleton
function getToastContainer() {
  let container = document.getElementById('sheguardToastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'sheguardToastContainer';
    container.className = 'toast-container';
    container.setAttribute('aria-live', 'polite');
    container.setAttribute('aria-atomic', 'true');
    document.body.appendChild(container);
  }
  return container;
}

/**
 * Displays an accessible toast notification
 */
export function showToast(message, type = 'info', duration = 4000) {
  const container = getToastContainer();
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', type === 'danger' ? 'alert' : 'status');

  const iconMap = {
    info: 'ℹ️',
    success: '✅',
    warning: '⚠️',
    danger: '🚨'
  };

  toast.innerHTML = `
    <span class="toast-icon" aria-hidden="true">${iconMap[type] || 'ℹ️'}</span>
    <div class="toast-content" style="flex: 1;">${escapeHtml(message)}</div>
    <button class="toast-close" aria-label="Close notification" style="color: var(--text-muted); padding: 2px 6px;">&times;</button>
  `;

  toast.querySelector('.toast-close').addEventListener('click', () => {
    toast.remove();
  });

  container.appendChild(toast);

  if (duration > 0) {
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }
}

/**
 * Escapes HTML characters to prevent XSS
 */
export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Opens an accessible modal
 */
export function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.classList.add('active');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';

  const firstFocusable = modal.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  if (firstFocusable) firstFocusable.focus();
}

/**
 * Closes a modal
 */
export function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.classList.remove('active');
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

/**
 * Promise-based confirmation dialog
 */
export function confirmAction(title, message, confirmBtnText = 'Confirm', isDanger = false) {
  return new Promise((resolve) => {
    let modal = document.getElementById('sheguardConfirmModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'sheguardConfirmModal';
      modal.className = 'modal-backdrop';
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="modal-dialog" style="max-width: 440px;">
        <div class="modal-header">
          <h3 class="modal-title">${escapeHtml(title)}</h3>
        </div>
        <div class="modal-body">
          <p>${escapeHtml(message)}</p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="confirmModalCancel">Cancel</button>
          <button class="btn ${isDanger ? 'btn-danger' : 'btn-primary'}" id="confirmModalConfirm">${escapeHtml(confirmBtnText)}</button>
        </div>
      </div>
    `;

    modal.classList.add('active');

    const handleConfirm = () => {
      cleanup();
      resolve(true);
    };

    const handleCancel = () => {
      cleanup();
      resolve(false);
    };

    const cleanup = () => {
      modal.classList.remove('active');
      modal.innerHTML = '';
    };

    modal.querySelector('#confirmModalConfirm').addEventListener('click', handleConfirm);
    modal.querySelector('#confirmModalCancel').addEventListener('click', handleCancel);
  });
}

/**
 * Standard Empty State renderer
 */
export function renderEmptyState(container, title, description, iconText = '📂', actionHtml = '') {
  if (typeof container === 'string') container = document.getElementById(container);
  if (!container) return;

  container.innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon" aria-hidden="true">${iconText}</div>
      <h3 class="empty-state-title">${escapeHtml(title)}</h3>
      <p class="empty-state-desc">${escapeHtml(description)}</p>
      ${actionHtml}
    </div>
  `;
}

/**
 * Format timestamps into localized date/time
 */
export function formatDateTime(dateInput) {
  if (!dateInput) return 'N/A';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return 'Invalid date';
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Format relative time (e.g. 5 minutes ago)
 */
export function timeAgo(dateInput) {
  if (!dateInput) return 'Unknown';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return 'Unknown';
  
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 30) return 'Just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
