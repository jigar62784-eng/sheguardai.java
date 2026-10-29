/**
 * SheGuard - Reusable REST API Client
 * Automatically manages Firebase ID Token injection, JSON serialization, and error diagnostics.
 */
import { CONFIG } from './config.js';
import { auth, getIdToken } from './firebase.js';

export class ApiError extends Error {
  constructor(message, status, data = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

class ApiClient {
  constructor() {
    this.baseUrl = CONFIG.API_BASE_URL.replace(/\/$/, '');
  }

  /**
   * Retrieves the current user's Firebase Bearer ID Token if logged in
   */
  async getAuthHeader() {
    if (!auth || !auth.currentUser) {
      return {};
    }
    try {
      const token = await getIdToken(auth.currentUser, false);
      return { 'Authorization': `Bearer ${token}` };
    } catch (err) {
      console.warn('[SheGuard API] Failed to obtain Firebase ID Token:', err);
      return {};
    }
  }

  /**
   * Core request dispatcher with timeout and network diagnostics
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
    const authHeaders = await this.getAuthHeader();
    
    const headers = {
      'Accept': 'application/json',
      ...authHeaders,
      ...options.headers
    };

    if (!(options.body instanceof FormData) && options.body && typeof options.body === 'object') {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(options.body);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 15000);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: options.signal || controller.signal
      });

      clearTimeout(timeout);

      // Handle 204 No Content
      if (response.status === 204) {
        return null;
      }

      const contentType = response.headers.get('content-type') || '';
      let data = null;
      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      if (!response.ok) {
        const errorMsg = (data && data.message) || `API Error: HTTP ${response.status} ${response.statusText}`;
        throw new ApiError(errorMsg, response.status, data);
      }

      return data;
    } catch (err) {
      clearTimeout(timeout);
      if (err.name === 'AbortError') {
        throw new ApiError('Request timed out while connecting to SheGuard backend.', 408);
      }
      if (err instanceof ApiError) {
        throw err;
      }
      // Connection refused or network unavailable
      throw new ApiError(
        `Unable to reach SheGuard backend at ${url}. Please ensure the Spring Boot server is running. (${err.message})`,
        0,
        { originalError: err.message }
      );
    }
  }

  // HTTP Method Shortcuts
  get(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'GET' });
  }

  post(endpoint, body, options = {}) {
    return this.request(endpoint, { ...options, method: 'POST', body });
  }

  patch(endpoint, body, options = {}) {
    return this.request(endpoint, { ...options, method: 'PATCH', body });
  }

  delete(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'DELETE' });
  }

  /**
   * Evidence file upload via multipart/form-data
   */
  async uploadEvidence(reference, file, onProgress = null) {
    const formData = new FormData();
    formData.append('file', file);
    return this.post(`/reports/${encodeURIComponent(reference)}/evidence`, formData);
  }
}

export const api = new ApiClient();
