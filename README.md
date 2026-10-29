# SheGuard — Women Safety Incident Reporting System & Live Family Locator

> **Confidential Incident Reporting • Live Family GPS Proximity • Haversine Proximity Triage • OSRM Road Navigation • Instant Multi-Channel SOS Dispatch**

---

## 1. Executive Summary & Objective

**SheGuard** is a full-stack, responsive web application engineered to protect women through confidential safety incident reporting, live family location sharing, turn-by-turn road navigation to nearby protectors, and fail-safe multi-channel emergency SOS alerting.

### Core Architecture Highlights:
- **No Frontend Frameworks**: Built strictly with HTML5, CSS3, vanilla JavaScript ES6+ modules, Leaflet.js, and OpenStreetMap tiles. Strictly zero React, Vue, Angular, Tailwind, or Bootstrap.
- **Enterprise Spring Boot REST API**: Powered by Java 21 LTS and Spring Boot 3 with Spring Security token verification.
- **Real Database & Storage**: Built for Firebase Authentication, Cloud Firestore, and Firebase Storage for private evidence attachments.
- **Anti-Fabrication Principle**: Zero fabricated demo users, random markers, fake locations, or false success states. Proper empty and error states are returned when services are not yet configured or when no records exist.
- **Victim Privacy Safeguard**: Precise coordinates for public safety map reports are fuzzed by ~500m to eliminate exposure of victims' homes or workplaces. Full precision coordinates are strictly restricted to mutual family members and emergency responders during active SOS calls.

---

## 2. System Architecture

```
                                      +---------------------------------------------+
                                      |              SHEGUARD CLIENT                |
                                      | (Vanilla JS ES6+ Modules / Custom Dark CSS) |
                                      +---------------------------------------------+
                                        /                  |                      \
                     (Firebase Auth ID Token)      (Browser GPS API)       (Leaflet.js / OSM)
                                      /                    |                        \
                                     v                     v                         v
       +------------------------------------+  +----------------------+  +----------------------+
       |     SPRING BOOT REST API (8080)    |  |  Location Watcher    |  |  OSRM Routing Engine |
       | - Security Token Filter            |  | - Haversine Distance |  | - Road Path Geometry |
       | - Incident Verification Controller |  | - Stale Evaluator    |  | - Driving/Foot Time  |
       | - Family Proximity Service         |  +----------------------+  +----------------------+
       | - Emergency Alert Dispatcher       |
       +------------------------------------+
                /                \
               v                  v
+-----------------------+  +-------------------------------+
|    CLOUD FIRESTORE    |  |   NOTIFICATION DISPATCHER     |
| - Confidential Reports|  | - Twilio SMS Provider         |
| - Family Circles      |  | - JavaMail SMTP Gateway       |
| - GPS Locations       |  | - Real Delivery Status Track  |
| - Audit Trail         |  +-------------------------------+
+-----------------------+
```

---

## 3. Project Directory Structure

