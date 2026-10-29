package com.sheguard.services;

import com.google.cloud.firestore.Firestore;
import com.sheguard.models.FamilyMember;
import com.sheguard.models.LocationRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class LocationService {
    private static final Logger log = LoggerFactory.getLogger(LocationService.class);
    private static final String COLLECTION = "locations";

    private final FirebaseService firebaseService;
    private final FamilyService familyService;
    private final Map<String, LocationRecord> memoryLocations = new ConcurrentHashMap<>();

    public LocationService(FirebaseService firebaseService, FamilyService familyService) {
        this.firebaseService = firebaseService;
        this.familyService = familyService;
    }

    /**
     * Stores or updates the current user's shared GPS coordinates
     */
    public LocationRecord updateUserLocation(String userId, String displayName, String phoneNumber, Double lat, Double lon, Integer accuracy, Long timestamp) {
        LocationRecord rec = new LocationRecord();
        rec.setUserId(userId);
        rec.setDisplayName(displayName);
        rec.setPhoneNumber(phoneNumber);
        rec.setLatitude(lat);
        rec.setLongitude(lon);
        rec.setAccuracy(accuracy);
        rec.setTimestamp(timestamp != null ? timestamp : System.currentTimeMillis());
        rec.setSharingEnabled(true);

        if (firebaseService.isConfigured()) {
            try {
                Firestore db = firebaseService.getFirestore();
                db.collection(COLLECTION).document(userId).set(rec).get();
            } catch (Exception e) {
                memoryLocations.put(userId, rec);
            }
        } else {
            memoryLocations.put(userId, rec);
        }

        return rec;
    }

    /**
     * Stops location sharing for user
     */
    public void disableLocationSharing(String userId) {
        LocationRecord rec = getLocationForUser(userId);
        if (rec != null) {
            rec.setSharingEnabled(false);
            if (firebaseService.isConfigured()) {
                try {
                    Firestore db = firebaseService.getFirestore();
                    db.collection(COLLECTION).document(userId).set(rec).get();
                } catch (Exception e) {
                    memoryLocations.put(userId, rec);
                }
            } else {
                memoryLocations.put(userId, rec);
            }
        }
    }

    /**
     * Retrieves genuine shared locations for all approved family members of user
     */
    public List<LocationRecord> getFamilyLocationsForUser(String userUid) {
        List<FamilyMember> members = familyService.getFamilyMembers(userUid);
        List<LocationRecord> result = new ArrayList<>();

        for (FamilyMember m : members) {
            // Check if member has permitted location viewing
            if (!m.isCanViewLocation()) continue;

            LocationRecord loc = getLocationForUser(m.getTargetUserId());
            if (loc != null && loc.isSharingEnabled()) {
                loc.setRelationship(m.getRelationship());
                if (loc.getDisplayName() == null || loc.getDisplayName().isBlank()) {
                    loc.setDisplayName(m.getDisplayName());
                }
                result.add(loc);
            } else {
                // If member exists but hasn't published location, return metadata with null coords
                LocationRecord placeholder = new LocationRecord();
                placeholder.setUserId(m.getTargetUserId());
                placeholder.setDisplayName(m.getDisplayName());
                placeholder.setPhoneNumber(m.getPhoneNumber());
                placeholder.setRelationship(m.getRelationship());
                placeholder.setSharingEnabled(false);
                result.add(placeholder);
            }
        }

        return result;
    }

    private LocationRecord getLocationForUser(String userId) {
        if (firebaseService.isConfigured()) {
            try {
                Firestore db = firebaseService.getFirestore();
                var doc = db.collection(COLLECTION).document(userId).get().get();
                if (doc.exists()) return doc.toObject(LocationRecord.class);
            } catch (Exception ignored) {}
        }
        return memoryLocations.get(userId);
    }
}
