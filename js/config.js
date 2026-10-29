/**
 * SheGuard - Global Configuration
 */
export const CONFIG = {
  // Backend Spring Boot REST API Base URL
  // Default to local Spring Boot port 8080 or custom port
  API_BASE_URL: (typeof window !== 'undefined' && window.SHEGUARD_API_URL) ? window.SHEGUARD_API_URL : 'http://localhost:8080/api',

  // OpenStreetMap Tile Configuration (High contrast dark theme)
  MAP: {
    DEFAULT_CENTER: [20.5937, 78.9629], // Geographic center default
    DEFAULT_ZOOM: 12,
    MAX_ZOOM: 19,
    MIN_ZOOM: 3,
    TILE_LAYER_URL: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    TILE_LAYER_DARK: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    ATTRIBUTION: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
  },

  // OpenStreetMap-Compatible Routing Service (OSRM)
  // Configurable OSRM routing endpoint (Public demo with fallback handling)
  ROUTING: {
    OSRM_BASE_URL: 'https://router.project-osrm.org',
    PROFILES: {
      WALKING: 'foot',
      DRIVING: 'car'
    },
    TIMEOUT_MS: 8000
  },

  // Location Sharing & Stale Thresholds
  LOCATION: {
    STALE_THRESHOLD_MINUTES: 30, // Locations older than 30 mins are marked stale
    HIGH_ACCURACY: true,
    MAX_AGE_MS: 15000,
    TIMEOUT_MS: 10000
  },

  // Emergency Helplines (Verified National / International Safety Lines)
  EMERGENCY_HELPLINES: [
    { name: 'National Emergency Number', number: '112', description: 'All-in-one Emergency (Police, Fire, Ambulance)' },
    { name: 'Women Helpline (Domestic/Crisis)', number: '1091', description: '24x7 Emergency helpline for women' },
    { name: 'National Commission for Women (NCW)', number: '7827170170', description: '24/7 dedicated grievance helpline' },
    { name: 'Cyber Crime Helpline', number: '1930', description: 'Cyber harassment, fraud and stalker reporting' }
  ],

  // Incident Categories
  INCIDENT_CATEGORIES: [
    { id: 'harassment', label: 'Harassment / Eve Teasing' },
    { id: 'stalking', label: 'Stalking / Following' },
    { id: 'physical_assault', label: 'Physical Assault' },
    { id: 'threats', label: 'Threats / Intimidation' },
    { id: 'cyber_harassment', label: 'Cyber Harassment / Blackmail' },
    { id: 'unsafe_location', label: 'Unsafe Public Location (Poor lighting / Isolated)' },
    { id: 'other', label: 'Other Safety Incident' }
  ],

  // Incident Statuses
  INCIDENT_STATUSES: {
    submitted: { label: 'Submitted', badgeClass: 'badge-submitted' },
    pending_review: { label: 'Pending Review', badgeClass: 'badge-pending' },
    under_review: { label: 'Under Review', badgeClass: 'badge-under-review' },
    verified: { label: 'Verified', badgeClass: 'badge-verified' },
    rejected: { label: 'Rejected', badgeClass: 'badge-rejected' },
    resolved: { label: 'Resolved', badgeClass: 'badge-resolved' }
  }
};
