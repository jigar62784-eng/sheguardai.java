/**
 * SheGuard - Trusted Emergency Contacts Management
 * Triple-Layer Resilience: Spring Boot REST API -> Cloud Firestore -> Local Storage Backup.
 */
import { api } from './api.js';
import { confirmAction, showToast } from './ui.js';
import { db, auth, doc, setDoc, deleteDoc, collection, query, where, getDocs } from './firebase.js';

function getLocalContacts(uid) {
  try {
    const raw = localStorage.getItem(`sheguard_contacts_${uid}`);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveLocalContacts(uid, contacts) {
  try {
    localStorage.setItem(`sheguard_contacts_${uid}`, JSON.stringify(contacts));
  } catch (e) {
    console.warn('[Contacts] LocalStorage save warning:', e);
  }
}

export class ContactsService {
  async getContacts() {
    const uid = auth?.currentUser?.uid || 'guest';
    const local = getLocalContacts(uid);
    let list = [];

    try {
      list = await api.get('/contacts');
    } catch (apiErr) {
      if (db && auth && auth.currentUser) {
        try {
          const q = query(collection(db, 'contacts'), where('userUid', '==', auth.currentUser.uid));
          const snap = await getDocs(q);
          snap.forEach(d => list.push({ id: d.id, ...d.data() }));
        } catch (e) {
          console.warn('[Contacts] Firestore query notice (using local cache):', e.message);
        }
      }
    }

    // Merge API/Firestore results with local contacts
    const combined = [...list];
    local.forEach(item => {
      if (!combined.some(c => c.id === item.id || (c.phoneNumber && c.phoneNumber === item.phoneNumber))) {
        combined.push(item);
      }
    });

    return combined;
  }

  async addContact(contactData) {
    const uid = auth?.currentUser?.uid || 'guest';
    const id = 'ct_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    const contact = {
      id,
      userUid: uid,
      name: contactData.name,
      relationship: contactData.relationship,
      phoneNumber: contactData.phoneNumber,
      email: contactData.email || '',
      notifyOnSos: Boolean(contactData.notifyOnSos),
      createdAt: Date.now()
    };

    // 1. Immediately persist to LocalStorage backup so contacts are never lost
    const local = getLocalContacts(uid);
    local.push(contact);
    saveLocalContacts(uid, local);

    // 2. Try REST API
    try {
      return await api.post('/contacts', {
        name: contactData.name,
        relationship: contactData.relationship,
        phoneNumber: contactData.phoneNumber,
        email: contactData.email || '',
        notifyOnSos: Boolean(contactData.notifyOnSos)
      });
    } catch (apiErr) {
      // 3. Fallback to Cloud Firestore
      if (db && auth && auth.currentUser) {
        try {
          await setDoc(doc(db, 'contacts', id), contact);
        } catch (firestoreErr) {
          console.warn('[Contacts] Firestore permissions notice (contact safely stored in local browser):', firestoreErr.message);
        }
      }
      return contact;
    }
  }

  async updateContact(id, contactData) {
    const uid = auth?.currentUser?.uid || 'guest';
    const local = getLocalContacts(uid);
    const idx = local.findIndex(c => c.id === id);
    if (idx !== -1) {
      local[idx] = { ...local[idx], ...contactData };
      saveLocalContacts(uid, local);
    }

    try {
      return await api.patch(`/contacts/${encodeURIComponent(id)}`, contactData);
    } catch (apiErr) {
      if (db) {
        try {
          await setDoc(doc(db, 'contacts', id), contactData, { merge: true });
        } catch (e) {
          console.warn('[Contacts] Firestore update notice:', e.message);
        }
      }
      return { id, ...contactData };
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

    const uid = auth?.currentUser?.uid || 'guest';
    const local = getLocalContacts(uid).filter(c => c.id !== id);
    saveLocalContacts(uid, local);

    try {
      await api.delete(`/contacts/${encodeURIComponent(id)}`);
    } catch (apiErr) {
      if (db) {
        try {
          await deleteDoc(doc(db, 'contacts', id));
        } catch (e) {
          console.warn('[Contacts] Firestore delete notice:', e.message);
        }
      }
    }

    showToast('Contact removed.', 'info');
    return true;
  }
}

export const contactsService = new ContactsService();