```
sheguard/
├── index.html                 # Futuristic public landing page & features
├── login.html                 # Email & password authentication
├── register.html              # User registration with legal consent
├── forgot-password.html       # Password recovery via Firebase Auth
├── verify-email.html          # Email verification check & resend
├── dashboard.html             # User dashboard with metrics & quick shortcuts
├── report-incident.html       # Interactive report form with Leaflet location picker
├── my-reports.html            # Report history & tracking timeline modal
├── safety-map.html            # Public map with filters & OSM emergency services
├── family-locator.html        # Live family locator, Haversine sorting & OSRM routing
├── family.html                # Family invitations, approval & permission toggles
├── emergency.html             # SOS distress center with 5s cancelable countdown
├── trusted-contacts.html      # Emergency contacts management
├── admin.html                 # Moderator queue, status updates & audit logs
├── settings.html              # Master location toggle, privacy & data export
├── css/
│   ├── variables.css          # Dark Navy/Charcoal, Electric Purple, Cyan, SOS Red
│   ├── base.css               # Typography, reset, accessibility & focus rings
│   ├── layout.css             # App shell, responsive navbar & sticky sidebar
│   ├── components.css         # Buttons, cards, badges, dialogs, empty states
│   ├── responsive.css         # Mobile & tablet media queries
│   └── pages.css              # Page layouts (SOS circle, Hero, Leaflet view)
├── js/
│   ├── config.js              # Global API, OSRM, map & helpline constants
│   ├── firebase-config.js     # Client Firebase SDK configuration
│   ├── firebase.js            # Firebase modular SDK initialization (ESM)
│   ├── api.js                 # Reusable API client with Bearer ID Token injection
│   ├── auth.js                # Auth sessions, registration & profile sync
│   ├── guards.js              # Route guards (requireAuth, requireGuest, requireAdmin)
│   ├── ui.js                  # Accessible toasts, modals, empty states
│   ├── distance.js            # Geodesic Haversine formula calculation
│   ├── routing.js             # OSRM routing service & navigation fallbacks
│   ├── location.js            # Browser Geolocation API wrapper & freshness evaluator
│   ├── reports.js             # Incident reporting & public map data service
│   ├── safety-map.js          # Interactive Leaflet safety map controller
│   ├── family-locator.js      # Live family locator, nearest-member triage
│   ├── family.js              # Family invitations & mutual permissions
│   ├── contacts.js            # Trusted contacts CRUD
│   ├── emergency.js           # SOS countdown & alert dispatch controller
│   ├── dashboard.js           # Dashboard metrics aggregator
│   ├── admin.js               # Admin analytics & incident moderation
│   └── settings.js            # User settings & location sharing master toggle
├── backend/
│   ├── pom.xml                # Spring Boot 3.3.4 & Java 21 dependencies
│   ├── mvnw.cmd               # Self-contained Maven wrapper for Windows
│   ├── mvnw                   # Self-contained Maven wrapper for Linux/macOS
│   ├── .mvn/wrapper/          # Maven wrapper properties
│   └── src/main/
│       ├── java/com/sheguard/
│       │   ├── SheGuardApplication.java
│       │   ├── config/        # CorsConfig, SecurityConfig
│       │   ├── controllers/   # REST Controllers (Health, Reports, Family, Admin...)
│       │   ├── models/        # POJO Models (UserProfile, IncidentReport, etc.)
│       │   ├── security/      # FirebaseTokenFilter, UserPrincipal
│       │   └── services/      # FirebaseService, IncidentReportService, NotificationService...
│       └── resources/
│           └── application.yml# Spring Boot configuration
├── tests/
│   └── unit-tests.js          # Automated unit test suite (12/12 passing)
├── .env.example               # Environment variables template
├── .gitignore                 # Git ignore for keys, builds and credentials
└── README.md                  # Comprehensive technical documentation
```

---

## 4. Setup & Running Instructions

### Prerequisites
- **Java 21 LTS** installed.
- **Node.js** (v18+) for running tests and lightweight static file serving.
- A modern web browser with Location Permissions enabled (Chrome, Edge, Firefox, Safari).

### Step 1: Running the Frontend
The frontend consists of vanilla HTML, CSS, and ES Modules. You can serve it with any local web server:

```powershell
# Using Python built-in HTTP server:
cd C:\Users\LENOVO\.gemini\antigravity\scratch\sheguard
python -m http.server 5500

# OR using Node.js npx serve:
npx serve . -p 5500
```
Open your browser at `http://localhost:5500/index.html`.

