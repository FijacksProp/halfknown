export type Catalog = {
  genders: string[];
  intentions: string[];
  interests: string[];
  avatars: string[];
  styles: string[];
  policy_version: string;
};

export type Preferences = {
  genders: string[];
  min_age: number;
  max_age: number;
  open_chat_opt_in: boolean;
};

export type Profile = {
  id: string;
  alias: string;
  avatar_id: string;
  gender: string;
  intentions: string[];
  interests: string[];
  languages: string[];
  conversation_style: string;
  prompt_answer: string;
};

export type SavedProfile = { profile: Profile; preferences: Preferences };
export type Account = {
  id: string;
  email: string;
  email_verified: boolean;
  onboarding_complete: boolean;
};
export type Onboarding = Omit<Profile, 'id' | 'alias'> & {
  birth_date: string;
  accepted_terms: boolean;
  accepted_guidelines: boolean;
  policy_version: string;
  preferences: Preferences;
};

function describeErrors(value: unknown, prefix = ''): string[] {
  if (typeof value === 'string')
    return [prefix ? `${prefix}: ${value}` : value];
  if (Array.isArray(value))
    return value.flatMap((item) => describeErrors(item, prefix));
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, item]) =>
      describeErrors(
        item,
        key === 'detail' || key === 'non_field_errors'
          ? prefix
          : key.replaceAll('_', ' '),
      ),
    );
  }
  return [];
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, detail: unknown) {
    super(
      describeErrors(detail).join(' ') ||
        'Something went wrong. Please try again.',
    );
    this.name = 'ApiError';
    this.status = status;
  }
}

// Relative URLs keep session cookies on the browser origin. No credentials in storage.
export function createApi(fetcher: typeof fetch = (...args) => fetch(...args)) {
  async function request<T>(
    path: string,
    method = 'GET',
    body?: unknown,
  ): Promise<T> {
    const headers = new Headers({ Accept: 'application/json' });
    if (method !== 'GET') {
      // Fetch a current token before each write, including after login rotation and
      // changes in another tab. Never blindly replay a failed write.
      const csrf = await request<{ csrf_token: string }>('/auth/csrf/');
      headers.set('X-CSRFToken', csrf.csrf_token);
      headers.set('Content-Type', 'application/json');
    }
    let response: Response;
    try {
      response = await fetcher(`/api/v1${path}`, {
        method,
        headers,
        credentials: 'same-origin',
        cache: 'no-store',
        signal: AbortSignal.timeout(20_000),
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new ApiError(
        0,
        'Could not reach Halfknown. Check your connection and try again.',
      );
    }
    if (response.status === 204) return undefined as T;
    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw new ApiError(
        response.status,
        'The account service is unavailable. Please try again shortly.',
      );
    }
    if (!response.ok) throw new ApiError(response.status, data);
    return data as T;
  }
  return {
    catalog: () => request<Catalog>('/catalog/'),
    preview: () =>
      request<{ alias: string; avatar_id: string }>('/identity-preview/'),
    me: () => request<Account>('/me/'),
    profile: () => request<SavedProfile>('/profile/'),
    requestCode: (email: string) =>
      request<{ challenge_id: string }>('/auth/request-code/', 'POST', {
        email,
      }),
    verifyCode: (challenge_id: string, code: string) =>
      request<{ id: string; csrf_token: string }>(
        '/auth/verify-code/',
        'POST',
        { challenge_id, code },
      ),
    createProfile: (profile: Onboarding) =>
      request<SavedProfile>('/profile/', 'POST', profile),
    savePreferences: (preferences: Preferences) =>
      request<Preferences>('/preferences/', 'PUT', preferences),
    logout: () => request<void>('/auth/logout/', 'POST'),
  };
}

export const api = createApi();
