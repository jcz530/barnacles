import { ensureBackendRunning, getBackendUrl } from './app-manager.js';

/**
 * API Client for CLI
 * Provides a simple interface for making API calls to the Barnacles backend
 */

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
      throw new Error(`API error: ${response.status} ${response.statusText}`);
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
      throw new Error(`API error: ${response.status} ${response.statusText}`);
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
      throw new Error(`API error: ${response.status} ${response.statusText}`);
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
      throw new Error(`API error: ${response.status} ${response.statusText}`);
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
      throw new Error(`API error: ${response.status} ${response.statusText}`);
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
