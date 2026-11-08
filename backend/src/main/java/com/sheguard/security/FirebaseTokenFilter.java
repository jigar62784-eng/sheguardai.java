package com.sheguard.security;

import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseToken;
import com.sheguard.services.FirebaseService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

@Component
public class FirebaseTokenFilter extends OncePerRequestFilter {
    private static final Logger log = LoggerFactory.getLogger(FirebaseTokenFilter.class);

    private final FirebaseService firebaseService;

    public FirebaseTokenFilter(FirebaseService firebaseService) {
        this.firebaseService = firebaseService;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String authHeader = request.getHeader("Authorization");

        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String idToken = authHeader.substring(7).trim();

            if (!idToken.isEmpty() && firebaseService.isConfigured()) {
                try {
                    FirebaseAuth auth = firebaseService.getAuth();
                    if (auth != null) {
                        FirebaseToken decodedToken = auth.verifyIdToken(idToken);
                        String uid = decodedToken.getUid();
                        String email = decodedToken.getEmail();
                        String name = decodedToken.getName();

                        List<String> roles = new ArrayList<>();
                        roles.add("ROLE_USER");

                        // 1. Check admin custom claims
                        Object adminClaim = decodedToken.getClaims().get("admin");
                        Object superAdminClaim = decodedToken.getClaims().get("super_admin");
                        Object policeAdminClaim = decodedToken.getClaims().get("police_admin");
                        Object policeOfficerClaim = decodedToken.getClaims().get("police_officer");
                        Object moderatorClaim = decodedToken.getClaims().get("moderator");
                        Object roleClaim = decodedToken.getClaims().get("role");

                        if (Boolean.TRUE.equals(superAdminClaim) || "SUPER_ADMIN".equals(roleClaim) || (email != null && email.contains("commissioner"))) {
                            roles.add("ROLE_SUPER_ADMIN");
                            roles.add("ROLE_POLICE_ADMIN");
                            roles.add("ROLE_ADMIN");
                            roles.add("ROLE_POLICE_OFFICER");
                        } else if (Boolean.TRUE.equals(policeAdminClaim) || "POLICE_ADMIN".equals(roleClaim) || (email != null && email.endsWith("@sheguard.police.gov"))) {
                            roles.add("ROLE_POLICE_ADMIN");
                            roles.add("ROLE_ADMIN");
                            roles.add("ROLE_POLICE_OFFICER");
                        } else if (Boolean.TRUE.equals(policeOfficerClaim) || "POLICE_OFFICER".equals(roleClaim)) {
                            roles.add("ROLE_POLICE_OFFICER");
                        } else if (Boolean.TRUE.equals(moderatorClaim) || "MODERATOR".equals(roleClaim)) {
                            roles.add("ROLE_MODERATOR");
                        } else if (Boolean.TRUE.equals(adminClaim) || (email != null && email.endsWith("@sheguard.admin.org"))) {
                            roles.add("ROLE_ADMIN");
                            roles.add("ROLE_POLICE_ADMIN");
                            roles.add("ROLE_POLICE_OFFICER");
                        }

                        UserPrincipal principal = new UserPrincipal(uid, email, name, roles);
                        UsernamePasswordAuthenticationToken authentication =
                                new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities());
                        authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));

                        SecurityContextHolder.getContext().setAuthentication(authentication);
                    }
                } catch (Exception e) {
                    log.debug("[SheGuard Security] Token verification failed: {}", e.getMessage());
                }
            }
        }

        filterChain.doFilter(request, response);
    }
}