### Step 2: Configuring Firebase (Client & Backend)
1. Visit the [Firebase Console](https://console.firebase.google.com/) and create a project.
2. Enable **Authentication** (Email/Password provider).
3. Enable **Cloud Firestore** in production or test mode.
4. **Client Setup**: Update `js/firebase-config.js` with your Web App configuration keys.
5. **Backend Setup**: Go to *Project Settings > Service accounts > Generate new private key*. Save the downloaded JSON file as `backend/serviceAccountKey.json` (or set `GOOGLE_APPLICATION_CREDENTIALS`).

### Step 3: Running the Spring Boot Backend
```powershell
cd C:\Users\LENOVO\.gemini\antigravity\scratch\sheguard\backend

# Using the provided self-contained Maven Wrapper:
.\mvnw.cmd spring-boot:run
```
The REST API will launch on port `8080`.
Verify backend health by opening `http://localhost:8080/api/health`.

---

## 5. Automated Verification & Testing

To run the automated test suite:
```powershell
cd C:\Users\LENOVO\.gemini\antigravity\scratch\sheguard
node tests/unit-tests.js
```

### Verified Test Cases:
- **Haversine Distance**:
  - Distance between identical points is exactly `0.0 km`.
  - Realistic geodesic distance calculation between New Delhi and Mumbai (`~1148 km`).
  - Validation: Coordinate bounds check (`-90 <= lat <= 90`, `-180 <= lon <= 180`).
  - Formatting: `<1.0 km` rendered in meters (`450 m`), `>=1.0 km` in kilometers (`2.5 km`).
- **Location Freshness & Stale Detection**:
  - Timestamps `< 30 mins` evaluated as `LIVE` (`🟢`).
  - Timestamps `> 30 mins` evaluated as `STALE` (`⚪`).
- **Routing & Fallbacks**:
  - OSRM query formatting and Google Maps fallback URL generator.
- **Configuration & Integrity**:
  - All 7 specified incident categories verified.
  - All 6 verification statuses verified (`submitted`, `pending_review`, `under_review`, `verified`, `rejected`, `resolved`).
  - Emergency hotline numbers verified (`112`, `1091`, `1930`).

---

## 6. API Endpoint Contracts

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/api/health` | System health & integration readiness status | Public |
| `GET` | `/api/reports/public` | Public safety incidents (fuzzed coordinates only) | Public |
| `GET` | `/api/profile` | Logged-in user profile & permissions | Bearer Token |
| `PATCH` | `/api/profile` | Update profile information | Bearer Token |
| `GET` | `/api/profile/export` | Download full personal data archive (JSON) | Bearer Token |
| `POST` | `/api/reports` | Submit confidential incident report | Bearer Token |
| `GET` | `/api/reports/mine` | List user's historical filed reports | Bearer Token |
| `GET` | `/api/reports/{reference}` | Detailed report record & reviewer notes | Bearer Token |
| `POST` | `/api/reports/{ref}/evidence`| Upload private encrypted evidence file | Bearer Token |
| `POST` | `/api/locations/share` | Publish live GPS coordinates to family | Bearer Token |
| `GET` | `/api/family/locations` | Fetch authorized family members' coordinates | Bearer Token |
| `DELETE` | `/api/locations/share` | Stop live location sharing | Bearer Token |
| `POST` | `/api/family/invitations` | Send family circle invitation by email | Bearer Token |
| `GET` | `/api/family/invitations` | Get incoming/outgoing invitations | Bearer Token |
| `POST` | `/api/family/invitations/{id}/accept` | Accept family invitation (mutual connection) | Bearer Token |
| `DELETE`| `/api/family/members/{id}`| Revoke family connection | Bearer Token |
| `POST` | `/api/emergency/alerts` | Trigger SOS emergency alert | Bearer Token |
| `GET` | `/api/emergency/alerts` | List historical SOS alerts and delivery logs | Bearer Token |
| `GET` | `/api/contacts` | Get user's emergency trusted contacts | Bearer Token |
| `POST` | `/api/contacts` | Add emergency trusted contact | Bearer Token |
| `DELETE`| `/api/contacts/{id}` | Delete emergency trusted contact | Bearer Token |
| `GET` | `/api/admin/analytics` | Real incident totals & status counters | Admin Role |
| `GET` | `/api/admin/reports` | Moderator incident verification queue | Admin Role |
| `PATCH` | `/api/admin/reports/{ref}/status` | Verify, reject, or resolve incident | Admin Role |
| `GET` | `/api/admin/audit-logs` | Cryptographic administrative audit trail | Admin Role |

---

## 7. Security, Compliance, & Privacy Architecture

1. **Zero Password Storage**: All passwords remain encrypted within Firebase Auth servers. No plain or hashed passwords ever touch Firestore or client localStorage.
2. **Victim Anonymity**: Coordinates rendered on the Public Safety Map are automatically jittered/fuzzed by ~500 meters. Exact home or workplace coordinates are never exposed to the public.
3. **Opt-in Mutual Family Sharing**: Location tracking is impossible without affirmative invitation acceptance. Users retain instant one-click revocation power through the master toggle in Settings or individual switches in Family Circle.
4. **Emergency Distress Guard**: The SOS module enforces a 5-second cancelable countdown with audio-visual radar pulses, allowing users to abort accidental triggers before SMS/Email packets are dispatched to family contacts.
