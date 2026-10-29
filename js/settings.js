/**
 * SheGuard - User Account, Privacy, & Location-Sharing Settings Controller
 */
import { api } from './api.js';
import { authService } from './auth.js';
import { showToast, confirmAction, escapeHtml } from './ui.js';

export class SettingsController {
  constructor() {
    this.profile = null;
  }

  async init() {
    const user = await authService.waitForAuth();
    if (!user) return;

    this.profile = await authService.loadUserProfile();
    this.populateForm();
  }

  populateForm() {
    if (!this.profile) return;

    const nameInput = document.getElementById('settingsDisplayName');
    const phoneInput = document.getElementById('settingsPhone');
    const emailInput = document.getElementById('settingsEmail');
    const medicalInput = document.getElementById('settingsMedicalNotes');
    const locationSharingToggle = document.getElementById('settingsLocationSharing');
    const emailNotifToggle = document.getElementById('settingsEmailNotif');

    if (nameInput) nameInput.value = this.profile.displayName || '';
    if (phoneInput) phoneInput.value = this.profile.phoneNumber || '';
    if (emailInput) emailInput.value = this.profile.email || '';
    if (medicalInput) medicalInput.value = this.profile.emergencyMedicalNotes || '';
    if (locationSharingToggle) locationSharingToggle.checked = this.profile.locationSharingEnabled !== false;
    if (emailNotifToggle) emailNotifToggle.checked = this.profile.emailNotificationsEnabled !== false;
  }

  /**
   * Saves updated profile fields
   */
  async saveProfile(e) {
    if (e) e.preventDefault();

    const displayName = document.getElementById('settingsDisplayName')?.value?.trim();
    const phoneNumber = document.getElementById('settingsPhone')?.value?.trim();
    const emergencyMedicalNotes = document.getElementById('settingsMedicalNotes')?.value?.trim();
    const locationSharingEnabled = document.getElementById('settingsLocationSharing')?.checked;
    const emailNotificationsEnabled = document.getElementById('settingsEmailNotif')?.checked;

    try {
      const updated = await api.patch('/profile', {
        displayName,
        phoneNumber,
        emergencyMedicalNotes,
        locationSharingEnabled,
        emailNotificationsEnabled
      });

      this.profile = updated;
      showToast('Settings saved successfully.', 'success');
    } catch (err) {
      showToast('Failed to save settings: ' + err.message, 'danger');
    }
  }

  /**
   * Toggles master location sharing status
   */
  async toggleMasterLocationSharing(enabled) {
    try {
      if (enabled) {
        await api.post('/locations/share/enable', {});
        showToast('Live family location sharing enabled.', 'success');
      } else {
        await api.delete('/locations/share');
        showToast('Location sharing stopped.', 'info');
      }
    } catch (err) {
      showToast('Failed to update location sharing status: ' + err.message, 'danger');
    }
  }

  /**
   * Requests data export archive
   */
  async exportUserData() {
    try {
      const data = await api.get('/profile/export');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sheguard_my_data_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Your personal data archive has been exported.', 'success');
    } catch (err) {
      showToast('Export failed: ' + err.message, 'danger');
    }
  }

  /**
   * Initiates account deletion request
   */
  async deleteAccount() {
    const confirmed = await confirmAction(
      'Permanent Account Deletion',
      'Are you completely sure? This will permanently delete your SheGuard account, personal profile, and revoke all family links. This action CANNOT be undone.',
      'Permanently Delete My Account',
      true
    );

    if (!confirmed) return;

    try {
      await api.delete('/profile');
      await authService.logout();
      showToast('Your account has been deleted.', 'info');
      setTimeout(() => {
        window.location.href = 'index.html';
      }, 1000);
    } catch (err) {
      showToast('Failed to delete account: ' + err.message, 'danger');
    }
  }
}

export const settingsController = new SettingsController();
