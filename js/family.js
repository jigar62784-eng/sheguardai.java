/**
 * SheGuard - Family Circle Invitations and Access Permissions
 * Triple-Layer Resilience: Spring Boot REST API -> Cloud Firestore -> LocalStorage Backup.
 */
import { api } from './api.js';
import { showToast, confirmAction, escapeHtml } from './ui.js';
import { db, auth, doc, setDoc, deleteDoc, getDocs, collection, query, where, updateDoc } from './firebase.js';

function getLocalFamily(uid) {
  try {
    const raw = localStorage.getItem(`sheguard_family_${uid}`);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveLocalFamily(uid, members) {
  try {
    localStorage.setItem(`sheguard_family_${uid}`, JSON.stringify(members));
  } catch (e) {
    console.warn('[Family] LocalStorage save warning:', e);
  }
}

function getLocalInvitations(uid, email = '') {
  try {
    const raw = localStorage.getItem(`sheguard_invitations_${uid}`);
    const data = raw ? JSON.parse(raw) : { incoming: [], outgoing: [] };

    // Cross-match invitations matching this user's email across localStorage
    if (email) {
      const lowerEmail = email.toLowerCase().trim();

      // Check current user's own invitations (e.g. self-invitations for testing)
      if (data && Array.isArray(data.outgoing)) {
        data.outgoing.forEach(outInv => {
          if (outInv.recipientEmail && outInv.recipientEmail.toLowerCase().trim() === lowerEmail && outInv.status === 'PENDING') {
            if (!data.incoming.some(inc => inc.id === outInv.id)) {
              data.incoming.push(outInv);
            }
          }
        });
      }

      // Check across other accounts stored in this browser
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('sheguard_invitations_')) {
          try {
            const otherData = JSON.parse(localStorage.getItem(key));
            if (otherData && Array.isArray(otherData.outgoing)) {
              otherData.outgoing.forEach(outInv => {
                if (outInv.recipientEmail && outInv.recipientEmail.toLowerCase().trim() === lowerEmail && outInv.status === 'PENDING') {
                  if (!data.incoming.some(inc => inc.id === outInv.id)) {
                    data.incoming.push(outInv);
                  }
                }
              });
            }
          } catch (err) {}
        }
      }
    }

    return data;
  } catch (e) {
    return { incoming: [], outgoing: [] };
  }
}

function saveLocalInvitations(uid, invitations) {
  try {
    localStorage.setItem(`sheguard_invitations_${uid}`, JSON.stringify(invitations));
  } catch (e) {
    console.warn('[Family] LocalStorage invitations save warning:', e);
  }
}

export class FamilyService {
  /**
   * Fetches all approved family members
   */
  async getFamilyMembers() {
    const uid = auth?.currentUser?.uid || 'guest';
    const local = getLocalFamily(uid);
    let list = [];

    try {
      list = await api.get('/family/members');
    } catch (apiErr) {
      if (db && auth && auth.currentUser) {
        try {
          const q = query(collection(db, 'family'), where('userUid', '==', auth.currentUser.uid));
          const snap = await getDocs(q);
          snap.forEach(d => list.push({ id: d.id, ...d.data() }));
        } catch (dbErr) {
          console.warn('[Family] Firestore query notice:', dbErr.message);
        }
      }
    }

    const combined = [...list];
    local.forEach(item => {
      if (!combined.some(m => m.id === item.id || m.memberId === item.memberId)) {
        combined.push(item);
      }
    });

    return combined;
  }

  /**
   * Fetches incoming and outgoing family invitations
   */
  async getInvitations() {
    const uid = auth?.currentUser?.uid || 'guest';
    const email = auth?.currentUser?.email || '';
    const local = getLocalInvitations(uid, email);
    let incoming = [];
    let outgoing = [];

    try {
      const res = await api.get('/family/invitations');
      incoming = (res && res.incoming) || [];
      outgoing = (res && res.outgoing) || [];
    } catch (apiErr) {
      if (db && auth && auth.currentUser) {
        try {
          const incomingQ = query(collection(db, 'invitations'), where('recipientEmail', '==', auth.currentUser.email));
          const outgoingQ = query(collection(db, 'invitations'), where('senderUid', '==', auth.currentUser.uid));

          const [inSnap, outSnap] = await Promise.all([getDocs(incomingQ), getDocs(outgoingQ)]);

          inSnap.forEach(d => {
            const data = d.data();
            if (data.status === 'PENDING') incoming.push({ id: d.id, ...data });
          });
          outSnap.forEach(d => {
            const data = d.data();
            outgoing.push({ id: d.id, ...data });
          });
        } catch (dbErr) {
          console.warn('[Family Invitations] Firestore query notice:', dbErr.message);
        }
      }
    }

    (local.incoming || []).forEach(item => {
      if (!incoming.some(i => i.id === item.id)) incoming.push(item);
    });
    (local.outgoing || []).forEach(item => {
      if (!outgoing.some(i => i.id === item.id)) outgoing.push(item);
    });

    return { incoming, outgoing };
  }

