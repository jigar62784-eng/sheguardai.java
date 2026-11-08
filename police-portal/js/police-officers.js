/**
 * SheGuard Law Enforcement Portal - Police Officers & Department Management
 * Architecture: FRONTEND 2 (Authorized Law Enforcement Roster & RBAC)
 */

import { policeAuth, PRE_AUTHORIZED_OFFICERS } from './police-auth.js';
import { showPoliceToast } from './police-guards.js';
import { policeApi } from './police-api.js';

export class PoliceOfficersController {
  constructor() {
    this.officers = [];
  }

  async init() {
    this.loadOfficers();
    this.bindEvents();
  }

  loadOfficers() {
    const stored = localStorage.getItem('sheguard_police_officers_registry');
    if (stored) {
      try {
        this.officers = JSON.parse(stored);
      } catch (e) {
        this.officers = [...PRE_AUTHORIZED_OFFICERS];
      }
    } else {
      this.officers = [...PRE_AUTHORIZED_OFFICERS];
      localStorage.setItem('sheguard_police_officers_registry', JSON.stringify(this.officers));
    }
    this.render();
  }

  saveOfficers() {
    localStorage.setItem('sheguard_police_officers_registry', JSON.stringify(this.officers));
    this.render();
  }

  bindEvents() {
    const addOfficerBtn = document.getElementById('openAddOfficerModalBtn');
    if (addOfficerBtn) {
      addOfficerBtn.addEventListener('click', () => {
        // Enforce admin check
        const current = policeAuth.getOfficer();
        if (!policeAuth.hasRole(['SUPER_ADMIN', 'POLICE_ADMIN'])) {
          showPoliceToast('Access Restricted: Only Police Admin or Super Admin can authorize new personnel.', 'danger');
          return;
        }
        document.getElementById('addOfficerModal').classList.add('open');
      });
    }

    const form = document.getElementById('addOfficerForm');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleAddOfficer();
      });
    }

    const closeBtn = document.getElementById('closeAddOfficerModalBtn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        document.getElementById('addOfficerModal').classList.remove('open');
      });
    }
  }

  render() {
    const tbody = document.getElementById('officersRosterTbody');
    if (!tbody) return;

    tbody.innerHTML = this.officers.map(o => {
      const roleBadgeClass = o.role === 'SUPER_ADMIN' ? 'badge-priority-critical' : (o.role === 'POLICE_ADMIN' ? 'badge-under-investigation' : 'badge-under-review');
      const isSuspended = o.status === 'SUSPENDED';

      return `
        <tr>
          <td>
            <strong style="font-family: var(--font-mono); color: var(--police-cyan);">${this.escape(o.badgeNumber)}</strong>
          </td>
          <td>
            <div style="font-weight: 600; color: #fff;">${this.escape(o.name)}</div>
            <div style="font-size: 11px; color: var(--police-text-muted);">${this.escape(o.email)}</div>
          </td>
          <td style="color: var(--police-text-secondary);">${this.escape(o.department)}</td>
          <td>
            <span style="font-size: 12px; font-weight: 500;">${this.escape(o.rank)}</span>
          </td>
          <td>
            <span class="police-badge ${roleBadgeClass}">${this.escape(o.role)}</span>
          </td>
          <td>
            <span class="police-badge ${isSuspended ? 'badge-rejected' : 'badge-verified'}">
              ${isSuspended ? 'SUSPENDED' : 'ACTIVE'}
            </span>
          </td>
          <td>
            <span style="font-family: var(--font-mono); font-weight: 600; color: #fff;">${o.assignedCasesCount || 0}</span>
          </td>
          <td>
            <button class="police-btn police-btn-secondary police-btn-sm toggle-status-btn" data-id="${this.escape(o.id)}">
              ${isSuspended ? 'Reactivate' : 'Suspend'}
            </button>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('.toggle-status-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        this.toggleOfficerStatus(id);
      });
    });
  }

  toggleOfficerStatus(officerId) {
    if (!policeAuth.hasRole(['SUPER_ADMIN', 'POLICE_ADMIN'])) {
      showPoliceToast('Access Restricted: Administrator privileges required to modify personnel status.', 'danger');
      return;
    }

    const idx = this.officers.findIndex(o => o.id === officerId);
    if (idx !== -1) {
      const next = this.officers[idx].status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED';
      this.officers[idx].status = next;
      this.saveOfficers();
      showPoliceToast(`Officer ${this.officers[idx].name} status updated to ${next}`, 'success');

      policeApi.recordAuditLog({
        action: `OFFICER_STATUS_${next}`,
        targetReference: officerId,
        details: `Personnel status toggled to ${next}`
      });
    }
  }

  handleAddOfficer() {
    const name = document.getElementById('newOfficerName').value.trim();
    const badge = document.getElementById('newOfficerBadge').value.trim();
    const email = document.getElementById('newOfficerEmail').value.trim().toLowerCase();
    const dept = document.getElementById('newOfficerDept').value;
    const rank = document.getElementById('newOfficerRank').value;
    const role = document.getElementById('newOfficerRole').value;

    if (!name || !badge || !email) {
      showPoliceToast('Please provide all mandatory personnel credentials.', 'warning');
      return;
    }

    const newOfficer = {
      id: `OFF-${Date.now().toString().slice(-4)}`,
      uid: `police-uid-${badge.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
      badgeNumber: badge,
      name,
      email,
      password: 'police@secure123',
      department: dept,
      rank,
      role,
      status: 'ACTIVE',
      assignedCasesCount: 0,
      createdAt: Date.now()
    };

    this.officers.push(newOfficer);
    this.saveOfficers();
    document.getElementById('addOfficerModal').classList.remove('open');
    document.getElementById('addOfficerForm').reset();
    showPoliceToast(`Officer ${name} successfully authorized into police roster.`, 'success');

    policeApi.recordAuditLog({
      action: 'OFFICER_AUTHORIZED',
      targetReference: badge,
      details: `New officer ${name} authorized with role ${role}`
    });
  }

  escape(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[m]);
  }
}
