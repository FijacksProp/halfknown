'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Heart,
  MessageCircle,
  Send,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import {
  api,
  type Chat,
  type ChatMessage,
  type MatchMode,
  type MatchState,
  type SavedProfile,
} from '@/lib/api';
import { label } from '@/lib/onboarding';

export function ChatWorkspace({
  saved,
  onPreferences,
}: {
  saved: SavedProfile;
  onPreferences: () => void;
}) {
  const [state, setState] = useState<MatchState>({ state: 'idle' });
  const [intention, setIntention] = useState(
    saved.profile.intentions[0] ?? 'conversation',
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [connected, setConnected] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);
  const [safety, setSafety] = useState<'leave' | 'block' | 'report' | null>(
    null,
  );
  const [reason, setReason] = useState('harassment');
  const [details, setDetails] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const currentChat = useRef<Chat | null>(null);
  const cursor = useRef(0);
  const refreshing = useRef(false);
  const refreshAgain = useRef(false);
  const working = useRef(false);
  const mounted = useRef(false);
  const revision = useRef(0);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTyping = useRef(0);
  const pending = useRef<{ id: string; body: string; chat: string } | null>(
    null,
  );
  const scrollArea = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async function syncConversation() {
    if (!mounted.current || working.current) return;
    if (refreshing.current) {
      refreshAgain.current = true;
      return;
    }
    refreshing.current = true;
    const epoch = revision.current;
    try {
      const next = await api.heartbeat();
      if (!mounted.current || epoch !== revision.current) return;
      const chat =
        'id' in next
          ? next
          : next.state === 'idle'
            ? currentChat.current
            : null;
      if (chat) {
        if (currentChat.current?.id !== chat.id) {
          cursor.current = 0;
          setMessages([]);
          setDraft('');
          pending.current = null;
          setPeerTyping(false);
        }
        currentChat.current = chat;
        let more = true;
        while (more) {
          const page = await api.messages(chat.id, cursor.current);
          if (!mounted.current || epoch !== revision.current) return;
          setMessages((previous) => {
            const unique = new Map(previous.map((m) => [m.id, m]));
            page.messages.forEach((m) => unique.set(m.id, m));
            return [...unique.values()].sort((a, b) => a.id - b.id).slice(-500);
          });
          cursor.current = page.messages.at(-1)?.id ?? cursor.current;
          more = page.has_more;
          currentChat.current = page.conversation;
          setState(page.conversation);
        }
      } else {
        setState(next);
      }
      setLoaded(true);
    } catch (err) {
      if (mounted.current && epoch === revision.current)
        setError(
          err instanceof Error
            ? err.message
            : 'Could not update your conversation.',
        );
    } finally {
      refreshing.current = false;
      if (refreshAgain.current && mounted.current) {
        refreshAgain.current = false;
        setTimeout(() => void syncConversation(), 0);
      }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    let socket: WebSocket | null = null;
    let reconnect: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;
    const connect = () => {
      if (stopped) return;
      socket = new WebSocket(
        `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws/events/`,
      );
      socket.onopen = () => {
        if (!stopped) {
          setConnected(true);
          void refresh();
        }
      };
      socket.onmessage = (event) => {
        if (stopped) return;
        try {
          const data = JSON.parse(event.data);
          if (
            data.type === 'chat.typing' &&
            data.conversation_id === currentChat.current?.id
          ) {
            setPeerTyping(true);
            if (typingTimer.current) clearTimeout(typingTimer.current);
            typingTimer.current = setTimeout(() => setPeerTyping(false), 4000);
          } else if (
            data.type === 'chat.changed' ||
            data.type === 'match.changed'
          )
            void refresh();
        } catch {
          /* Ignore malformed notifications; REST remains authoritative. */
        }
      };
      socket.onclose = (event) => {
        if (stopped) return;
        setConnected(false);
        if (event.code !== 4401) reconnect = setTimeout(connect, 3000);
        else setError('Your session ended. Sign in again to continue.');
      };
      socket.onerror = () => socket?.close();
    };
    connect();
    const initialRefresh = setTimeout(() => void refresh(), 0);
    const poll = setInterval(() => void refresh(), 10000);
    const clock = setInterval(() => setNow(Date.now()), 1000);
    const ping = setInterval(() => {
      if (socket?.readyState === WebSocket.OPEN)
        socket.send(JSON.stringify({ type: 'ping' }));
    }, 20000);
    const online = () => void refresh();
    window.addEventListener('online', online);
    return () => {
      stopped = true;
      mounted.current = false;
      revision.current += 1;
      socket?.close();
      if (reconnect) clearTimeout(reconnect);
      if (typingTimer.current) clearTimeout(typingTimer.current);
      clearTimeout(initialRefresh);
      clearInterval(poll);
      clearInterval(clock);
      clearInterval(ping);
      window.removeEventListener('online', online);
    };
  }, [refresh]);

  useEffect(() => {
    const area = scrollArea.current;
    if (area && area.scrollHeight - area.scrollTop - area.clientHeight < 250)
      area.scrollTop = area.scrollHeight;
  }, [messages]);

  async function action(work: () => Promise<unknown>) {
    if (working.current) return;
    working.current = true;
    revision.current += 1;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await work();
    } catch (err) {
      if (mounted.current)
        setError(err instanceof Error ? err.message : 'Please try again.');
    } finally {
      working.current = false;
      if (mounted.current) {
        setBusy(false);
        void refresh();
      }
    }
  }

  function join(mode: MatchMode) {
    void action(async () => {
      const result = await api.joinQueue(mode, intention);
      currentChat.current = null;
      cursor.current = 0;
      pending.current = null;
      setMessages([]);
      setDraft('');
      setState(result);
    });
  }

  function send() {
    if (state.state !== 'active' || !draft.trim() || busy) return;
    const chatId = state.id;
    const body = draft.trim();
    if (
      !pending.current ||
      pending.current.body !== body ||
      pending.current.chat !== chatId
    ) {
      pending.current = { id: crypto.randomUUID(), body, chat: chatId };
    }
    const attempt = pending.current;
    void action(async () => {
      const message = await api.sendMessage(chatId, attempt.id, body);
      setMessages((previous) =>
        [...previous.filter((m) => m.id !== message.id), message]
          .sort((a, b) => a.id - b.id)
          .slice(-500),
      );
      setDraft('');
      pending.current = null;
      setNotice('Message saved.');
    });
  }

  function confirmSafety() {
    const selected = safety;
    const chat = 'id' in state ? state : null;
    void action(async () => {
      if (selected === 'report' && chat) {
        await api.reportChat(chat.id, reason, details);
        setNotice('Report saved for staff review. This person is now blocked.');
      } else if (selected === 'block' && chat) {
        await api.blockChat(chat.id);
        setNotice('This person is now blocked.');
      } else await api.leaveChat();
      setSafety(null);
      setDetails('');
      if (chat) setState({ ...chat, state: 'ended' });
      else setState({ state: 'idle' });
    });
  }

  const chat = 'id' in state ? state : null;
  const canJoin = state.state === 'idle' || state.state === 'ended';
  const seconds = chat
    ? Math.max(0, Math.ceil((Date.parse(chat.expires_at) - now) / 1000))
    : 0;

  return (
    <section className="chat-workspace" aria-labelledby="chat-title">
      <div className="chat-heading">
        <div>
          <span className="eyebrow">Hello, {saved.profile.alias}</span>
          <h1 id="chat-title">Who will you meet?</h1>
        </div>
        <output className="connection-status">
          {connected ? 'Live updates connected' : 'Reconnecting live updates…'}
        </output>
      </div>
      <p className="chat-privacy">
        <ShieldCheck size={18} aria-hidden="true" />
        18+ development preview. Messages are stored on the server, not
        end-to-end encrypted. Reports share the latest 20 messages with staff.
      </p>
      {error && (
        <div className="form-error" role="alert">
          {error}{' '}
          <Button
            variant="ghost"
            onClick={() => {
              setError('');
              void refresh();
            }}
          >
            Refresh
          </Button>
        </div>
      )}
      {notice && <output className="chat-notice">{notice}</output>}
      {!loaded && <output>Checking for an existing conversation…</output>}
      {state.state === 'ended' && (
        <output className="chat-ended">
          This conversation has ended
          {state.end_reason === 'disconnected'
            ? ' because someone lost connection'
            : state.end_reason === 'expired'
              ? ' because the invitation expired'
              : ''}
          . You can report or block it below, or choose another introduction.
        </output>
      )}
      {canJoin && (
        <>
          <label className="chat-intention">
            What are you here for today?
            <NativeSelect
              value={intention}
              onChange={(event) => setIntention(event.target.value)}
            >
              {saved.profile.intentions.map((value) => (
                <NativeSelectOption key={value} value={value}>
                  {label(value)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </label>
          <div className="mode-grid">
            <div className="mode-card mode-card-open">
              <MessageCircle aria-hidden="true" />
              <h2 className="mode-title">Open Chat</h2>
              <p className="mode-description">
                Meet an eligible adult who also opted in. Gender filters don’t
                apply; age limits, language, intention, and blocks still do.
              </p>
              <Button
                className="join-button"
                disabled={
                  busy || !loaded || !saved.preferences.open_chat_opt_in
                }
                onClick={() => join('open')}
              >
                {saved.preferences.open_chat_opt_in
                  ? 'Find an introduction'
                  : 'Enable in preferences'}
                <ArrowRight aria-hidden="true" />
              </Button>
            </div>
            <div className="mode-card mode-card-match">
              <Heart aria-hidden="true" />
              <h2 className="mode-title">Compatible Match</h2>
              <p className="mode-description">
                Mutual gender and age preferences, a shared language, and your
                chosen intention. Shared interests help choose between eligible
                people.
              </p>
              <Button
                className="join-button"
                disabled={busy || !loaded}
                onClick={() => join('compatible')}
              >
                Find an introduction
                <ArrowRight aria-hidden="true" />
              </Button>
            </div>
          </div>
          <Button
            variant="outline"
            className="edit-profile"
            disabled={busy}
            onClick={onPreferences}
          >
            Edit matching preferences
          </Button>
        </>
      )}
      {state.state === 'waiting' && (
        <div className="waiting-panel">
          <span className="eyebrow">
            {label(state.mode)} · {label(state.intention)}
          </span>
          <h2>Waiting for someone eligible</h2>
          <p>
            Keep this page open. We won’t relax your boundaries to make a match.
            There may be nobody else online yet.
          </p>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() =>
              void action(async () => {
                await api.leaveChat();
                setState({ state: 'idle' });
              })
            }
          >
            Cancel search
          </Button>
        </div>
      )}
      {state.state === 'invited' && (
        <div className="invitation-panel">
          <span className="eyebrow">
            An introduction for you · {seconds}s remaining
          </span>
          <h2>Meet {state.peer.alias}</h2>
          <p>
            {state.peer.shared_interests.length
              ? `You both like ${state.peer.shared_interests.map(label).join(', ')}.`
              : `You’re both here for ${label(state.intention).toLowerCase()}.`}
          </p>
          <p>
            Chat opens only when you both accept. No real names or photos
            required.
          </p>
          <div className="chat-actions">
            <Button
              disabled={busy || state.accepted || seconds === 0}
              onClick={() =>
                void action(async () => {
                  setState(await api.acceptChat(state.id));
                })
              }
            >
              {state.accepted
                ? 'Waiting for their answer…'
                : 'Accept introduction'}
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setSafety('leave')}
            >
              Decline
            </Button>
          </div>
        </div>
      )}
      {chat && (state.state === 'active' || state.state === 'ended') && (
        <div className="conversation-panel">
          <header className="conversation-header">
            <div>
              <h2>{chat.peer.alias}</h2>
              <span>
                {label(chat.intention)} ·{' '}
                {state.state === 'active'
                  ? 'Conversation open'
                  : 'Conversation ended'}
              </span>
            </div>
            <div className="chat-actions">
              {state.state === 'active' && (
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => setSafety('leave')}
                >
                  Leave
                </Button>
              )}
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => setSafety('block')}
              >
                Block
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => setSafety('report')}
              >
                Report
              </Button>
            </div>
          </header>
          <div
            className="message-list"
            ref={scrollArea}
            role="log"
            aria-label="Conversation messages"
            aria-live="polite"
            aria-relevant="additions text"
          >
            {messages.length === 0 && (
              <p className="message-empty">
                You both said yes. Say hello when you’re ready.
              </p>
            )}
            {messages.length >= 500 && (
              <p className="message-empty">Showing the latest 500 messages.</p>
            )}
            {messages.map((message) => (
              <article
                className={`chat-message ${message.mine ? 'is-mine' : ''}`}
                key={message.id}
              >
                <span className="message-author">
                  {message.mine ? 'You' : chat.peer.alias}
                </span>
                <p>{message.body}</p>
                <small>
                  {new Date(message.created_at).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  {message.mine ? ' · Saved' : ''}
                </small>
              </article>
            ))}
          </div>
          {state.state === 'active' && (
            <form
              className="message-composer"
              onSubmit={(event) => {
                event.preventDefault();
                send();
              }}
            >
              <output className="typing-status">
                {peerTyping
                  ? `${chat.peer.alias} is typing…`
                  : 'Take your time. Share only what feels right.'}
              </output>
              <label className="sr-only" htmlFor="chat-message">
                Your message
              </label>
              <Textarea
                id="chat-message"
                value={draft}
                maxLength={2000}
                disabled={busy}
                placeholder="Say hello…"
                onChange={(event) => {
                  setDraft(event.target.value);
                  if (
                    Date.now() - lastTyping.current > 3000 &&
                    event.target.value.trim()
                  ) {
                    lastTyping.current = Date.now();
                    void api.typing(chat.id).catch(() => {});
                  }
                }}
                onKeyDown={(event) => {
                  if (
                    event.key === 'Enter' &&
                    !event.shiftKey &&
                    !event.nativeEvent.isComposing
                  ) {
                    event.preventDefault();
                    send();
                  }
                }}
              />
              <div className="composer-bottom">
                <small>
                  {draft.length}/2000 · Shift + Enter for a new line
                </small>
                <Button type="submit" disabled={busy || !draft.trim()}>
                  <Send size={16} aria-hidden="true" />
                  {busy ? 'Sending…' : 'Send'}
                </Button>
              </div>
            </form>
          )}
        </div>
      )}
      <AlertDialog
        open={safety !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setSafety(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {safety === 'report'
                ? 'Report and block this person?'
                : safety === 'block'
                  ? 'Block this person?'
                  : 'End this introduction?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {safety === 'report'
                ? 'Your report includes the latest 20 messages and the details below. Staff can review it. The conversation ends and you won’t match with this person again.'
                : safety === 'block'
                  ? 'The conversation ends and neither of you can match with the other again.'
                  : 'Both people will be released. You can look for another introduction afterwards.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {safety === 'report' && (
            <>
              <label className="form-field">
                Reason
                <NativeSelect
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                >
                  {[
                    'harassment',
                    'sexual_content',
                    'underage',
                    'spam',
                    'threats',
                    'other',
                  ].map((value) => (
                    <NativeSelectOption key={value} value={value}>
                      {label(value)}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </label>
              <label className="form-field" htmlFor="report-details">
                Details (optional)
                <Textarea
                  id="report-details"
                  maxLength={2000}
                  value={details}
                  onChange={(event) => setDetails(event.target.value)}
                />
              </label>
            </>
          )}
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Go back</AlertDialogCancel>
            <Button disabled={busy} onClick={confirmSafety}>
              {busy
                ? 'Saving…'
                : safety === 'report'
                  ? 'Submit report and block'
                  : safety === 'block'
                    ? 'Block person'
                    : 'Leave'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