  /**
   * Sends an invitation to a family member by email
   */
  async sendInvitation(email, relationship = 'Family') {
    const uid = auth?.currentUser?.uid || 'guest';
    const invId = 'inv_' + Date.now();
    const inv = {
      id: invId,
      senderUid: uid,
      senderName: (auth?.currentUser && (auth.currentUser.displayName || auth.currentUser.email)) || 'User',
      senderEmail: (auth?.currentUser && auth.currentUser.email) || '',
      recipientEmail: email.trim().toLowerCase(),
      relationship,
      status: 'PENDING',
      createdAt: Date.now()
    };

    // Backup to local
    const local = getLocalInvitations(uid);
    local.outgoing = local.outgoing || [];
    local.outgoing.push(inv);
    saveLocalInvitations(uid, local);

    try {
      return await api.post('/family/invitations', { email, relationship });
    } catch (apiErr) {
      if (db && auth && auth.currentUser) {
        try {
          await setDoc(doc(db, 'invitations', invId), inv);
        } catch (e) {
          console.warn('[Family] Firestore permission notice (invitation saved locally):', e.message);
        }
        return inv;
      }
      return inv;
    }
  }

  /**
   * Accepts an incoming family invitation
   */
  async acceptInvitation(invitationId) {
    const uid = auth?.currentUser?.uid || 'guest';
    const email = auth?.currentUser?.email || '';
    const local = getLocalInvitations(uid, email);

    let senderEmail = 'Family Member';
    let relationship = 'Family';

    if (local.incoming) {
      const idx = local.incoming.findIndex(i => i.id === invitationId);
      if (idx !== -1) {
        const found = local.incoming[idx];
        senderEmail = found.senderEmail || found.senderName || senderEmail;
        relationship = found.relationship || relationship;
        local.incoming.splice(idx, 1);
        saveLocalInvitations(uid, local);
      }
    }

    // Add to connected family circle
    const myFam = getLocalFamily(uid);
    if (!myFam.some(f => f.email === senderEmail)) {
      myFam.push({
        id: 'fam_' + Date.now(),
        displayName: senderEmail.split('@')[0],
        email: senderEmail,
        relationship: relationship,
        canViewLocation: true,
        sharingStatus: 'ACTIVE'
      });
      saveLocalFamily(uid, myFam);
    }

    try {
      return await api.post(`/family/invitations/${encodeURIComponent(invitationId)}/accept`, {});
    } catch (apiErr) {
      if (db && auth && auth.currentUser) {
        try {
          await updateDoc(doc(db, 'invitations', invitationId), { status: 'ACCEPTED' });
          const famId = 'fam_' + Date.now();
          await setDoc(doc(db, 'family', famId), {
            userUid: auth.currentUser.uid,
            invitationId,
            status: 'ACTIVE',
            canViewLocation: true,
            createdAt: Date.now()
          });
        } catch (e) {
          console.warn('[Family] Firestore accept notice:', e.message);
        }
        return { success: true };
      }
      return { success: true };
    }
  }

  /**
   * Rejects an incoming family invitation
   */
  async rejectInvitation(invitationId) {
    const uid = auth?.currentUser?.uid || 'guest';
    const email = auth?.currentUser?.email || '';
    const local = getLocalInvitations(uid, email);
    if (local.incoming) {
      local.incoming = local.incoming.filter(i => i.id !== invitationId);
      saveLocalInvitations(uid, local);
    }

    try {
      return await api.delete(`/family/invitations/${encodeURIComponent(invitationId)}`);
    } catch (apiErr) {
      if (db) {
        try {
          await deleteDoc(doc(db, 'invitations', invitationId));
        } catch (e) {
          console.warn('[Family] Firestore delete notice:', e.message);
        }
        return { success: true };
      }
      return { success: true };
    }
  }

  /**
   * Revokes a family member connection
   */
  async removeMember(memberId) {
    const confirmed = await confirmAction(
      'Remove Family Member',
      'Are you sure you want to remove this person from your family circle? They will no longer be able to view your location or receive family alerts.',
      'Remove Member',
      true
    );
    if (!confirmed) return false;

    const uid = auth?.currentUser?.uid || 'guest';
    const local = getLocalFamily(uid).filter(m => m.id !== memberId && m.memberId !== memberId);
    saveLocalFamily(uid, local);

    try {
      await api.delete(`/family/members/${encodeURIComponent(memberId)}`);
    } catch (apiErr) {
      if (db) {
        try {
          await deleteDoc(doc(db, 'family', memberId));
        } catch (e) {
          console.warn('[Family] Firestore member delete notice:', e.message);
        }
      }
    }
    showToast('Family connection revoked.', 'info');
    return true;
  }

  /**
   * Toggles location sharing permission for a specific member
   */
  async toggleMemberLocationAccess(memberId, allowAccess) {
    try {
      return await api.patch(`/family/members/${encodeURIComponent(memberId)}/permissions`, {
        canViewLocation: allowAccess
      });
    } catch (apiErr) {
      if (db) {
        try {
          await updateDoc(doc(db, 'family', memberId), { canViewLocation: allowAccess });
        } catch (e) {
          console.warn('[Family] Firestore permission update notice:', e.message);
        }
        return { success: true };
      }
      return { success: true };
    }
  }
}

export const familyService = new FamilyService();
