import { ensureBackendRunning, getBackendUrl } from './app-manager.js';

/**
 * API Client for CLI
 * Provides a simple interface for making API calls to the Barnacles backend
 */

/**
 * Build an Error from a failed response, preferring the backend's own
 * `{ error }` / `{ message }` body over the generic status text.
 */
async function buildApiError(response: Response): Promise<Error> {
  try {
    const body = (await response.json()) as { error?: string; message?: string };
    const detail = body?.error ?? body?.message;
    if (typeof detail === 'string' && detail.length > 0) {
      return new Error(detail);
    }
  } catch {
    // Response body wasn't JSON (or was empty) — fall back below
  }
  return new Error(`API error: ${response.status} ${response.statusText}`);
}

export class ApiClient {
  private baseUrl: string | null = null;

  /**
   * Ensure the backend is running and get the base URL
   */
  private async ensureConnection(): Promise<string> {
    if (!this.baseUrl) {
      this.baseUrl = await ensureBackendRunning();
      if (!this.baseUrl) {
        throw new Error(
          'Failed to connect to Barnacles backend. Please ensure the app is running.'
        );
      }
    }
    return this.baseUrl;
  }

  /**
   * Make a GET request to the API
   */
  async get<T>(endpoint: string): Promise<T> {
    const baseUrl = await this.ensureConnection();
    const url = `${baseUrl}${endpoint}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw await buildApiError(response);
    }

    const result = await response.json();
    return result.data as T;
  }

  /**
   * Make a POST request to the API
   */
  async post<T>(endpoint: string, body?: unknown): Promise<T> {
    const baseUrl = await this.ensureConnection();
    const url = `${baseUrl}${endpoint}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw await buildApiError(response);
    }

    const result = await response.json();
    return result.data as T;
  }

  /**
   * Make a PUT request to the API
   */
  async put<T>(endpoint: string, body?: unknown): Promise<T> {
    const baseUrl = await this.ensureConnection();
    const url = `${baseUrl}${endpoint}`;

    const response = await fetch(url, {
      method: 'PUT',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw await buildApiError(response);
    }

    const result = await response.json();
    return result.data as T;
  }

  /**
   * Make a PATCH request to the API
   */
  async patch<T>(endpoint: string, body?: unknown): Promise<T> {
    const baseUrl = await this.ensureConnection();
    const url = `${baseUrl}${endpoint}`;

    const response = await fetch(url, {
      method: 'PATCH',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw await buildApiError(response);
    }

    const result = await response.json();
    return result.data as T;
  }

  /**
   * Make a DELETE request to the API
   */
  async delete<T>(endpoint: string): Promise<T> {
    const baseUrl = await this.ensureConnection();
    const url = `${baseUrl}${endpoint}`;

    const response = await fetch(url, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw await buildApiError(response);
    }

    const result = await response.json();
    return result.data as T;
  }

  /**
   * Get the backend URL without ensuring connection
   */
  async getBackendUrl(): Promise<string | null> {
    return getBackendUrl();
  }
}

// Export a singleton instance
export const apiClient = new ApiClient();
