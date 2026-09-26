'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  LogOut,
  MessageCircle,
  Plus,
  Search,
  Send,
  Shield,
  Shuffle,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import {
  api,
  type Account,
  type Catalog,
  type InboxMessage,
  type SavedProfile,
  type SocialConnection,
  type SocialMessage,
  type SocialProfile,
} from '@/lib/api';
import { Avatar } from './avatar';
import { ChatWorkspace } from './chat-workspace';

type Tab = 'discover' | 'connections' | 'me' | 'quick';
type ConnectionRow = SocialConnection & {
  peer: SocialProfile;
  last_message: InboxMessage | null;
};

function nice(value: string) {
  return value.replaceAll('-', ' ').replaceAll('_', ' ');
}

function inboxTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toDateString() === new Date().toDateString()
    ? date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function SocialWorkspace({
  account,
  saved,
  catalog,
  onSignOut,
  onAccountChange,
}: {
  account: Account;
  saved: SavedProfile;
  catalog: Catalog;
  onSignOut: () => Promise<void>;
  onAccountChange: () => Promise<void>;
}) {
  const [tab, setTab] = useState<Tab>('discover');
  const [me, setMe] = useState<SocialProfile | null>(null);
  const [people, setPeople] = useState<SocialProfile[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [meLoading, setMeLoading] = useState(true);
  const [connections, setConnections] = useState<ConnectionRow[]>([]);
  const [selected, setSelected] = useState<SocialProfile | null>(null);
  const [openChat, setOpenChat] = useState<ConnectionRow | null>(null);
  const [messages, setMessages] = useState<SocialMessage[]>([]);
  const [messageLoading, setMessageLoading] = useState(false);
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState('');
  const [interest, setInterest] = useState('');
  const [offset, setOffset] = useState<number | null>(null);
  const [bio, setBio] = useState('');
  const [username, setUsername] = useState(saved.profile.alias);
  const [avatar, setAvatar] = useState(saved.profile.avatar_id);
  const [intentions, setIntentions] = useState<string[]>(
    saved.profile.intentions,
  );
  const [myInterests, setMyInterests] = useState<string[]>(
    saved.profile.interests,
  );
  const [discoverable, setDiscoverable] = useState(saved.profile.discoverable);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [showcaseKind, setShowcaseKind] = useState<
    'talent' | 'project' | 'interest'
  >('talent');
  const [showcaseTitle, setShowcaseTitle] = useState('');
  const [showcaseDescription, setShowcaseDescription] = useState('');
  const [email, setEmail] = useState('');
  const [challenge, setChallenge] = useState('');
  const [code, setCode] = useState('');
  const [reportReason, setReportReason] = useState('harassment');
  const [reportDetails, setReportDetails] = useState('');
  const [reportOpen, setReportOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const cursor = useRef(0);
  const inboxRequest = useRef(0);
  const activeChatId = useRef<string | null>(null);
  const refreshMessages = useRef<(() => Promise<void>) | null>(null);
  const messageScroll = useRef<HTMLDivElement>(null);
  const openChatId = openChat?.id;
  activeChatId.current = openChatId ?? null;
  const availablePortraits = (
    catalog.avatar_groups[me?.avatar_group ?? ''] ?? []
  ).filter((id) =>
    me?.gender === 'woman'
      ? id.includes('-female')
      : me?.gender === 'man'
        ? id.includes('-male')
        : true,
  );

  useEffect(() => {
    messageScroll.current?.scrollTo({
      top: messageScroll.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages.length, openChatId]);

  const loadPeople = useCallback(
    async (reset = true, nextOffset = 0) => {
      const result = await api.discover({
        q: query,
        group,
        interest,
        offset: nextOffset,
      });
      setPeople((previous) =>
        reset ? result.results : [...previous, ...result.results],
      );
      setOffset(result.next_offset);
    },
    [query, group, interest],
  );
  const loadConnections = useCallback(
    async () => {
      const request = ++inboxRequest.current;
      const result = await api.connections();
      if (request === inboxRequest.current) {
        setConnections(result.results);
        if (
          activeChatId.current &&
          !result.results.some((row) => row.id === activeChatId.current)
        ) {
          setOpenChat(null);
          setMessages([]);
          setNotice('This connection is no longer available.');
        }
      }
    },
    [],
  );
  const applySelf = useCallback((profile: SocialProfile) => {
    setMe(profile);
    setBio(profile.bio);
    setUsername(profile.alias);
    setAvatar(profile.avatar_id);
    setIntentions(profile.intentions);
    setMyInterests(profile.interests);
    setDiscoverable(Boolean(profile.discoverable));
  }, []);
  const loadMe = useCallback(async () => {
    applySelf(await api.socialMe());
  }, [applySelf]);

  useEffect(() => {
    let alive = true;
    void loadMe()
      .catch((reason) => {
        if (alive)
          setError(
            reason instanceof Error ? reason.message : 'Could not load your space.',
          );
      })
      .finally(() => {
        if (alive) setMeLoading(false);
      });
    void api.discover()
      .then((discovery) => {
        if (!alive) return;
        setPeople(discovery.results);
        setOffset(discovery.next_offset);
      })
      .catch((reason) => {
        if (alive)
          setError(
            reason instanceof Error ? reason.message : 'Discovery is unavailable.',
          );
      })
      .finally(() => {
        if (alive) setInitialLoading(false);
      });
    void loadConnections().catch((reason) => {
      if (alive)
        setError(
          reason instanceof Error ? reason.message : 'Could not load connections.',
        );
    });
    return () => {
      alive = false;
    };
  }, [loadConnections, loadMe]);
  useEffect(() => {
    const timer = setTimeout(() => {
      void loadPeople().catch((reason) =>
        setError(
          reason instanceof Error
            ? reason.message
            : 'Discovery is unavailable.',
        ),
      );
    }, 250);
    return () => clearTimeout(timer);
  }, [loadPeople]);

  useEffect(() => {
    let alive = true;
    let socket: WebSocket | null = null;
    let reconnect: ReturnType<typeof setTimeout> | null = null;
    let retry = 0;
    const sync = () => void loadConnections().catch(() => undefined);
    const connect = () => {
      if (!alive) return;
      socket = new WebSocket(
        `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws/events/`,
      );
      socket.onopen = () => {
        retry = 0;
        sync();
      };
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (
            data.type === 'social.connection.changed' ||
            data.type === 'social.message.changed' ||
            data.type === 'connection.changed'
          ) {
            sync();
            if (
              data.type === 'social.message.changed' &&
              data.connection_id === activeChatId.current
            )
              void refreshMessages.current?.();
          }
        } catch {
          // Polling recovers missed invalidations.
        }
      };
      socket.onclose = (event) => {
        if (alive && event.code !== 4401)
          reconnect = setTimeout(
            connect,
            Math.min(2000 * 2 ** retry++, 20000),
          );
      };
      socket.onerror = () => socket?.close();
    };
    connect();
    const timer = setInterval(() => {
      if (!document.hidden) sync();
    }, 15000);
    const onFocus = () => sync();
    window.addEventListener('focus', onFocus);
    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      if (reconnect) clearTimeout(reconnect);
      socket?.close();
    };
  }, [loadConnections]);

  useEffect(() => {
    if (!openChatId) {
      refreshMessages.current = null;
      return;
    }
    let alive = true;
    let inFlight = false;
    const refresh = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const page = await api.socialMessages(openChatId, cursor.current);
        if (!alive) return;
        setMessageLoading(false);
        if (page.results.length) {
          cursor.current = page.results[page.results.length - 1].id;
          setMessages((previous) => {
            const unique = new Map(
              previous.map((message) => [message.id, message]),
            );
            page.results.forEach((message) => unique.set(message.id, message));
            return [...unique.values()].sort((a, b) => a.id - b.id);
          });
          if (page.results.some((message) => !message.mine)) {
            void loadConnections().catch(() => undefined);
          }
        }
      } catch (reason) {
        if (alive) {
          setMessageLoading(false);
          setError(
            reason instanceof Error
              ? reason.message
              : 'Could not load messages.',
          );
        }
      } finally {
        inFlight = false;
      }
    };
    refreshMessages.current = refresh;
    void refresh();
    const timer = setInterval(() => {
      void refresh();
    }, 8000);
    return () => {
      alive = false;
      refreshMessages.current = null;
      clearInterval(timer);
    };
  }, [openChatId, loadConnections]);

  async function act(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  }
  async function refreshProfile(id: string) {
    const profile = await api.socialProfile(id);
    setSelected(profile);
    setPeople((previous) =>
      previous.map((person) => (person.id === id ? profile : person)),
    );
    await loadConnections();
  }
  function chooseTab(next: Tab) {
    setTab(next);
    setSelected(null);
    setOpenChat(null);
    setError('');
  }
  function openConversation(row: ConnectionRow) {
    cursor.current = 0;
    setMessages([]);
    setMessageLoading(true);
    setDraft('');
    setOpenChat(row);
    setTab('connections');
    setSelected(null);
    if (window.matchMedia('(max-width: 600px)').matches)
      requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'auto' }));
  }
  function closeConversation() {
    setOpenChat(null);
    if (window.matchMedia('(max-width: 600px)').matches)
      requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'auto' }));
  }
  async function sendMessage(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!openChat || !draft.trim() || busy) return;
    const text = draft.trim();
    await act(async () => {
      const message = await api.sendSocialMessage(openChat.id, text);
      if (activeChatId.current === openChat.id) {
        setMessages((previous) => [...previous, message]);
        setDraft('');
        void refreshMessages.current?.();
      }
      void loadConnections().catch(() => undefined);
    });
  }
  function toggleValue(
    value: string,
    values: string[],
    setter: (value: string[]) => void,
    max: number,
  ) {
    setter(
      values.includes(value)
        ? values.filter((item) => item !== value)
        : values.length < max
          ? [...values, value]
          : values,
    );
  }
  const accepted = connections.filter((item) => item.status === 'accepted');
  const pending = connections.filter((item) => item.status === 'pending');

  return (
    <div className="social-app">
      <header className="app-header">
        <div className="app-header-inner shell">
          <button className="wordmark" onClick={() => chooseTab('discover')}>
            halfknown<span>.</span>
          </button>
          <nav className="app-nav" aria-label="App navigation">
            <button
              className={tab === 'discover' ? 'active' : ''}
              aria-current={tab === 'discover' ? 'page' : undefined}
              onClick={() => chooseTab('discover')}
            >
              <Search size={18} /> Discover
            </button>
            <button
              className={tab === 'connections' ? 'active' : ''}
              aria-current={tab === 'connections' ? 'page' : undefined}
              onClick={() => chooseTab('connections')}
            >
              <Users size={18} /> Connections{' '}
              {(pending.some((item) => item.direction === 'incoming') ||
                accepted.some((item) => item.unread_count > 0)) && <i />}
            </button>
            <button
              className={tab === 'quick' ? 'active' : ''}
              aria-current={tab === 'quick' ? 'page' : undefined}
              onClick={() => chooseTab('quick')}
            >
              <Shuffle size={18} /> Quick meet
            </button>
            <button
              className={tab === 'me' ? 'active' : ''}
              aria-current={tab === 'me' ? 'page' : undefined}
              onClick={() => chooseTab('me')}
            >
              <UserRound size={18} /> My space
            </button>
          </nav>
          <div className="app-header-actions">
            <button className="mini-profile" onClick={() => chooseTab('me')}>
              <Avatar id={me?.avatar_id ?? saved.profile.avatar_id} size="small" />
              <span>{me?.alias ?? 'My space'}</span>
            </button>
          </div>
        </div>
      </header>

      {error && (
        <div className="app-toast error" role="alert">
          <span>{error}</span>
          <button onClick={() => setError('')} aria-label="Dismiss">
            <X size={16} />
          </button>
        </div>
      )}
      {notice && (
        <output className="app-toast">
          <span>{notice}</span>
          <button onClick={() => setNotice('')} aria-label="Dismiss">
            <X size={16} />
          </button>
        </output>
      )}

      <main className="app-main shell">
        {tab === 'discover' && (
          <>
            <section className="discover-hero" aria-labelledby="discover-title">
              <div className="discover-hero-copy">
                <span className="section-kicker">A DIFFERENT KIND OF CROWD</span>
                <h1 id="discover-title">
                  People worth <em>meeting.</em>
                </h1>
                <p>
                  Real people, unexpected circles. Find someone who shares
                  your kind of interesting.
                </p>
                <div className="discover-hero-actions">
                  <button
                    className="round-action"
                    onClick={() =>
                      document
                        .getElementById('discover-results')
                        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    }
                  >
                    Start discovering <ArrowRight size={19} />
                  </button>
                  <span>Connections begin with a mutual yes.</span>
                </div>
              </div>
              <div className="discover-hero-cast" aria-label="Meet a few of the Halfknown character groups">
                <div className="discover-hero-orbit discover-hero-orbit--warm" />
                <div className="discover-hero-orbit discover-hero-orbit--blue" />
                <figure className="discover-character discover-character--human">
                  <Image
                    src="/avatars/concepts/elf-female.png"
                    alt="Elf character"
                    width={520}
                    height={520}
                    priority
                  />
                  <figcaption>Elf</figcaption>
                </figure>
                <figure className="discover-character discover-character--alien">
                  <Image
                    src="/avatars/concepts/alien-male.png"
                    alt="Alien character"
                    width={520}
                    height={520}
                  />
                  <figcaption>Alien</figcaption>
                </figure>
                <figure className="discover-character discover-character--goblin">
                  <Image
                    src="/avatars/concepts/goblin-female.png"
                    alt="Goblin character"
                    width={520}
                    height={520}
                  />
                  <figcaption>Goblin</figcaption>
                </figure>
                <figure className="discover-character discover-character--animal">
                  <Image
                    src="/avatars/concepts/animal-male.png"
                    alt="Animal character"
                    width={520}
                    height={520}
                  />
                  <figcaption>Animal</figcaption>
                </figure>
                <div className="discover-cast-note">
                  <span>YOUR KIND OF PEOPLE</span>
                  <strong>There’s room for every kind.</strong>
                </div>
              </div>
            </section>
            {me && !me.discoverable && (
              <aside className="discover-entry-note">
                <div>
                  <strong>{me.photo_status === 'pending' ? 'Your photo is under review' : me.photo_status === 'approved' ? 'Ready to be seen?' : 'Want to appear in Discover?'}</strong>
                  <p>{me.photo_status === 'pending' ? 'You can keep browsing and using Quick Meet while we review it.' : me.photo_status === 'approved' ? 'Switch on Discover visibility in My space whenever you are ready.' : 'Add a real photo in My space. Quick Meet stays available without one.'}</p>
                </div>
                <button type="button" onClick={() => chooseTab('me')}>Go to My space <ArrowRight size={17} /></button>
              </aside>
            )}
            <div className="discovery-layout">
              <aside className="filter-panel">
                <h2>Find your kind of interesting</h2>
                <label className="search-field">
                  <span className="sr-only">Search people</span>
                  <Search size={18} />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search people"
                  />
                </label>
                <p className="filter-label">CHARACTER GROUP</p>
                <div className="filter-stack">
                  <button
                    className={!group ? 'selected' : ''}
                    onClick={() => setGroup('')}
                  >
                    Everyone
                  </button>
                  {Object.keys(catalog.avatar_groups ?? {}).map((item) => (
                    <button
                      key={item}
                      className={group === item ? 'selected' : ''}
                      onClick={() => setGroup(item)}
                    >
                      {nice(item)}
                    </button>
                  ))}
                </div>
                <p className="filter-label">SHARED INTEREST</p>
                <select
                  value={interest}
                  onChange={(e) => setInterest(e.target.value)}
                >
                  <option value="">Any interest</option>
                  {catalog.interests.map((item) => (
                    <option key={item} value={item}>
                      {nice(item)}
                    </option>
                  ))}
                </select>
                <div className="filter-note">
                  <Shield size={20} />
                  <span>
                    Connections are mutual. You decide who gets to message you.
                  </span>
                </div>
              </aside>
              <section className="discovery-results" id="discover-results">
                <div className="results-header">
                  <h2>Discover</h2>
                  <span>
                    {people.length
                      ? `${people.length}${offset !== null ? '+' : ''} people`
                      : 'Find your first connection'}
                  </span>
                </div>
                {initialLoading ? (
                  <div className="empty-state">
                    <h3>Looking around…</h3>
                  </div>
                ) : people.length ? (
                  <div className="profile-grid">
                    {people.map((person) => (
                      <button
                        key={person.id}
                        className="person-card"
                        onClick={() => setSelected(person)}
                      >
                        <div className="person-card-art">
                          {person.photo_url && <Image className="person-photo" src={person.photo_url} alt="" fill unoptimized />}
                          <span className="group-label">
                            <Avatar id={person.avatar_id} size="small" /> {person.avatar_group}
                          </span>
                        </div>
                        <div className="person-card-copy">
                          <div>
                            <h3>{person.alias}</h3>
                            <ArrowRight size={19} />
                          </div>
                          <p>
                            {person.bio ||
                              person.prompt_answer ||
                              'Here to meet someone new.'}
                          </p>
                          <div className="tag-row">
                            {person.interests.slice(0, 3).map((item) => (
                              <span key={item}>{nice(item)}</span>
                            ))}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <div className="empty-illustration">
                      <Avatar id="alien-female" size="large" />
                    </div>
                    <h3>It’s quiet here for now.</h3>
                    <p>
                      Try another interest or character group. New people will
                      appear here as they join.
                    </p>
                    <button
                      className="outline-action"
                      onClick={() => {
                        setQuery('');
                        setGroup('');
                        setInterest('');
                      }}
                    >
                      Clear filters
                    </button>
                  </div>
                )}
                {offset !== null && (
                  <button
                    className="load-more"
                    onClick={() => void act(() => loadPeople(false, offset))}
                  >
                    Show more people <ArrowRight size={17} />
                  </button>
                )}
              </section>
            </div>
          </>
        )}

        {tab === 'connections' && (
          <div className={openChat ? 'connections-view chat-open' : 'connections-view'}>
            <div className="simple-heading">
              <span className="section-kicker">
                KEEP THE CONVERSATION GOING
              </span>
              <h1>
                Your <em>connections.</em>
              </h1>
              <p>Messages are free when both people choose to connect.</p>
            </div>
            <div className={openChat ? 'connections-layout chat-open' : 'connections-layout'}>
              <aside className="conversation-list">
                <h2>Requests</h2>
                {pending.length ? (
                  pending.map((row) => (
                    <div className="connection-item" key={row.id}>
                      <button onClick={() => setSelected(row.peer)}>
                        <Avatar id={row.peer.avatar_id} size="small" />
                        <span>
                          <strong>{row.peer.alias}</strong>
                          <small>
                            {row.direction === 'incoming'
                              ? 'Wants to connect'
                              : 'Request sent'}
                          </small>
                        </span>
                      </button>
                      {row.direction === 'incoming' && (
                        <button
                          className="accept-small"
                          onClick={() =>
                            void act(async () => {
                              await api.acceptConnection(row.id);
                              await loadConnections();
                            })
                          }
                        >
                          Accept
                        </button>
                      )}
                      <button
                        className="dismiss-small"
                        title={
                          row.direction === 'incoming'
                            ? 'Decline request'
                            : 'Cancel request'
                        }
                        aria-label={
                          row.direction === 'incoming'
                            ? `Decline ${row.peer.alias}`
                            : `Cancel request to ${row.peer.alias}`
                        }
                        onClick={() =>
                          void act(async () => {
                            await api.disconnect(row.peer.id);
                            await loadConnections();
                          })
                        }
                      >
                        <X size={15} />
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="list-empty">No pending requests.</p>
                )}
                <h2>People you know</h2>
                {accepted.length ? (
                  accepted.map((row) => (
                    <button
                      className={`connection-item${openChat?.id === row.id ? ' active' : ''}${row.unread_count ? ' unread' : ''}`}
                      key={row.id}
                      onClick={() => openConversation(row)}
                      aria-label={`Open conversation with ${row.peer.alias}${
                        row.unread_count
                          ? `, ${row.unread_count} unread ${row.unread_count === 1 ? 'message' : 'messages'}`
                          : ''
                      }`}
                    >
                      <Avatar id={row.peer.avatar_id} size="small" />
                      <span className="connection-item-copy">
                        <strong>{row.peer.alias}</strong>
                        <small className="inbox-preview">
                          {row.last_message
                            ? `${row.last_message.mine ? 'You: ' : ''}${row.last_message.body}`
                            : 'Start a conversation'}
                        </small>
                      </span>
                      <span className="connection-item-actions" aria-hidden="true">
                        {row.last_message && (
                          <time dateTime={row.last_message.created_at}>
                            {inboxTime(row.last_message.created_at)}
                          </time>
                        )}
                        <span className="inbox-chat-icon">
                          <MessageCircle size={19} />
                          {row.unread_count > 0 && (
                            <span className="unread-count">
                              {row.unread_count > 99 ? '99+' : row.unread_count}
                            </span>
                          )}
                        </span>
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="list-empty">
                    No connections yet. Explore people and say hello.
                  </div>
                )}
              </aside>
              <section className="message-panel">
                {openChat ? (
                  <>
                    <div className="message-header">
                      <button
                        className="chat-back"
                        onClick={closeConversation}
                        aria-label="Back to conversations"
                      >
                        <ArrowLeft size={20} />
                      </button>
                      <button className="message-peer" onClick={() => setSelected(openChat.peer)}>
                        <Avatar id={openChat.peer.avatar_id} size="small" />
                        <span>
                          <strong>{openChat.peer.alias}</strong>
                          <small>Connected on Halfknown</small>
                        </span>
                      </button>
                      <button
                        className="icon-button"
                        aria-label="Close conversation"
                        onClick={() => setOpenChat(null)}
                      >
                        <X size={20} />
                      </button>
                    </div>
                    <div className="message-scroll" ref={messageScroll}>
                      {messageLoading ? (
                        <div className="conversation-start">Loading conversation…</div>
                      ) : messages.length ? (
                        messages.map((message) => (
                          <div
                            key={message.id}
                            className={
                              message.mine
                                ? 'direct-bubble mine'
                                : 'direct-bubble'
                            }
                          >
                            <p>{message.body}</p>
                            <small>
                              {new Date(message.created_at).toLocaleTimeString(
                                [],
                                { hour: 'numeric', minute: '2-digit' },
                              )}
                            </small>
                          </div>
                        ))
                      ) : (
                        <div className="conversation-start">
                          <Avatar id={openChat.peer.avatar_id} size="medium" />
                          <h3>Say hello to {openChat.peer.alias}.</h3>
                          <p>
                            Your connection is mutual. Start wherever you like.
                          </p>
                        </div>
                      )}
                    </div>
                    <form className="message-compose" onSubmit={sendMessage}>
                      <input
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        maxLength={2000}
                        placeholder="Write a message…"
                        aria-label="Write a message"
                      />
                      <button
                        disabled={busy || !draft.trim()}
                        aria-label="Send message"
                      >
                        <Send size={18} />
                      </button>
                    </form>
                  </>
                ) : (
                  <div className="message-placeholder">
                    <MessageCircle size={35} />
                    <h3>Good conversations live here.</h3>
                    <p>Select a connection to start talking.</p>
                  </div>
                )}
              </section>
            </div>
          </div>
        )}

        {tab === 'me' && !me && (
          <div className="empty-state" role="status">
            <h2>{meLoading ? 'Opening your space…' : 'Your space could not load.'}</h2>
            {!meLoading && (
              <button
                className="round-action"
                onClick={() =>
                  void act(async () => {
                    setMeLoading(true);
                    try {
                      await loadMe();
                    } finally {
                      setMeLoading(false);
                    }
                  })
                }
              >
                Try again
              </button>
            )}
          </div>
        )}
        {tab === 'me' && me && (
          <>
            <div className="simple-heading">
              <span className="section-kicker">A LITTLE ABOUT YOU</span>
              <h1>
                Make this space <em>yours.</em>
              </h1>
              <p>
                Your character opens the door. The rest of your story is up to
                you.
              </p>
            </div>
            <div className="my-layout">
              <section className="profile-editor">
                <div className="editor-title">
                  <Avatar id={me.avatar_id} size="medium" />
                  <div>
                    <h2>{me.alias}</h2>
                    <span>{me.avatar_group} character</span>
                    <small className="profile-follow-count">
                      {me.followers_count} {me.followers_count === 1 ? 'follower' : 'followers'}
                    </small>
                  </div>
                </div>
                <div className="photo-settings">
                  <div className="photo-settings-preview">
                    {me.photo_url ? <Image src={me.photo_url} alt="Your profile" fill unoptimized /> : <Avatar id={me.avatar_id} size="large" />}
                  </div>
                  <div>
                    <h3>Your real photo</h3>
                    <p>Upload a clear photo of yourself to appear in Discover. Quick Meet still uses your creature portrait.</p>
                    <label className="photo-upload-button">
                      {photoUploading ? 'Uploading…' : me.photo_url ? 'Replace photo' : 'Upload photo'}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        disabled={photoUploading || busy}
                        onChange={(event) => {
                          const file = event.currentTarget.files?.[0];
                          if (!file) return;
                          const input = event.currentTarget;
                          setPhotoUploading(true);
                          setError('');
                          void api.uploadSocialPhoto(file).then((profile) => {
                            applySelf(profile);
                            setNotice('Photo uploaded. It will appear after review.');
                          }).catch((reason) => setError(reason instanceof Error ? reason.message : 'Photo upload failed.'))
                            .finally(() => { setPhotoUploading(false); input.value = ''; });
                        }}
                      />
                    </label>
                    {me.photo_status === 'pending' && <small>Awaiting photo review. Your profile is hidden from Discover.</small>}
                    {me.photo_status === 'rejected' && <small>This photo was not approved. Please upload a different one.</small>}
                    {me.photo_status === 'approved' && <small>Photo approved. You can choose to appear in Discover below.</small>}
                    {me.photo_url && <button type="button" className="photo-remove" disabled={busy || photoUploading} onClick={() => void act(async () => { applySelf(await api.removeSocialPhoto()); setNotice('Photo removed. Your profile is hidden from Discover.'); })}>Remove photo</button>}
                  </div>
                </div>
                <label className="form-label">
                  Your username
                  <input
                    value={username}
                    onChange={(event) => setUsername(event.target.value.toLowerCase())}
                    minLength={3}
                    maxLength={24}
                    pattern="[a-z][a-z0-9_]{2,23}"
                    title="3–24 letters, numbers or underscores; start with a letter"
                    required
                  />
                  <small>3–24 letters, numbers or underscores. Start with a letter.</small>
                </label>
                <label className="form-label">
                  Your introduction
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    maxLength={300}
                    rows={3}
                    placeholder="A little about yourself and what brings you here…"
                  />
                </label>
                <span className="field-hint">{bio.length}/300 characters</span>
                <h3>Here for</h3>
                <div className="choice-pills">
                  {catalog.intentions.map((item) => (
                    <button
                      key={item}
                      className={intentions.includes(item) ? 'on' : ''}
                      onClick={() =>
                        toggleValue(item, intentions, setIntentions, 4)
                      }
                    >
                      {nice(item)}
                    </button>
                  ))}
                </div>
                <h3>Interests</h3>
                <div className="choice-pills">
                  {catalog.interests.map((item) => (
                    <button
                      key={item}
                      className={myInterests.includes(item) ? 'on' : ''}
                      onClick={() =>
                        toggleValue(item, myInterests, setMyInterests, 5)
                      }
                    >
                      {nice(item)}
                    </button>
                  ))}
                </div>
                <label
                  className="visibility-choice"
                  htmlFor="profile-visibility"
                >
                  <input
                    id="profile-visibility"
                    aria-label="Show me in Discover"
                    type="checkbox"
                    checked={discoverable}
                    disabled={me.photo_status !== 'approved' || !me.photo_url}
                    onChange={(e) => setDiscoverable(e.target.checked)}
                  />
                  <span>
                    <strong>Show me in Discover</strong>
                    <small>
                      Your approved photo, creature group and profile become visible to others.
                    </small>
                  </span>
                </label>
                <button
                  className="round-action editor-save"
                  disabled={busy}
                  onClick={() =>
                    void act(async () => {
                      const profile = await api.saveSocialMe({
                        ...(username.trim() !== me.alias ? { username: username.trim() } : {}),
                        bio,
                        intentions,
                        interests: myInterests,
                        discoverable,
                      });
                      applySelf(profile);
                      setNotice('Your space is updated.');
                    })
                  }
                >
                  Save my profile <Check size={18} />
                </button>
              </section>
              <aside className="my-side">
                <section className="side-card">
                  <span className="section-kicker">YOUR SHOWCASE</span>
                  <h2>What’s your thing?</h2>
                  <p>
                    Share a talent, a project or something you love. It gives
                    people an easy way to start a conversation.
                  </p>
                  {me.showcase.map((item) => (
                    <div className="showcase-item" key={item.id}>
                      <span>{nice(item.kind)}</span>
                      <strong>{item.title}</strong>
                      <p>{item.description}</p>
                      <button
                        aria-label={`Remove ${item.title}`}
                        onClick={() =>
                          void act(async () => {
                            await api.deleteShowcase(item.id);
                            setMe(await api.socialMe());
                          })
                        }
                      >
                        <X size={15} />
                      </button>
                    </div>
                  ))}
                  {me.showcase.length < 6 && (
                    <form
                      className="showcase-form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void act(async () => {
                          await api.addShowcase({
                            kind: showcaseKind,
                            title: showcaseTitle,
                            description: showcaseDescription,
                          });
                          setMe(await api.socialMe());
                          setShowcaseTitle('');
                          setShowcaseDescription('');
                          setNotice('Added to your showcase.');
                        });
                      }}
                    >
                      <select
                        value={showcaseKind}
                        onChange={(e) =>
                          setShowcaseKind(e.target.value as typeof showcaseKind)
                        }
                      >
                        <option value="talent">Talent</option>
                        <option value="project">Project</option>
                        <option value="interest">Interest</option>
                      </select>
                      <input
                        required
                        maxLength={80}
                        value={showcaseTitle}
                        onChange={(e) => setShowcaseTitle(e.target.value)}
                        placeholder="Give it a title"
                      />
                      <textarea
                        required
                        maxLength={300}
                        rows={3}
                        value={showcaseDescription}
                        onChange={(e) => setShowcaseDescription(e.target.value)}
                        placeholder="Tell people a little about it"
                      />
                      <button
                        disabled={
                          busy ||
                          !showcaseTitle.trim() ||
                          !showcaseDescription.trim()
                        }
                      >
                        <Plus size={17} /> Add to showcase
                      </button>
                    </form>
                  )}
                </section>
                <section className="side-card account-card">
                  <span className="section-kicker">ACCOUNT</span>
                  <h2>
                    {account.is_guest
                      ? 'Keep your connections'
                      : 'Your account'}
                  </h2>
                  {account.is_guest ? (
                    <>
                      <p>
                        Add an email so you can return to your profile on
                        another device.
                      </p>
                      {!challenge ? (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            void act(async () => {
                              const result = await api.requestCode(email);
                              setChallenge(result.challenge_id);
                              setNotice(
                                'Check your email for a six-digit code.',
                              );
                            });
                          }}
                        >
                          <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                          />
                          <button disabled={busy}>
                            Send code <ArrowRight size={16} />
                          </button>
                        </form>
                      ) : (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            void act(async () => {
                              await api.verifyCode(challenge, code);
                              await onAccountChange();
                              setChallenge('');
                              setCode('');
                              setNotice('Your email is connected.');
                            });
                          }}
                        >
                          <input
                            inputMode="numeric"
                            maxLength={6}
                            pattern="[0-9]{6}"
                            required
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            placeholder="Six-digit code"
                          />
                          <button disabled={busy}>
                            Verify email <Check size={16} />
                          </button>
                        </form>
                      )}
                    </>
                  ) : (
                    <p>Signed in as {account.email}</p>
                  )}
                  <button
                    className="logout-button"
                    onClick={() => void act(onSignOut)}
                  >
                    <LogOut size={16} /> Sign out
                  </button>
                </section>
              </aside>
            </div>
            <section className="avatar-settings">
              <span className="section-kicker">YOUR CHARACTER</span>
              <h2>Manage your portrait</h2>
              <p>
                You belong to the {me.avatar_group} group. Portraits from other
                creature groups aren’t available to this profile.
              </p>
              <div className="avatar-choices">
                {availablePortraits.map((id) => (
                    <button
                      type="button"
                      className={avatar === id ? 'chosen' : ''}
                      key={id}
                      onClick={() => setAvatar(id)}
                      aria-label={`${me.avatar_group} portrait ${id.includes('-female') ? 'female' : 'male'}`}
                      aria-pressed={avatar === id}
                    >
                      <Avatar id={id} size="medium" />
                      <span>{id.includes('-female') ? 'Feminine' : 'Masculine'}</span>
                    </button>
                ))}
              </div>
              {availablePortraits.length === 1 && (
                <p className="avatar-settings-note">More portraits for your group are coming later.</p>
              )}
              {avatar !== me.avatar_id && (
                <button
                  type="button"
                  className="round-action"
                  disabled={busy}
                  onClick={() =>
                    void act(async () => {
                      applySelf(await api.saveSocialMe({ avatar_id: avatar }));
                      setNotice('Your portrait is updated.');
                    })
                  }
                >
                  Save portrait <Check size={18} />
                </button>
              )}
            </section>
          </>
        )}

        {tab === 'quick' && (
          <div className="quick-wrap">
            <ChatWorkspace
              saved={{
                ...saved,
                profile: {
                  ...saved.profile,
                  avatar_id: me?.avatar_id ?? saved.profile.avatar_id,
                  interests: me?.interests ?? saved.profile.interests,
                },
              }}
            />
          </div>
        )}
      </main>

      {selected && (
        <div
          className="profile-overlay"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setSelected(null);
          }}
        >
          <dialog
            className="profile-drawer"
            open
            aria-modal="true"
            aria-label={`${selected.alias}'s profile`}
          >
            <button
              className="drawer-close"
              onClick={() => setSelected(null)}
              aria-label="Close profile"
            >
              <X size={20} />
            </button>
            <div className="drawer-art">
              {selected.photo_url ? <Image className="drawer-photo" src={selected.photo_url} alt={selected.alias} fill unoptimized /> : <Avatar id={selected.avatar_id} size="large" />}
              <span><Avatar id={selected.avatar_id} size="small" /> {selected.avatar_group} character</span>
            </div>
            <div className="drawer-body">
              <span className="section-kicker">GET TO KNOW ME</span>
              <h2>{selected.alias}</h2>
              <span className="profile-follow-count">
                {selected.followers_count} {selected.followers_count === 1 ? 'follower' : 'followers'}
              </span>
              <p className="drawer-bio">
                {selected.bio ||
                  selected.prompt_answer ||
                  'Here to meet good people and see where it goes.'}
              </p>
              <div className="tag-row">
                {selected.interests.map((item) => (
                  <span key={item}>{nice(item)}</span>
                ))}
              </div>
              <div className="drawer-meta">
                <span>Here for</span>
                <strong>
                  {selected.intentions.map(nice).join(' · ') || 'Conversation'}
                </strong>
              </div>
              {selected.showcase.length > 0 && (
                <div className="drawer-showcase">
                  <h3>More of their world</h3>
                  {selected.showcase.map((item) => (
                    <article key={item.id}>
                      <small>{nice(item.kind)}</small>
                      <strong>{item.title}</strong>
                      <p>{item.description}</p>
                    </article>
                  ))}
                </div>
              )}
              <div className="drawer-actions">
                <button
                  className="outline-action"
                  disabled={busy}
                  onClick={() =>
                    void act(async () => {
                      if (selected.following) await api.unfollow(selected.id);
                      else await api.follow(selected.id);
                      await refreshProfile(selected.id);
                    })
                  }
                >
                  {selected.following ? (
                    <Check size={17} />
                  ) : (
                    <Plus size={17} />
                  )}
                  {selected.following ? 'Following' : 'Follow'}
                </button>
                {selected.connection?.status === 'accepted' ? (
                  <button
                    className="round-action"
                    onClick={() => {
                      const row = connections.find(
                        (item) => item.id === selected.connection?.id,
                      );
                      if (row) openConversation(row);
                    }}
                  >
                    <MessageCircle size={17} /> Message
                  </button>
                ) : selected.connection?.status === 'pending' &&
                  selected.connection.direction === 'incoming' ? (
                  <button
                    className="round-action"
                    disabled={busy}
                    onClick={() =>
                      void act(async () => {
                        await api.acceptConnection(selected.connection!.id);
                        await refreshProfile(selected.id);
                      })
                    }
                  >
                    Accept request <Check size={17} />
                  </button>
                ) : (
                  <button
                    className="round-action"
                    disabled={busy || Boolean(selected.connection)}
                    onClick={() =>
                      void act(async () => {
                        await api.connect(selected.id);
                        await refreshProfile(selected.id);
                      })
                    }
                  >
                    {selected.connection?.status === 'pending'
                      ? 'Request sent'
                      : selected.connection?.status === 'declined'
                        ? 'Not this time'
                        : 'Connect'}{' '}
                    <ArrowRight size={17} />
                  </button>
                )}
              </div>
              <div className="drawer-safety">
                <button onClick={() => setReportOpen(true)}>Report</button>
                <button
                  onClick={() =>
                    void act(async () => {
                      await api.blockSocial(selected.id);
                      setSelected(null);
                      await loadPeople();
                      await loadConnections();
                      setNotice('This person is blocked.');
                    })
                  }
                >
                  Block
                </button>
              </div>
            </div>
          </dialog>
        </div>
      )}

      {reportOpen && selected && (
        <div className="report-overlay">
          <form
            className="report-dialog"
            onSubmit={(e) => {
              e.preventDefault();
              void act(async () => {
                await api.reportSocial(
                  selected.id,
                  reportReason,
                  reportDetails,
                );
                setReportOpen(false);
                setSelected(null);
                await loadPeople();
                await loadConnections();
                setNotice(
                  'Report received. This person is blocked from contacting you.',
                );
              });
            }}
          >
            <button
              type="button"
              className="drawer-close"
              onClick={() => setReportOpen(false)}
              aria-label="Close"
            >
              <X size={20} />
            </button>
            <h2>Report {selected.alias}</h2>
            <p>
              Our team can review your report. Recent messages are included if
              you’ve chatted.
            </p>
            <label>
              Reason
              <select
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
              >
                {[
                  'harassment',
                  'sexual_content',
                  'underage',
                  'spam',
                  'threats',
                  'other',
                ].map((item) => (
                  <option key={item} value={item}>
                    {nice(item)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Details (optional)
              <textarea
                value={reportDetails}
                onChange={(e) => setReportDetails(e.target.value)}
                maxLength={2000}
                rows={4}
              />
            </label>
            <button className="round-action" disabled={busy}>
              Send report
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
