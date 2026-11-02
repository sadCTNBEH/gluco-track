import { DiaryEntry, UserSettings } from '../types/diabetes';

const TOKEN_KEY = 'glucotrack_auth_token';

export interface AuthUser {
  id: string;
  username: string;
}

export interface AuthResponse {
  user: AuthUser;
  token: string;
}

export class ApiError extends Error {
  status?: number;
  data?: unknown;
  isNetworkError: boolean;

  constructor(message: string, status?: number, data?: unknown, isNetworkError = false) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
    this.isNetworkError = isNetworkError;
  }
}

/**
 * Очищает внутренние метаданные синхронизации перед отправкой на сервер.
 */
export function sanitizeEntryForServer<T extends Partial<DiaryEntry>>(
  entry: T
): Omit<T, '_syncStatus' | '_syncError' | '_lastModified'> {
  const { _syncStatus, _syncError, _lastModified, ...clean } = entry;
  return clean as Omit<T, '_syncStatus' | '_syncError' | '_lastModified'>;
}

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeStoredToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let res: Response;
  try {
    res = await fetch(endpoint, {
      ...options,
      headers,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Сетевая ошибка: сервер недоступен';
    throw new ApiError(
      message,
      undefined,
      undefined,
      true
    );
  }

  if (res.status === 401) {
    removeStoredToken();
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(
      data.error || `Ошибка сервера (${res.status})`,
      res.status,
      data,
      false
    );
  }

  return data as T;
}

export const api = {
  // Авторизация
  async register(username: string, password: string, patientName?: string): Promise<AuthResponse> {
    const data = await request<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password, patientName }),
    });
    setStoredToken(data.token);
    return data;
  },

  async login(username: string, password: string): Promise<AuthResponse> {
    const data = await request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    setStoredToken(data.token);
    return data;
  },

  async getMe(): Promise<{ user: AuthUser } | null> {
    const token = getStoredToken();
    if (!token) return null;
    try {
      return await request<{ user: AuthUser }>('/api/auth/me');
    } catch {
      removeStoredToken();
      return null;
    }
  },

  async logout(): Promise<void> {
    try {
      await request('/api/auth/logout', { method: 'POST' });
    } catch {
      // Игнорируем ошибку при выходе
    } finally {
      removeStoredToken();
    }
  },

  // Записи
  async getEntries(): Promise<DiaryEntry[]> {
    return request<DiaryEntry[]>('/api/entries');
  },

  async createEntry(entry: Omit<DiaryEntry, 'id' | 'createdAt'> & { id?: string }): Promise<DiaryEntry> {
    return request<DiaryEntry>('/api/entries', {
      method: 'POST',
      body: JSON.stringify(sanitizeEntryForServer(entry)),
    });
  },

  async updateEntry(id: string, entry: Omit<DiaryEntry, 'id' | 'createdAt'>): Promise<DiaryEntry> {
    return request<DiaryEntry>(`/api/entries/${id}`, {
      method: 'PUT',
      body: JSON.stringify(sanitizeEntryForServer(entry)),
    });
  },

  async deleteEntry(id: string): Promise<void> {
    await request(`/api/entries/${id}`, {
      method: 'DELETE',
    });
  },

  async deleteDay(date: string): Promise<void> {
    await request(`/api/entries/day/${date}`, {
      method: 'DELETE',
    });
  },

  async clearEntries(): Promise<void> {
    await request('/api/entries', {
      method: 'DELETE',
    });
  },

  async importEntries(entries: DiaryEntry[], replaceAll = false): Promise<{ importedCount: number }> {
    const cleanEntries = entries.map((e) => sanitizeEntryForServer(e));
    return request<{ importedCount: number }>('/api/entries/import', {
      method: 'POST',
      body: JSON.stringify({ entries: cleanEntries, replaceAll }),
    });
  },

  async deduplicateEntries(): Promise<{ ok: boolean; removedCount: number }> {
    return request<{ ok: boolean; removedCount: number }>('/api/entries/deduplicate', {
      method: 'POST',
    });
  },

  // Настройки
  async getSettings(): Promise<UserSettings> {
    return request<UserSettings>('/api/settings');
  },

  async updateSettings(settings: UserSettings): Promise<UserSettings> {
    return request<UserSettings>('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  },
};
