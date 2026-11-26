import { showAlert } from './swal';

const API_URL = '';

let refreshPromise: Promise<boolean> | null = null;

async function refreshSession(): Promise<void> {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    })
      .then((response) => response.ok)
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }

  if (!(await refreshPromise)) {
    await forceLogout();
    throw new Error('Phiên đăng nhập hết hạn');
  }
}

export async function fetchAPIResponse(
  endpoint: string,
  requestOptions: RequestInit = {}
): Promise<Response> {
  const options: RequestInit = {
    credentials: 'include',
    ...requestOptions,
  };
  let response = await fetch(`${API_URL}${endpoint}`, options);

  if (response.status === 401 && !endpoint.includes('/auth/')) {
    await refreshSession();
    response = await fetch(`${API_URL}${endpoint}`, options);
  }

  return response;
}

export async function fetchAPI<T = unknown>(
  endpoint: string,
  method: string = 'GET',
  body: unknown = null,
  isFormData: boolean = false
): Promise<T> {
  const headers: Record<string, string> = {};
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }

  const options: RequestInit = {
    method,
    headers,
  };

  if (body) {
    options.body = isFormData ? (body as BodyInit) : JSON.stringify(body);
  }

  try {
    const response = await fetchAPIResponse(endpoint, options);

    // Check if the response is a blob/file stream or json
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/pdf') || contentType.includes('application/octet-stream')) {
      if (!response.ok) {
        throw new Error('Không thể tải tệp');
      }
      return (await response.blob()) as unknown as T;
    }

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.detail || data.message || 'Lỗi hệ thống');
    }
    return data as T;
  } catch (error: unknown) {
    const err =
      error instanceof Error ? error : new Error('Đã có lỗi xảy ra');
    // Don't pop up alert for 401 if we are redirecting
    if (!err.message?.includes('Phiên đăng nhập hết hạn')) {
      await showAlert('Thất bại', err.message || 'Đã có lỗi xảy ra', 'error');
    }
    throw error;
  }
}

export async function forceLogout() {
  try {
    await fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
  } catch (e) {
    console.error('Logout error:', e);
  }

  if (typeof window !== 'undefined') {
    localStorage.removeItem('username');
    localStorage.removeItem('role');
    localStorage.removeItem('fullName');
    localStorage.removeItem('tenantName');
    window.dispatchEvent(
      new CustomEvent('securesign:auth-changed', { detail: null })
    );
    window.dispatchEvent(new Event('securesign:session-expired'));
  }
}

export interface UserProfile {
  id: number;
  username: string;
  full_name?: string | null;
  email?: string | null;
  role: string;
  tenant_id?: number | null;
  tenant_name?: string | null;
}

export async function fetchUserProfile(): Promise<UserProfile | null> {
  try {
    const profile = await fetchAPI<UserProfile>('/auth/me');
    if (typeof window !== 'undefined') {
      localStorage.removeItem('username');
      localStorage.removeItem('role');
      localStorage.removeItem('fullName');
      localStorage.removeItem('tenantName');
      window.dispatchEvent(
        new CustomEvent('securesign:auth-changed', { detail: profile })
      );
    }
    return profile;
  } catch {
    return null;
  }
}
