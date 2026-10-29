package com.sheguard.services;

import com.google.cloud.firestore.Firestore;
import com.sheguard.models.EmergencyAlert;
import com.sheguard.models.LocationCoordinates;
import com.sheguard.models.TrustedContact;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class EmergencyAlertService {
    private static final Logger log = LoggerFactory.getLogger(EmergencyAlertService.class);
    private static final String ALERTS_COLLECTION = "emergency_alerts";
    private static final String CONTACTS_COLLECTION = "contacts";

    private final FirebaseService firebaseService;
    private final NotificationService notificationService;
    private final Map<String, EmergencyAlert> memoryAlerts = new ConcurrentHashMap<>();
    private final Map<String, List<TrustedContact>> memoryContacts = new ConcurrentHashMap<>();
    private final SecureRandom random = new SecureRandom();

    public EmergencyAlertService(FirebaseService firebaseService, NotificationService notificationService) {
        this.firebaseService = firebaseService;
        this.notificationService = notificationService;
    }

    public String generateAlertReference() {
        String datePart = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        int randNum = 1000 + random.nextInt(9000);
        return String.format("SOS-%s-%d", datePart, randNum);
    }

    public EmergencyAlert triggerAlert(String userUid, String userEmail, String type, String message, LocationCoordinates location) {
        EmergencyAlert alert = new EmergencyAlert();
        alert.setId(UUID.randomUUID().toString());
        alert.setAlertReference(generateAlertReference());
        alert.setUserUid(userUid);
        alert.setUserEmail(userEmail);
        alert.setType(type != null ? type : "SOS_EMERGENCY");
        alert.setMessage(message != null ? message : "Emergency assistance requested.");
        alert.setLocation(location);
        alert.setCreatedAt(System.currentTimeMillis());

        // 1. Fetch user's trusted contacts
        List<TrustedContact> contacts = getContactsForUser(userUid);

        // 2. Dispatch notifications via configured provider
        String providerSummary = notificationService.dispatchEmergencyAlert(
                alert.getAlertReference(),
                userEmail,
                location,
                alert.getMessage(),
                contacts
        );

        alert.setProviderStatusSummary(providerSummary);
        alert.setStatus(contacts.isEmpty() ? "LOGGED_NO_CONTACTS" : "DELIVERED");

        // 3. Save alert
        if (firebaseService.isConfigured()) {
            try {
                Firestore db = firebaseService.getFirestore();
                db.collection(ALERTS_COLLECTION).document(alert.getId()).set(alert).get();
            } catch (Exception e) {
                memoryAlerts.put(alert.getId(), alert);
            }
        } else {
            memoryAlerts.put(alert.getId(), alert);
        }

        return alert;
    }

    public List<EmergencyAlert> getAlertsForUser(String userUid) {
        if (firebaseService.isConfigured()) {
            try {
                Firestore db = firebaseService.getFirestore();
                var docs = db.collection(ALERTS_COLLECTION)
                        .whereEqualTo("userUid", userUid)
                        .get().get().getDocuments();
                List<EmergencyAlert> list = new ArrayList<>();
                for (var doc : docs) {
                    list.add(doc.toObject(EmergencyAlert.class));
                }
                list.sort((a, b) -> Long.compare(b.getCreatedAt(), a.getCreatedAt()));
                return list;
            } catch (Exception e) {
                log.warn("[Alerts] Firestore query error: {}", e.getMessage());
            }
        }

        return memoryAlerts.values().stream()
                .filter(a -> userUid.equals(a.getUserUid()))
                .sorted((a, b) -> Long.compare(b.getCreatedAt(), a.getCreatedAt()))
                .toList();
    }

    // Trusted Contacts Management
    public List<TrustedContact> getContactsForUser(String userUid) {
        if (firebaseService.isConfigured()) {
            try {
                Firestore db = firebaseService.getFirestore();
                var docs = db.collection(CONTACTS_COLLECTION)
                        .whereEqualTo("userUid", userUid)
                        .get().get().getDocuments();
                List<TrustedContact> list = new ArrayList<>();
                for (var doc : docs) {
                    list.add(doc.toObject(TrustedContact.class));
                }
                return list;
            } catch (Exception ignored) {}
        }

        return memoryContacts.getOrDefault(userUid, new ArrayList<>());
    }

    public TrustedContact addContact(String userUid, TrustedContact contact) {
        contact.setId(UUID.randomUUID().toString());
        contact.setUserUid(userUid);
        contact.setCreatedAt(System.currentTimeMillis());

        if (firebaseService.isConfigured()) {
            try {
                Firestore db = firebaseService.getFirestore();
                db.collection(CONTACTS_COLLECTION).document(contact.getId()).set(contact).get();
            } catch (Exception ignored) {}
        }

        memoryContacts.computeIfAbsent(userUid, k -> new ArrayList<>()).add(contact);
        return contact;
    }

    public void deleteContact(String userUid, String contactId) {
        if (firebaseService.isConfigured()) {
            try {
                Firestore db = firebaseService.getFirestore();
                db.collection(CONTACTS_COLLECTION).document(contactId).delete().get();
            } catch (Exception ignored) {}
        }

        List<TrustedContact> list = memoryContacts.get(userUid);
        if (list != null) {
            list.removeIf(c -> contactId.equals(c.getId()));
        }
    }
}
