/**
 * SheGuard - Family Circle Invitations and Access Permissions
 * Hybrid: Uses Spring Boot REST API with Cloud Firestore fallback for standalone cloud deployment.
 */
import { api } from './api.js';
import { showToast, confirmAction, escapeHtml } from './ui.js';
import { db, auth, doc, setDoc, deleteDoc, getDocs, collection, query, where, updateDoc } from './firebase.js';

export class FamilyService {
  /**
   * Fetches all approved family members
   */
  async getFamilyMembers() {
    try {
      return await api.get('/family/members');
    } catch (apiErr) {
      if (db && auth && auth.currentUser) {
        try {
          const q = query(collection(db, 'family'), where('userUid', '==', auth.currentUser.uid));
          const snap = await getDocs(q);
          const list = [];
          snap.forEach(d => list.push({ id: d.id, ...d.data() }));
          return list;
        } catch (dbErr) {
          console.warn('[Family] Firestore query notice:', dbErr);
        }
      }
      return [];
    }
  }

  /**
   * Fetches incoming and outgoing family invitations
   */
  async getInvitations() {
    try {
      return await api.get('/family/invitations');
    } catch (apiErr) {
      if (db && auth && auth.currentUser) {
        try {
          const incomingQ = query(collection(db, 'invitations'), where('recipientEmail', '==', auth.currentUser.email));
          const outgoingQ = query(collection(db, 'invitations'), where('senderUid', '==', auth.currentUser.uid));

          const [inSnap, outSnap] = await Promise.all([getDocs(incomingQ), getDocs(outgoingQ)]);
          const incoming = [];
          const outgoing = [];

          inSnap.forEach(d => {
            const data = d.data();
            if (data.status === 'PENDING') incoming.push({ id: d.id, ...data });
          });
          outSnap.forEach(d => {
            const data = d.data();
            outgoing.push({ id: d.id, ...data });
          });

          return { incoming, outgoing };
        } catch (dbErr) {
          console.warn('[Family Invitations] Firestore query notice:', dbErr);
        }
      }
      return { incoming: [], outgoing: [] };
    }
  }

  /**
   * Sends an invitation to a family member by email
   */
  async sendInvitation(email, relationship = 'Family') {
    try {
      return await api.post('/family/invitations', { email, relationship });
    } catch (apiErr) {
      if (db && auth && auth.currentUser) {
        const invId = 'inv_' + Date.now();
        const inv = {
          id: invId,
          senderUid: auth.currentUser.uid,
          senderName: auth.currentUser.displayName || auth.currentUser.email,
          senderEmail: auth.currentUser.email,
          recipientEmail: email.trim().toLowerCase(),
          relationship,
          status: 'PENDING',
          createdAt: Date.now()
        };
        await setDoc(doc(db, 'invitations', invId), inv);
        return inv;
      }
      throw apiErr;
    }
  }

  /**
   * Accepts an incoming family invitation
   */
  async acceptInvitation(invitationId) {
    try {
      return await api.post(`/family/invitations/${encodeURIComponent(invitationId)}/accept`, {});
    } catch (apiErr) {
      if (db && auth && auth.currentUser) {
        await updateDoc(doc(db, 'invitations', invitationId), { status: 'ACCEPTED' });
        // Add reciprocal family record
        const famId = 'fam_' + Date.now();
        await setDoc(doc(db, 'family', famId), {
          userUid: auth.currentUser.uid,
          invitationId,
          status: 'ACTIVE',
          canViewLocation: true,
          createdAt: Date.now()
        });
        return { success: true };
      }
      throw apiErr;
    }
  }

  /**
   * Rejects an incoming family invitation
   */
  async rejectInvitation(invitationId) {
    try {
      return await api.delete(`/family/invitations/${encodeURIComponent(invitationId)}`);
    } catch (apiErr) {
      if (db) {
        await deleteDoc(doc(db, 'invitations', invitationId));
        return { success: true };
      }
      throw apiErr;
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

    try {
      await api.delete(`/family/members/${encodeURIComponent(memberId)}`);
    } catch (apiErr) {
      if (db) {
        await deleteDoc(doc(db, 'family', memberId));
      } else {
        throw apiErr;
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
        await updateDoc(doc(db, 'family', memberId), { canViewLocation: allowAccess });
        return { success: true };
      }
      throw apiErr;
    }
  }
}

export const familyService = new FamilyService();
