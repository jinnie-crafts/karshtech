import type { Game, Release, User, DashboardStats } from '../types';

const API_BASE = '/api';

class ApiClient {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      credentials: 'include',
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.error || `HTTP error! status: ${res.status}`);
    }

    return data as T;
  }

  // Public Endpoints
  public async getGames(params?: {
    genre?: string;
    platform?: string;
    status?: string;
    search?: string;
    featured?: boolean;
  }): Promise<Game[]> {
    const query = new URLSearchParams();
    if (params?.genre) query.set('genre', params.genre);
    if (params?.platform) query.set('platform', params.platform);
    if (params?.status) query.set('status', params.status);
    if (params?.search) query.set('search', params.search);
    if (params?.featured) query.set('featured', 'true');

    const qs = query.toString() ? `?${query.toString()}` : '';
    const res = await this.request<{ games: Game[] }>(`/games${qs}`);
    return res.games;
  }

  public async getGameBySlug(slug: string): Promise<{ game: Game & { releases: Release[] } }> {
    return this.request<{ game: Game & { releases: Release[] } }>(`/games/${slug}`);
  }

  public async getStats(): Promise<{ stats: DashboardStats; settings: any }> {
    return this.request<{ stats: DashboardStats; settings: any }>('/stats');
  }

  public async submitSupport(data: {
    name: string;
    email: string;
    game?: string;
    subject: string;
    message: string;
  }): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>('/support', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Auth Endpoints
  public async login(credentials: { username: string; password: string }): Promise<{ user: User; token: string }> {
    return this.request<{ user: User; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  }

  public async logout(): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>('/auth/logout', {
      method: 'POST',
    });
  }

  public async getMe(): Promise<{ user: User }> {
    return this.request<{ user: User }>('/auth/me');
  }

  public async changePassword(data: { current_password: string; new_password: string }): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Admin Endpoints
  public async getAdminStats(): Promise<{ stats: DashboardStats; recent_releases: (Release & { game_title: string })[] }> {
    return this.request<{ stats: DashboardStats; recent_releases: (Release & { game_title: string })[] }>('/admin/stats');
  }

  public async getAdminGames(): Promise<Game[]> {
    const res = await this.request<{ games: Game[] }>('/admin/games');
    return res.games;
  }

  public async createGame(gameData: Partial<Game>): Promise<{ success: boolean; game: Game }> {
    return this.request<{ success: boolean; game: Game }>('/admin/games', {
      method: 'POST',
      body: JSON.stringify(gameData),
    });
  }

  public async updateGame(id: string, updates: Partial<Game>): Promise<{ success: boolean; game: Game }> {
    return this.request<{ success: boolean; game: Game }>(`/admin/games/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  public async deleteGame(id: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/admin/games/${id}`, {
      method: 'DELETE',
    });
  }

  public async getAdminReleases(): Promise<(Release & { game_title: string })[]> {
    const res = await this.request<{ releases: (Release & { game_title: string })[] }>('/admin/releases');
    return res.releases;
  }

  public async createRelease(releaseData: Partial<Release>): Promise<{ success: boolean; release: Release }> {
    return this.request<{ success: boolean; release: Release }>('/admin/releases', {
      method: 'POST',
      body: JSON.stringify(releaseData),
    });
  }

  public async updateRelease(id: string, updates: Partial<Release>): Promise<{ success: boolean; release: Release }> {
    return this.request<{ success: boolean; release: Release }>(`/admin/releases/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  public async deleteRelease(id: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/admin/releases/${id}`, {
      method: 'DELETE',
    });
  }

  public async getAdminSettings(): Promise<{ settings: any }> {
    return this.request<{ settings: any }>('/admin/settings');
  }

  public async updateAdminSettings(settings: any): Promise<{ success: boolean; settings: any }> {
    return this.request<{ success: boolean; settings: any }>('/admin/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  // Upload helpers (FormData)
  public async uploadImage(file: File): Promise<{ success: boolean; url: string; filename: string }> {
    const formData = new FormData();
    formData.append('image', file);

    const res = await fetch(`${API_BASE}/admin/upload/image`, {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to upload image');
    }
    return data;
  }

  public async uploadApk(file: File): Promise<{ success: boolean; filename: string; size: number }> {
    const formData = new FormData();
    formData.append('apk', file);

    const res = await fetch(`${API_BASE}/admin/upload/apk`, {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to upload APK');
    }
    return data;
  }
}

export const api = new ApiClient();
