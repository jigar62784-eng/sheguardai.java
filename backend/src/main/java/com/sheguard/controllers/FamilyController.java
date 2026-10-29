package com.sheguard.controllers;

import com.sheguard.models.FamilyInvitation;
import com.sheguard.models.FamilyMember;
import com.sheguard.security.UserPrincipal;
import com.sheguard.services.FamilyService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/family")
public class FamilyController {

    private final FamilyService familyService;

    public FamilyController(FamilyService familyService) {
        this.familyService = familyService;
    }

    @PostMapping("/invitations")
    public ResponseEntity<FamilyInvitation> sendInvitation(@AuthenticationPrincipal UserPrincipal principal,
                                                          @RequestBody Map<String, String> body) {
        if (principal == null) return ResponseEntity.status(401).build();

        String recipientEmail = body.get("email");
        String relationship = body.getOrDefault("relationship", "Family");

        FamilyInvitation inv = familyService.sendInvitation(
                principal.getUid(),
                principal.getUsername(),
                principal.getDisplayName(),
                recipientEmail,
                relationship
        );
        return ResponseEntity.ok(inv);
    }

    @GetMapping("/invitations")
    public ResponseEntity<Map<String, List<FamilyInvitation>>> getInvitations(@AuthenticationPrincipal UserPrincipal principal) {
        if (principal == null) return ResponseEntity.status(401).build();

        Map<String, List<FamilyInvitation>> invites = familyService.getInvitations(principal.getUsername(), principal.getUid());
        return ResponseEntity.ok(invites);
    }

    @PostMapping("/invitations/{id}/accept")
    public ResponseEntity<Map<String, String>> acceptInvitation(@PathVariable String id,
                                                                @AuthenticationPrincipal UserPrincipal principal) {
        if (principal == null) return ResponseEntity.status(401).build();

        familyService.acceptInvitation(id, principal.getUid(), principal.getUsername(), principal.getDisplayName());
        return ResponseEntity.ok(Map.of("status", "ACCEPTED"));
    }

    @DeleteMapping("/invitations/{id}")
    public ResponseEntity<Void> rejectInvitation(@PathVariable String id) {
        familyService.rejectInvitation(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/members")
    public ResponseEntity<List<FamilyMember>> getFamilyMembers(@AuthenticationPrincipal UserPrincipal principal) {
        if (principal == null) return ResponseEntity.status(401).build();

        List<FamilyMember> members = familyService.getFamilyMembers(principal.getUid());
        return ResponseEntity.ok(members);
    }

    @DeleteMapping("/members/{id}")
    public ResponseEntity<Void> removeFamilyMember(@PathVariable String id,
                                                   @AuthenticationPrincipal UserPrincipal principal) {
        if (principal == null) return ResponseEntity.status(401).build();

        familyService.removeFamilyMember(principal.getUid(), id);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/members/{id}/permissions")
    public ResponseEntity<Void> updateMemberPermissions(@PathVariable String id,
                                                        @RequestBody Map<String, Object> body,
                                                        @AuthenticationPrincipal UserPrincipal principal) {
        if (principal == null) return ResponseEntity.status(401).build();

        boolean allow = Boolean.TRUE.equals(body.get("canViewLocation"));
        familyService.updatePermissions(principal.getUid(), id, allow);
        return ResponseEntity.noContent().build();
    }
}
