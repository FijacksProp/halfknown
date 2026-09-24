export type Catalog = {
  genders: string[];
  intentions: string[];
  interests: string[];
  avatars: string[];
  avatar_groups: Record<string, string[]>;
  styles: string[];
  policy_version: string;
  policies: { terms: string; privacy: string; guidelines: string };
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
  avatar_group: string;
  gender: string;
  intentions: string[];
  interests: string[];
  languages: string[];
  conversation_style: string;
  prompt_answer: string;
  bio: string;
  discoverable: boolean;
};

export type SavedProfile = { profile: Profile; preferences: Preferences };
export type MatchMode = 'random';
export type Chat = {
  state: 'invited' | 'active' | 'ended';
  id: string;
  mode: MatchMode;
  intention: string;
  accepted: boolean;
  expires_at: string;
  end_reason: string;
  peer: { alias: string; avatar_id: string; shared_interests: string[] };
};
export type MatchState =
  | { state: 'idle' }
  | { state: 'waiting'; mode: MatchMode; intention: string }
  | Chat;
export type ChatMessage = {
  id: number;
  client_id: string;
  body: string;
  mine: boolean;
  created_at: string;
};
export type MessagePage = {
  messages: ChatMessage[];
  has_more: boolean;
  conversation: Chat;
};
export type Account = {
  id: string;
  email: string;
  email_verified: boolean;
  onboarding_complete: boolean;
  is_guest: boolean;
};
export type RandomAccess = {
  gender: string;
  adult_confirmed: boolean;
  accepted_terms: boolean;
  accepted_guidelines: boolean;
  policy_version: string;
  interests?: string[];
  discoverable?: boolean;
};
export type ShowcaseItem = {
  id: string;
  kind: 'talent' | 'project' | 'interest';
  title: string;
  description: string;
  created_at: string;
};
export type SocialConnection = {
  id: string;
  status: 'pending' | 'accepted' | 'declined';
  direction: 'incoming' | 'outgoing';
  unread_count: number;
};
export type InboxMessage = {
  body: string;
  mine: boolean;
  created_at: string;
};
export type SocialProfile = {
  id: string;
  alias: string;
  avatar_id: string;
  avatar_group: string;
  gender: string;
  intentions: string[];
  interests: string[];
  bio: string;
  prompt_answer: string;
  discoverable: boolean | null;
  verified: boolean;
  following: boolean;
  followers_count: number;
  connection: SocialConnection | null;
  showcase: ShowcaseItem[];
};
export type SocialMessage = {
  id: number;
  body: string;
  mine: boolean;
  created_at: string;
};
export type Onboarding = Omit<
  Profile,
  'id' | 'alias' | 'bio' | 'discoverable' | 'avatar_group' | 'avatar_id'
> & {
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
    heartbeat: () => request<MatchState>('/matching/heartbeat/', 'POST'),
    joinQueue: () => request<MatchState>('/matching/queue/', 'POST', {}),
    leaveChat: () => request<void>('/matching/queue/', 'DELETE'),
    acceptChat: (id: string) => request<Chat>(`/chats/${id}/accept/`, 'POST'),
    declineChat: (id: string) =>
      request<MatchState>(`/chats/${id}/decline/`, 'POST'),
    nextPerson: (id: string) =>
      request<MatchState>(`/chats/${id}/next/`, 'POST'),
    messages: (id: string, after = 0) =>
      request<MessagePage>(`/chats/${id}/messages/?after=${after}`),
    sendMessage: (id: string, client_id: string, body: string) =>
      request<ChatMessage>(`/chats/${id}/messages/`, 'POST', {
        client_id,
        body,
      }),
    typing: (id: string) => request<void>(`/chats/${id}/typing/`, 'POST'),
    blockChat: (id: string) => request<void>(`/chats/${id}/block/`, 'POST'),
    reportChat: (id: string, reason: string, details: string) =>
      request<void>(`/chats/${id}/report/`, 'POST', { reason, details }),
    quickConnect: (id: string) =>
      request<SocialConnection>(`/chats/${id}/connect/`, 'POST'),
    quickConnectionState: (id: string) =>
      request<{ connection: SocialConnection | null }>(`/chats/${id}/connect/`),
    declineQuickConnection: (id: string) =>
      request<void>(`/chats/${id}/connect/`, 'DELETE'),
    catalog: async () => {
      const catalog = await request<Catalog>('/catalog/');
      return { ...catalog, avatar_groups: catalog.avatar_groups ?? {} };
    },
    preview: () =>
      request<{ alias: string; avatar_id: string }>('/identity-preview/'),
    randomAccess: (values: RandomAccess) =>
      request<SavedProfile & { account: Account; csrf_token: string }>(
        '/random-access/',
        'POST',
        values,
      ),
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
    socialMe: () => request<SocialProfile>('/social/me/'),
    saveSocialMe: (
      values: Partial<
        Pick<
          SocialProfile,
          | 'avatar_id'
          | 'bio'
          | 'prompt_answer'
          | 'interests'
          | 'intentions'
          | 'discoverable'
        >
      >,
    ) => request<SocialProfile>('/social/me/', 'PATCH', values),
    discover: (
      params: {
        q?: string;
        interest?: string;
        group?: string;
        offset?: number;
      } = {},
    ) =>
      request<{ results: SocialProfile[]; next_offset: number | null }>(
        `/social/discover/?${new URLSearchParams(
          Object.entries(params)
            .filter(([, value]) => value !== undefined && value !== '')
            .map(([key, value]) => [key, String(value)]),
        )}`,
      ),
    socialProfile: (id: string) =>
      request<SocialProfile>(`/social/profiles/${id}/`),
    follow: (id: string) =>
      request<SocialProfile>(`/social/profiles/${id}/follow/`, 'POST'),
    unfollow: (id: string) =>
      request<void>(`/social/profiles/${id}/follow/`, 'DELETE'),
    connect: (id: string) =>
      request<SocialConnection>(`/social/profiles/${id}/connect/`, 'POST'),
    disconnect: (id: string) =>
      request<void>(`/social/profiles/${id}/connect/`, 'DELETE'),
    connections: () =>
      request<{
        results: (SocialConnection & {
          peer: SocialProfile;
          last_message: InboxMessage | null;
        })[];
      }>(
        '/social/connections/',
      ),
    acceptConnection: (id: string) =>
      request<SocialConnection>(`/social/connections/${id}/accept/`, 'POST'),
    socialMessages: (id: string, after = 0) =>
      request<{ results: SocialMessage[] }>(
        `/social/connections/${id}/messages/?after=${after}`,
      ),
    sendSocialMessage: (id: string, body: string) =>
      request<SocialMessage>(`/social/connections/${id}/messages/`, 'POST', {
        body,
      }),
    addShowcase: (
      values: Pick<ShowcaseItem, 'kind' | 'title' | 'description'>,
    ) => request<ShowcaseItem>('/social/showcase/', 'POST', values),
    deleteShowcase: (id: string) =>
      request<void>(`/social/showcase/${id}/`, 'DELETE'),
    blockSocial: (id: string) =>
      request<void>(`/social/profiles/${id}/block/`, 'POST'),
    reportSocial: (id: string, reason: string, details: string) =>
      request<void>(`/social/profiles/${id}/report/`, 'POST', {
        reason,
        details,
      }),
  };
}

export const api = createApi();
