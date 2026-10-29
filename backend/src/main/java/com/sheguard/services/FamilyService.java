package com.sheguard.services;

import com.google.cloud.firestore.Firestore;
import com.sheguard.models.FamilyInvitation;
import com.sheguard.models.FamilyMember;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class FamilyService {
    private static final Logger log = LoggerFactory.getLogger(FamilyService.class);
    private static final String INVITES_COLLECTION = "family_invitations";
    private static final String MEMBERS_COLLECTION = "family_members";

    private final FirebaseService firebaseService;
    private final Map<String, FamilyInvitation> memoryInvites = new ConcurrentHashMap<>();
    private final Map<String, FamilyMember> memoryMembers = new ConcurrentHashMap<>();

    public FamilyService(FirebaseService firebaseService) {
        this.firebaseService = firebaseService;
    }

    public FamilyInvitation sendInvitation(String senderUid, String senderEmail, String senderName, String recipientEmail, String relationship) {
        FamilyInvitation inv = new FamilyInvitation();
        inv.setId(UUID.randomUUID().toString());
        inv.setSenderUid(senderUid);
        inv.setSenderEmail(senderEmail);
        inv.setSenderName(senderName);
        inv.setRecipientEmail(recipientEmail.toLowerCase().trim());
        inv.setRelationship(relationship);
        inv.setStatus("PENDING");
        inv.setCreatedAt(System.currentTimeMillis());

        if (firebaseService.isConfigured()) {
            try {
                Firestore db = firebaseService.getFirestore();
                db.collection(INVITES_COLLECTION).document(inv.getId()).set(inv).get();
            } catch (Exception e) {
                log.warn("[Family] Firestore invite save failed: {}", e.getMessage());
                memoryInvites.put(inv.getId(), inv);
            }
        } else {
            memoryInvites.put(inv.getId(), inv);
        }

        return inv;
    }

    public Map<String, List<FamilyInvitation>> getInvitations(String userEmail, String userUid) {
        List<FamilyInvitation> all = getAllInvitations();
        String normalizedEmail = userEmail != null ? userEmail.toLowerCase().trim() : "";

        List<FamilyInvitation> incoming = all.stream()
                .filter(i -> normalizedEmail.equalsIgnoreCase(i.getRecipientEmail()) && "PENDING".equals(i.getStatus()))
                .toList();

        List<FamilyInvitation> outgoing = all.stream()
                .filter(i -> userUid.equals(i.getSenderUid()) && "PENDING".equals(i.getStatus()))
                .toList();

        Map<String, List<FamilyInvitation>> result = new HashMap<>();
        result.put("incoming", incoming);
        result.put("outgoing", outgoing);
        return result;
    }

    public void acceptInvitation(String invitationId, String recipientUid, String recipientEmail, String recipientDisplayName) {
        FamilyInvitation inv = findInvitationById(invitationId);
        if (inv == null) {
            throw new IllegalArgumentException("Invitation not found: " + invitationId);
        }

        inv.setStatus("ACCEPTED");

        // Mutual Family Member link 1: Sender -> Recipient
        FamilyMember m1 = new FamilyMember();
        m1.setId(UUID.randomUUID().toString());
        m1.setUserId(inv.getSenderUid());
        m1.setTargetUserId(recipientUid);
        m1.setEmail(recipientEmail);
        m1.setDisplayName(recipientDisplayName);
        m1.setRelationship(inv.getRelationship());
        m1.setCanViewLocation(true);
        m1.setSharingStatus("ACTIVE");

        // Mutual Family Member link 2: Recipient -> Sender
        FamilyMember m2 = new FamilyMember();
        m2.setId(UUID.randomUUID().toString());
        m2.setUserId(recipientUid);
        m2.setTargetUserId(inv.getSenderUid());
        m2.setEmail(inv.getSenderEmail());
        m2.setDisplayName(inv.getSenderName());
        m2.setRelationship(inv.getRelationship());
        m2.setCanViewLocation(true);
        m2.setSharingStatus("ACTIVE");

        saveMember(m1);
        saveMember(m2);
        saveInvitation(inv);
    }

    public void rejectInvitation(String invitationId) {
        FamilyInvitation inv = findInvitationById(invitationId);
        if (inv != null) {
            inv.setStatus("REJECTED");
            saveInvitation(inv);
        }
    }

    public List<FamilyMember> getFamilyMembers(String userUid) {
        if (firebaseService.isConfigured()) {
            try {
                Firestore db = firebaseService.getFirestore();
                var docs = db.collection(MEMBERS_COLLECTION).whereEqualTo("userId", userUid).get().get().getDocuments();
                List<FamilyMember> list = new ArrayList<>();
                for (var doc : docs) {
                    list.add(doc.toObject(FamilyMember.class));
                }
                return list;
            } catch (Exception e) {
                log.warn("[Family] Firestore members error: {}", e.getMessage());
            }
        }

        return memoryMembers.values().stream()
                .filter(m -> userUid.equals(m.getUserId()))
                .toList();
    }

    public void removeFamilyMember(String userUid, String memberId) {
        FamilyMember member = findMemberById(memberId);
        if (member != null && userUid.equals(member.getUserId())) {
            if (firebaseService.isConfigured()) {
                try {
                    Firestore db = firebaseService.getFirestore();
                    db.collection(MEMBERS_COLLECTION).document(memberId).delete().get();
                } catch (Exception e) {
                    memoryMembers.remove(memberId);
                }
            } else {
                memoryMembers.remove(memberId);
            }
        }
    }

    public void updatePermissions(String userUid, String memberId, boolean canViewLocation) {
        FamilyMember member = findMemberById(memberId);
        if (member != null && userUid.equals(member.getUserId())) {
            member.setCanViewLocation(canViewLocation);
            saveMember(member);
        }
    }

    private void saveMember(FamilyMember m) {
        if (firebaseService.isConfigured()) {
            try {
                Firestore db = firebaseService.getFirestore();
                db.collection(MEMBERS_COLLECTION).document(m.getId()).set(m).get();
            } catch (Exception e) {
                memoryMembers.put(m.getId(), m);
            }
        } else {
            memoryMembers.put(m.getId(), m);
        }
    }

    private void saveInvitation(FamilyInvitation inv) {
        if (firebaseService.isConfigured()) {
            try {
                Firestore db = firebaseService.getFirestore();
                db.collection(INVITES_COLLECTION).document(inv.getId()).set(inv).get();
            } catch (Exception e) {
                memoryInvites.put(inv.getId(), inv);
            }
        } else {
            memoryInvites.put(inv.getId(), inv);
        }
    }

    private FamilyInvitation findInvitationById(String id) {
        if (firebaseService.isConfigured()) {
            try {
                Firestore db = firebaseService.getFirestore();
                var doc = db.collection(INVITES_COLLECTION).document(id).get().get();
                if (doc.exists()) return doc.toObject(FamilyInvitation.class);
            } catch (Exception ignored) {}
        }
        return memoryInvites.get(id);
    }

    private FamilyMember findMemberById(String id) {
        if (firebaseService.isConfigured()) {
            try {
                Firestore db = firebaseService.getFirestore();
                var doc = db.collection(MEMBERS_COLLECTION).document(id).get().get();
                if (doc.exists()) return doc.toObject(FamilyMember.class);
            } catch (Exception ignored) {}
        }
        return memoryMembers.get(id);
    }

    private List<FamilyInvitation> getAllInvitations() {
        if (firebaseService.isConfigured()) {
            try {
                Firestore db = firebaseService.getFirestore();
                var docs = db.collection(INVITES_COLLECTION).get().get().getDocuments();
                List<FamilyInvitation> list = new ArrayList<>();
                for (var doc : docs) {
                    list.add(doc.toObject(FamilyInvitation.class));
                }
                return list;
            } catch (Exception ignored) {}
        }
        return new ArrayList<>(memoryInvites.values());
    }
}
