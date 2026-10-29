package com.sheguard.controllers;

import com.sheguard.models.LocationRecord;
import com.sheguard.security.UserPrincipal;
import com.sheguard.services.LocationService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
public class LocationController {

    private final LocationService locationService;

    public LocationController(LocationService locationService) {
        this.locationService = locationService;
    }

    @PostMapping("/api/locations/share")
    public ResponseEntity<LocationRecord> shareLocation(@AuthenticationPrincipal UserPrincipal principal,
                                                        @RequestBody Map<String, Object> body) {
        if (principal == null) return ResponseEntity.status(401).build();

        Double lat = body.get("latitude") instanceof Number ? ((Number) body.get("latitude")).doubleValue() : null;
        Double lon = body.get("longitude") instanceof Number ? ((Number) body.get("longitude")).doubleValue() : null;
        Integer acc = body.get("accuracy") instanceof Number ? ((Number) body.get("accuracy")).intValue() : null;
        Long ts = body.get("timestamp") instanceof Number ? ((Number) body.get("timestamp")).longValue() : System.currentTimeMillis();

        LocationRecord rec = locationService.updateUserLocation(
                principal.getUid(),
                principal.getDisplayName(),
                "",
                lat,
                lon,
                acc,
                ts
        );
        return ResponseEntity.ok(rec);
    }

    @PostMapping("/api/locations/share/enable")
    public ResponseEntity<Map<String, String>> enableLocationSharing(@AuthenticationPrincipal UserPrincipal principal) {
        if (principal == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(Map.of("status", "ENABLED"));
    }

    @DeleteMapping("/api/locations/share")
    public ResponseEntity<Void> stopLocationSharing(@AuthenticationPrincipal UserPrincipal principal) {
        if (principal == null) return ResponseEntity.status(401).build();
        locationService.disableLocationSharing(principal.getUid());
        return ResponseEntity.noContent().build();
    }

    /**
     * Endpoint contract for family locations queried by the live locator map
     */
    @GetMapping({"/api/family/locations", "/api/locations/family"})
    public ResponseEntity<List<LocationRecord>> getFamilyLocations(@AuthenticationPrincipal UserPrincipal principal) {
        if (principal == null) return ResponseEntity.status(401).build();

        List<LocationRecord> locations = locationService.getFamilyLocationsForUser(principal.getUid());
        return ResponseEntity.ok(locations);
    }
}
