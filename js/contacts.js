/**
 * SheGuard - Trusted Emergency Contacts Management
 */
import { api } from './api.js';
import { confirmAction, showToast } from './ui.js';

export class ContactsService {
  async getContacts() {
    return api.get('/contacts');
  }

  async addContact(contactData) {
    return api.post('/contacts', {
      name: contactData.name,
      relationship: contactData.relationship,
      phoneNumber: contactData.phoneNumber,
      email: contactData.email || '',
      notifyOnSos: Boolean(contactData.notifyOnSos)
    });
  }

  async updateContact(id, contactData) {
    return api.patch(`/contacts/${encodeURIComponent(id)}`, contactData);
  }

  async deleteContact(id) {
    const confirmed = await confirmAction(
      'Delete Trusted Contact',
      'Are you sure you want to remove this emergency contact? They will not receive alerts during an SOS.',
      'Delete Contact',
      true
    );
    if (!confirmed) return false;

    await api.delete(`/contacts/${encodeURIComponent(id)}`);
    showToast('Contact removed.', 'info');
    return true;
  }
}

export const contactsService = new ContactsService();
