/**
 * SheGuard - Trusted Emergency Contacts Management
 * Hybrid: Uses Spring Boot REST API with Cloud Firestore fallback for standalone cloud deployment.
 */
import { api } from './api.js';
import { confirmAction, showToast } from './ui.js';
import { db, auth, doc, setDoc, deleteDoc, collection, query, where, getDocs } from './firebase.js';

export class ContactsService {
  async getContacts() {
    try {
      return await api.get('/contacts');
    } catch (apiErr) {
      if (db && auth && auth.currentUser) {
        try {
          const q = query(collection(db, 'contacts'), where('userUid', '==', auth.currentUser.uid));
          const snap = await getDocs(q);
          const list = [];
          snap.forEach(d => list.push({ id: d.id, ...d.data() }));
          return list;
        } catch (e) {
          console.warn('[Contacts] Firestore query notice:', e);
        }
      }
      return [];
    }
  }

  async addContact(contactData) {
    try {
      return await api.post('/contacts', {
        name: contactData.name,
        relationship: contactData.relationship,
        phoneNumber: contactData.phoneNumber,
        email: contactData.email || '',
        notifyOnSos: Boolean(contactData.notifyOnSos)
      });
    } catch (apiErr) {
      if (db && auth && auth.currentUser) {
        const id = 'ct_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
        const contact = {
          id,
          userUid: auth.currentUser.uid,
          name: contactData.name,
          relationship: contactData.relationship,
          phoneNumber: contactData.phoneNumber,
          email: contactData.email || '',
          notifyOnSos: Boolean(contactData.notifyOnSos),
          createdAt: Date.now()
        };
        await setDoc(doc(db, 'contacts', id), contact);
        return contact;
      }
      throw apiErr;
    }
  }

  async updateContact(id, contactData) {
    try {
      return await api.patch(`/contacts/${encodeURIComponent(id)}`, contactData);
    } catch (apiErr) {
      if (db) {
        await setDoc(doc(db, 'contacts', id), contactData, { merge: true });
        return { id, ...contactData };
      }
      throw apiErr;
    }
  }

  async deleteContact(id) {
    const confirmed = await confirmAction(
      'Delete Trusted Contact',
      'Are you sure you want to remove this emergency contact? They will not receive alerts during an SOS.',
      'Delete Contact',
      true
    );
    if (!confirmed) return false;

    try {
      await api.delete(`/contacts/${encodeURIComponent(id)}`);
    } catch (apiErr) {
      if (db) {
        await deleteDoc(doc(db, 'contacts', id));
      }
    }

    showToast('Contact removed.', 'info');
    return true;
  }
}

export const contactsService = new ContactsService();
