package com.sheguard.controllers;

import com.sheguard.models.TrustedContact;
import com.sheguard.security.UserPrincipal;
import com.sheguard.services.EmergencyAlertService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/contacts")
public class TrustedContactsController {

    private final EmergencyAlertService alertService;

    public TrustedContactsController(EmergencyAlertService alertService) {
        this.alertService = alertService;
    }

    @GetMapping
    public ResponseEntity<List<TrustedContact>> getContacts(@AuthenticationPrincipal UserPrincipal principal) {
        if (principal == null) return ResponseEntity.status(401).build();

        List<TrustedContact> contacts = alertService.getContactsForUser(principal.getUid());
        return ResponseEntity.ok(contacts);
    }

    @PostMapping
    public ResponseEntity<TrustedContact> addContact(@AuthenticationPrincipal UserPrincipal principal,
                                                     @RequestBody TrustedContact contact) {
        if (principal == null) return ResponseEntity.status(401).build();

        TrustedContact created = alertService.addContact(principal.getUid(), contact);
        return ResponseEntity.ok(created);
    }

    @PatchMapping("/{id}")
    public ResponseEntity<TrustedContact> updateContact(@PathVariable String id,
                                                        @AuthenticationPrincipal UserPrincipal principal,
                                                        @RequestBody TrustedContact updates) {
        if (principal == null) return ResponseEntity.status(401).build();

        // Remove old and add updated
        alertService.deleteContact(principal.getUid(), id);
        updates.setId(id);
        TrustedContact saved = alertService.addContact(principal.getUid(), updates);
        return ResponseEntity.ok(saved);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteContact(@PathVariable String id,
                                              @AuthenticationPrincipal UserPrincipal principal) {
        if (principal == null) return ResponseEntity.status(401).build();

        alertService.deleteContact(principal.getUid(), id);
        return ResponseEntity.noContent().build();
    }
}
