'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import {
  ArrowRight,
  Check,
  LogOut,
  Menu,
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
  type SavedProfile,
  type SocialConnection,
  type SocialMessage,
  type SocialProfile,
} from '@/lib/api';
import { Avatar, avatarOptions } from './avatar';
import { ChatWorkspace } from './chat-workspace';

type Tab = 'discover' | 'connections' | 'me' | 'quick';
type ConnectionRow = SocialConnection & { peer: SocialProfile };

function nice(value: string) {
  return value.replaceAll('-', ' ').replaceAll('_', ' ');
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
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState('');
  const [interest, setInterest] = useState('');
  const [offset, setOffset] = useState<number | null>(null);
  const [bio, setBio] = useState('');
  const [avatar, setAvatar] = useState(saved.profile.avatar_id);
  const [intentions, setIntentions] = useState<string[]>(
    saved.profile.intentions,
  );
  const [myInterests, setMyInterests] = useState<string[]>(
    saved.profile.interests,
  );
  const [discoverable, setDiscoverable] = useState(saved.profile.discoverable);
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
  const [menuOpen, setMenuOpen] = useState(false);
  const cursor = useRef(0);
  const messageScroll = useRef<HTMLDivElement>(null);
  const openChatId = openChat?.id;

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
    async () => setConnections((await api.connections()).results),
    [],
  );
  const applySelf = useCallback((profile: SocialProfile) => {
    setMe(profile);
    setBio(profile.bio);
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
    if (tab !== 'connections') return;
    let alive = true;
    void loadConnections().catch((reason) => {
      if (alive)
        setError(
          reason instanceof Error ? reason.message : 'Could not load connections.',
        );
    });
    const timer = setInterval(() => {
      void loadConnections().catch(() => undefined);
    }, 8000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [tab, loadConnections]);

  useEffect(() => {
    if (!openChatId) return;
    let alive = true;
    const refresh = async () => {
      try {
        const page = await api.socialMessages(openChatId, cursor.current);
        if (!alive) return;
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
        if (alive)
          setError(
            reason instanceof Error
              ? reason.message
              : 'Could not load messages.',
          );
      }
    };
    void refresh();
    const timer = setInterval(() => {
      void refresh();
    }, 4000);
    return () => {
      alive = false;
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
    setMenuOpen(false);
    setError('');
  }
  function openConversation(row: ConnectionRow) {
    cursor.current = 0;
    setMessages([]);
    setDraft('');
    setOpenChat(row);
    setTab('connections');
    setSelected(null);
  }
  async function sendMessage(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!openChat || !draft.trim() || busy) return;
    const text = draft.trim();
    await act(async () => {
      const message = await api.sendSocialMessage(openChat.id, text);
      setMessages((previous) => [...previous, message]);
      setDraft('');
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
          <nav
            className={menuOpen ? 'app-nav open' : 'app-nav'}
            aria-label="App navigation"
          >
            <button
              className={tab === 'discover' ? 'active' : ''}
              onClick={() => chooseTab('discover')}
            >
              <Search size={18} /> Discover
            </button>
            <button
              className={tab === 'connections' ? 'active' : ''}
              onClick={() => chooseTab('connections')}
            >
              <Users size={18} /> Connections{' '}
              {pending.some((item) => item.direction === 'incoming') && <i />}
            </button>
            <button
              className={tab === 'quick' ? 'active' : ''}
              onClick={() => chooseTab('quick')}
            >
              <Shuffle size={18} /> Quick meet
            </button>
            <button
              className={tab === 'me' ? 'active' : ''}
              onClick={() => chooseTab('me')}
            >
              <UserRound size={18} /> My space
            </button>
          </nav>
          <div className="app-header-actions">
            <button className="mini-profile" onClick={() => chooseTab('me')}>
              <Avatar id={avatar} size="small" />
              <span>{me?.alias ?? 'My space'}</span>
            </button>
            <button
              className="mobile-menu"
              aria-label="Toggle menu"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <Menu />
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
                  Curious humans, otherworldly characters, and everyone in
                  between. Find someone who shares your kind of interesting.
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
                    src="/avatars/concepts/human-female.png"
                    alt="Human character"
                    width={520}
                    height={520}
                    priority
                  />
                  <figcaption>Human</figcaption>
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
                          <Avatar id={person.avatar_id} size="large" />
                          <span className="group-label">
                            {person.avatar_group}
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
                      <Avatar id="alien-01" size="large" />
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
          <>
            <div className="simple-heading">
              <span className="section-kicker">
                KEEP THE CONVERSATION GOING
              </span>
              <h1>
                Your <em>connections.</em>
              </h1>
              <p>Messages are free when both people choose to connect.</p>
            </div>
            <div className="connections-layout">
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
                      className={
                        openChat?.id === row.id
                          ? 'connection-item active'
                          : 'connection-item'
                      }
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
                        <small>Open conversation</small>
                      </span>
                      <span className="connection-item-actions" aria-hidden="true">
                        <MessageCircle size={19} />
                        {row.unread_count > 0 && (
                          <span className="unread-count">
                            {row.unread_count > 99 ? '99+' : row.unread_count}
                          </span>
                        )}
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
                      <button onClick={() => setSelected(openChat.peer)}>
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
                      {messages.length ? (
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
          </>
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
                  <Avatar id={avatar} size="medium" />
                  <div>
                    <h2>{me.alias}</h2>
                    <span>{avatar.split('-')[0]} character</span>
                  </div>
                </div>
                <h3>Choose your character</h3>
                <div className="avatar-choices">
                  {avatarOptions.map((item) => (
                    <button
                      className={avatar === item.id ? 'chosen' : ''}
                      key={item.id}
                      onClick={() => setAvatar(item.id)}
                      aria-label={item.label}
                      aria-pressed={avatar === item.id}
                    >
                      <Avatar id={item.id} size="medium" />
                      <span>{item.group}</span>
                    </button>
                  ))}
                </div>
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
                    onChange={(e) => setDiscoverable(e.target.checked)}
                  />
                  <span>
                    <strong>Show me in Discover</strong>
                    <small>
                      People can see your character, introduction and showcase.
                    </small>
                  </span>
                </label>
                <button
                  className="round-action editor-save"
                  disabled={busy}
                  onClick={() =>
                    void act(async () => {
                      const profile = await api.saveSocialMe({
                        avatar_id: avatar,
                        bio,
                        intentions,
                        interests: myInterests,
                        discoverable,
                      });
                      setMe(profile);
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
          </>
        )}

        {tab === 'quick' && (
          <>
            <div className="simple-heading">
              <span className="section-kicker">LET CHANCE HAVE A TURN</span>
              <h1>
                Meet someone <em>unexpected.</em>
              </h1>
              <p>
                A private conversation with someone online. You can leave
                whenever you like.
              </p>
            </div>
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
          </>
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
              <Avatar id={selected.avatar_id} size="large" />
              <span>{selected.avatar_group} character</span>
            </div>
            <div className="drawer-body">
              <span className="section-kicker">GET TO KNOW ME</span>
              <h2>{selected.alias}</h2>
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
