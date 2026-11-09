import { showAlert } from './swal';

const API_URL = '';

let isRefreshing = false;
let refreshSubscribers: ((isSuccess: boolean) => void)[] = [];

function onRefreshed(isSuccess: boolean) {
  refreshSubscribers.forEach((callback) => callback(isSuccess));
  refreshSubscribers = [];
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
    credentials: 'include',
  };

  if (body) {
    options.body = isFormData ? (body as BodyInit) : JSON.stringify(body);
  }

  try {
    let response = await fetch(`${API_URL}${endpoint}`, options);

    // If 401 Unauthorized and not an auth endpoint
    if (response.status === 401 && !endpoint.includes('/auth/')) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          refreshSubscribers.push(async (isSuccess) => {
            if (isSuccess) {
              try {
                resolve(await fetchAPI<T>(endpoint, method, body, isFormData));
              } catch (err) {
                reject(err);
              }
            } else {
              reject(new Error('Phiên đăng nhập hết hạn'));
            }
          });
        });
      }

      isRefreshing = true;
      try {
        const refreshRes = await fetch(`${API_URL}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        });

        if (refreshRes.ok) {
          isRefreshing = false;
          onRefreshed(true);
          response = await fetch(`${API_URL}${endpoint}`, options);
        } else {
          throw new Error('Refresh failed');
        }
      } catch (err) {
        isRefreshing = false;
        onRefreshed(false);
        await forceLogout();
        throw err;
      }
    }

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
    const err = error as Error;
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
    window.dispatchEvent(new Event('securesign:auth-changed'));
    window.dispatchEvent(new Event('securesign:session-expired'));
  }
}

export function getCurrentUsername(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('username');
  }
  return null;
}
