/**
 * SheGuard - Family Circle Invitations and Access Permissions
 */
import { api } from './api.js';
import { showToast, confirmAction, escapeHtml } from './ui.js';

export class FamilyService {
  /**
   * Fetches all approved family members
   */
  async getFamilyMembers() {
    return api.get('/family/members');
  }

  /**
   * Fetches incoming and outgoing family invitations
   */
  async getInvitations() {
    return api.get('/family/invitations');
  }

  /**
   * Sends an invitation to a family member by email
   */
  async sendInvitation(email, relationship = 'Family') {
    return api.post('/family/invitations', { email, relationship });
  }

  /**
   * Accepts an incoming family invitation
   */
  async acceptInvitation(invitationId) {
    return api.post(`/family/invitations/${encodeURIComponent(invitationId)}/accept`, {});
  }

  /**
   * Rejects an incoming family invitation
   */
  async rejectInvitation(invitationId) {
    return api.delete(`/family/invitations/${encodeURIComponent(invitationId)}`);
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

    await api.delete(`/family/members/${encodeURIComponent(memberId)}`);
    showToast('Family connection revoked.', 'info');
    return true;
  }

  /**
   * Toggles location sharing permission for a specific member
   */
  async toggleMemberLocationAccess(memberId, allowAccess) {
    return api.patch(`/family/members/${encodeURIComponent(memberId)}/permissions`, {
      canViewLocation: allowAccess
    });
  }
}

export const familyService = new FamilyService();
