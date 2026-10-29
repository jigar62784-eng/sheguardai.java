package com.sheguard.controllers;

import com.google.cloud.firestore.Firestore;
import com.sheguard.models.UserProfile;
import com.sheguard.security.UserPrincipal;
import com.sheguard.services.EmergencyAlertService;
import com.sheguard.services.FamilyService;
import com.sheguard.services.FirebaseService;
import com.sheguard.services.IncidentReportService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@RestController
@RequestMapping("/api/profile")
public class AuthProfileController {
    private static final String COLLECTION = "profiles";

    private final FirebaseService firebaseService;
    private final IncidentReportService reportService;
    private final FamilyService familyService;
    private final EmergencyAlertService alertService;
    private final Map<String, UserProfile> memoryProfiles = new ConcurrentHashMap<>();

    public AuthProfileController(FirebaseService firebaseService,
                                 IncidentReportService reportService,
                                 FamilyService familyService,
                                 EmergencyAlertService alertService) {
        this.firebaseService = firebaseService;
        this.reportService = reportService;
        this.familyService = familyService;
        this.alertService = alertService;
    }

    @GetMapping
    public ResponseEntity<UserProfile> getProfile(@AuthenticationPrincipal UserPrincipal principal) {
        if (principal == null) return ResponseEntity.status(401).build();

        UserProfile profile = findProfile(principal.getUid());
        if (profile == null) {
            profile = new UserProfile(principal.getUid(), principal.getUsername(), principal.getDisplayName(), "");
            saveProfile(profile);
        }
        return ResponseEntity.ok(profile);
    }

    @PostMapping
    public ResponseEntity<UserProfile> createProfile(@AuthenticationPrincipal UserPrincipal principal, @RequestBody UserProfile request) {
        if (principal == null) return ResponseEntity.status(401).build();

        UserProfile profile = new UserProfile(
                principal.getUid(),
                principal.getUsername(),
                request.getDisplayName() != null ? request.getDisplayName() : principal.getDisplayName(),
                request.getPhoneNumber() != null ? request.getPhoneNumber() : ""
        );
        saveProfile(profile);
        return ResponseEntity.ok(profile);
    }

    @PatchMapping
    public ResponseEntity<UserProfile> updateProfile(@AuthenticationPrincipal UserPrincipal principal, @RequestBody Map<String, Object> updates) {
        if (principal == null) return ResponseEntity.status(401).build();

        UserProfile profile = findProfile(principal.getUid());
        if (profile == null) {
            profile = new UserProfile(principal.getUid(), principal.getUsername(), principal.getDisplayName(), "");
        }

        if (updates.containsKey("displayName")) profile.setDisplayName((String) updates.get("displayName"));
        if (updates.containsKey("phoneNumber")) profile.setPhoneNumber((String) updates.get("phoneNumber"));
        if (updates.containsKey("emergencyMedicalNotes")) profile.setEmergencyMedicalNotes((String) updates.get("emergencyMedicalNotes"));
        if (updates.containsKey("locationSharingEnabled")) profile.setLocationSharingEnabled(Boolean.TRUE.equals(updates.get("locationSharingEnabled")));
        if (updates.containsKey("emailNotificationsEnabled")) profile.setEmailNotificationsEnabled(Boolean.TRUE.equals(updates.get("emailNotificationsEnabled")));

        profile.setUpdatedAt(System.currentTimeMillis());
        saveProfile(profile);
        return ResponseEntity.ok(profile);
    }

    @GetMapping("/export")
    public ResponseEntity<Map<String, Object>> exportMyData(@AuthenticationPrincipal UserPrincipal principal) {
        if (principal == null) return ResponseEntity.status(401).build();

        Map<String, Object> export = new HashMap<>();
        export.put("profile", findProfile(principal.getUid()));
        export.put("reports", reportService.findByReporterUid(principal.getUid()));
        export.put("familyMembers", familyService.getFamilyMembers(principal.getUid()));
        export.put("contacts", alertService.getContactsForUser(principal.getUid()));
        export.put("alerts", alertService.getAlertsForUser(principal.getUid()));
        export.put("exportedAt", System.currentTimeMillis());

        return ResponseEntity.ok(export);
    }

    @DeleteMapping
    public ResponseEntity<Void> deleteAccountData(@AuthenticationPrincipal UserPrincipal principal) {
        if (principal == null) return ResponseEntity.status(401).build();

        if (firebaseService.isConfigured()) {
            try {
                Firestore db = firebaseService.getFirestore();
                db.collection(COLLECTION).document(principal.getUid()).delete().get();
            } catch (Exception ignored) {}
        }
        memoryProfiles.remove(principal.getUid());
        return ResponseEntity.noContent().build();
    }

    private UserProfile findProfile(String uid) {
        if (firebaseService.isConfigured()) {
            try {
                Firestore db = firebaseService.getFirestore();
                var doc = db.collection(COLLECTION).document(uid).get().get();
                if (doc.exists()) return doc.toObject(UserProfile.class);
            } catch (Exception ignored) {}
        }
        return memoryProfiles.get(uid);
    }

    private void saveProfile(UserProfile profile) {
        if (firebaseService.isConfigured()) {
            try {
                Firestore db = firebaseService.getFirestore();
                db.collection(COLLECTION).document(profile.getUid()).set(profile).get();
            } catch (Exception e) {
                memoryProfiles.put(profile.getUid(), profile);
            }
        } else {
            memoryProfiles.put(profile.getUid(), profile);
        }
    }
}
