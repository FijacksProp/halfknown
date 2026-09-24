'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dice5,
  Flag,
  Heart,
  Send,
  SkipForward,
  UserRoundX,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  api,
  type Chat,
  type ChatMessage,
  type MatchState,
  type SavedProfile,
  type SocialConnection,
} from '@/lib/api';
import { Avatar } from './avatar';

export function ChatWorkspace({ saved }: { saved: SavedProfile }) {
  const [state, setState] = useState<MatchState>({ state: 'idle' });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [connected, setConnected] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);
  const [connection, setConnection] = useState<SocialConnection | null>(null);
  const [dialog, setDialog] = useState<'leave' | 'block' | 'report' | null>(
    null,
  );
  const [reason, setReason] = useState('harassment');
  const [details, setDetails] = useState('');
  const currentChat = useRef<Chat | null>(null);
  const cursor = useRef(0);
  const mounted = useRef(false);
  const working = useRef(false);
  const refreshing = useRef(false);
  const revision = useRef(0);
  const pending = useRef<{ id: string; body: string; chat: string } | null>(
    null,
  );
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTyping = useRef(0);
  const scrollArea = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    if (!mounted.current || working.current || refreshing.current) return;
    refreshing.current = true;
    const epoch = revision.current;
    try {
      const next = await api.heartbeat();
      if (!mounted.current || epoch !== revision.current) return;
      if ('id' in next) {
        if (currentChat.current?.id !== next.id) {
          cursor.current = 0;
          setMessages([]);
          setDraft('');
          pending.current = null;
          setConnection(null);
          setNotice('You’re connected.');
        }
        currentChat.current = next;
        let more = true;
        while (more) {
          const page = await api.messages(next.id, cursor.current);
          if (!mounted.current || epoch !== revision.current) return;
          setMessages((previous) => {
            const unique = new Map(
              previous.map((message) => [message.id, message]),
            );
            page.messages.forEach((message) => unique.set(message.id, message));
            return [...unique.values()].sort((a, b) => a.id - b.id).slice(-500);
          });
          cursor.current = page.messages.at(-1)?.id ?? cursor.current;
          more = page.has_more;
          currentChat.current = page.conversation;
          setState(page.conversation);
        }
        if (next.state === 'active') {
          const result = await api.quickConnectionState(next.id);
          if (!mounted.current || epoch !== revision.current) return;
          setConnection(result.connection);
        }
      } else {
        if (currentChat.current && next.state === 'waiting') {
          setNotice('Chat ended. Finding someone new…');
        }
        currentChat.current = null;
        cursor.current = 0;
        setMessages([]);
        setConnection(null);
        setState(next);
      }
      setLoaded(true);
      setError('');
    } catch (reason) {
      if (mounted.current && epoch === revision.current)
        setError(
          reason instanceof Error
            ? reason.message
            : 'Could not update the chat.',
        );
    } finally {
      refreshing.current = false;
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
        setConnected(true);
        void refresh();
      };
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (
            data.type === 'chat.typing' &&
            data.conversation_id === currentChat.current?.id
          ) {
            setPeerTyping(true);
            if (typingTimer.current) clearTimeout(typingTimer.current);
            typingTimer.current = setTimeout(() => setPeerTyping(false), 3500);
          } else if (
            data.type === 'chat.changed' ||
            data.type === 'match.changed' ||
            data.type === 'connection.changed' ||
            data.type === 'social.connection.changed'
          )
            void refresh();
        } catch {
          /* REST sync remains authoritative. */
        }
      };
      socket.onclose = (event) => {
        setConnected(false);
        if (!stopped && event.code !== 4401)
          reconnect = setTimeout(connect, 3000);
      };
      socket.onerror = () => socket?.close();
    };
    connect();
    const initial = setTimeout(() => void refresh(), 0);
    const poll = setInterval(() => void refresh(), 8000);
    const ping = setInterval(() => {
      if (socket?.readyState === WebSocket.OPEN)
        socket.send(JSON.stringify({ type: 'ping' }));
    }, 20000);
    return () => {
      stopped = true;
      mounted.current = false;
      revision.current += 1;
      socket?.close();
      if (reconnect) clearTimeout(reconnect);
      if (typingTimer.current) clearTimeout(typingTimer.current);
      clearTimeout(initial);
      clearInterval(poll);
      clearInterval(ping);
    };
  }, [refresh]);

  useEffect(() => {
    const area = scrollArea.current;
    if (area && area.scrollHeight - area.scrollTop - area.clientHeight < 220)
      area.scrollTop = area.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(''), 4500);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  async function action(work: () => Promise<void>) {
    if (working.current) return;
    working.current = true;
    revision.current += 1;
    setBusy(true);
    setError('');
    try {
      await work();
    } catch (reason) {
      if (mounted.current)
        setError(
          reason instanceof Error ? reason.message : 'Please try again.',
        );
    } finally {
      working.current = false;
      if (mounted.current) {
        setBusy(false);
        void refresh();
      }
    }
  }

  function resetConversation(result: MatchState) {
    currentChat.current = 'id' in result ? result : null;
    cursor.current = 0;
    pending.current = null;
    setMessages([]);
    setDraft('');
    setPeerTyping(false);
    setConnection(null);
    setState(result);
  }

  function start() {
    void action(async () => {
      resetConversation(await api.joinQueue());
      setNotice('');
    });
  }

  function next() {
    if (!('id' in state)) return;
    const chatId = state.id;
    void action(async () => {
      resetConversation(await api.nextPerson(chatId));
      setNotice('');
    });
  }

  function keepInTouch() {
    if (state.state !== 'active') return;
    void action(async () => {
      const result = await api.quickConnect(state.id);
      setConnection(result);
      setNotice('');
    });
  }

  function declineKeepInTouch() {
    if (state.state !== 'active' || connection?.direction !== 'incoming')
      return;
    const chatId = state.id;
    void action(async () => {
      await api.declineQuickConnection(chatId);
      setConnection(null);
      setNotice('Request declined.');
    });
  }

  function send() {
    if (state.state !== 'active' || !draft.trim() || busy) return;
    const body = draft.trim();
    const chatId = state.id;
    if (
      !pending.current ||
      pending.current.body !== body ||
      pending.current.chat !== chatId
    )
      pending.current = { id: crypto.randomUUID(), body, chat: chatId };
    const attempt = pending.current;
    void action(async () => {
      const message = await api.sendMessage(chatId, attempt.id, body);
      setMessages((previous) =>
        [...previous.filter((item) => item.id !== message.id), message].sort(
          (a, b) => a.id - b.id,
        ),
      );
      setDraft('');
      pending.current = null;
    });
  }

  function confirmDialog() {
    const selected = dialog;
    const chat = 'id' in state ? state : null;
    void action(async () => {
      if (selected === 'report' && chat) {
        await api.reportChat(chat.id, reason, details);
        setNotice(
          'Report received. You will not be matched with this person again.',
        );
      } else if (selected === 'block' && chat) {
        await api.blockChat(chat.id);
        setNotice('Blocked. You will not be matched with this person again.');
      } else {
        await api.leaveChat();
        setNotice('You left the queue.');
      }
      setDialog(null);
      setDetails('');
      resetConversation({ state: 'idle' });
    });
  }

  const chat = 'id' in state ? state : null;

  return (
    <section className="chat-workspace" aria-label="Random chat">
      {!connected && loaded && (
        <output className="quick-reconnect">Reconnecting to chat…</output>
      )}

      {error && (
        <div className="form-error" role="alert">
          {error} <button onClick={() => void refresh()}>Try again</button>
        </div>
      )}
      {notice && <output className="chat-notice">{notice}</output>}
      {!loaded && (
        <output className="loading-line">Checking your session…</output>
      )}

      {(state.state === 'idle' || state.state === 'ended') && loaded && (
        <div className="start-panel">
          <div className="quick-intro-copy">
            <h2>Quick meet</h2>
            <p>Chat with someone online. Skip anytime.</p>
            <Button className="round-action" disabled={busy} onClick={start}>
              Find someone <Dice5 aria-hidden="true" />
            </Button>
            <p className="chat-privacy">
              Chats are saved and aren’t end-to-end encrypted. Block or report
              anytime.
            </p>
          </div>
          <div className="quick-intro-art" aria-hidden="true">
            <Avatar
              id="alien-female"
              className="quick-intro-avatar quick-intro-avatar--first"
            />
            <Avatar
              id="human-male"
              className="quick-intro-avatar quick-intro-avatar--second"
            />
          </div>
        </div>
      )}

      {state.state === 'waiting' && (
        <div className="waiting-panel">
          <div className="quick-waiting-avatars" aria-hidden="true">
            <Avatar id={saved.profile.avatar_id} />
            <span className="quick-waiting-line" />
            <Avatar id="goblin-female" />
          </div>
          <h2>Finding someone…</h2>
          <Button
            className="outline-action"
            disabled={busy}
            onClick={() => setDialog('leave')}
          >
            Stop searching
          </Button>
        </div>
      )}

      {chat && state.state === 'active' && (
        <div className="conversation-panel">
          <header className="conversation-header">
            <div className="quick-peer">
              <Avatar id={chat.peer.avatar_id} size="small" />
              <div>
                <span>QUICK MEET</span>
                <h2>{chat.peer.alias}</h2>
              </div>
            </div>
            <div className="quick-chat-actions">
              {connection?.direction !== 'incoming' && (
                <Button
                  className="keep-button"
                  disabled={busy || connection !== null}
                  onClick={keepInTouch}
                >
                  <Heart aria-hidden="true" />{' '}
                  {connection?.status === 'accepted'
                    ? 'In your connections'
                    : connection?.status === 'declined'
                      ? 'Not this time'
                      : connection?.status === 'pending'
                        ? 'Request sent'
                        : 'Keep in touch'}
                </Button>
              )}
              <Button className="next-button" disabled={busy} onClick={next}>
                Next <SkipForward aria-hidden="true" />
              </Button>
            </div>
          </header>
          {connection?.status === 'pending' &&
            connection.direction === 'incoming' && (
              <div className="quick-connection-request" role="status">
                <div>
                  <strong>{chat.peer.alias} wants to keep in touch.</strong>
                  <p>Accept to add them to Connections.</p>
                </div>
                <div className="quick-request-actions">
                  <Button disabled={busy} onClick={keepInTouch}>
                    Keep in touch
                  </Button>
                  <Button disabled={busy} onClick={declineKeepInTouch}>
                    Not now
                  </Button>
                </div>
              </div>
            )}
          {connection?.status === 'pending' &&
            connection.direction === 'outgoing' && (
              <div className="quick-connection-note" role="status">
                Request sent to {chat.peer.alias}.
              </div>
          )}
          {connection?.status === 'accepted' && (
            <div className="quick-connection-note" role="status">
              Connected. Find this chat in Connections.
            </div>
          )}
          {connection?.status === 'declined' && (
            <div className="quick-connection-note" role="status">
              Request declined. You can keep chatting or skip.
            </div>
          )}
          <div className="message-list" ref={scrollArea} aria-live="polite">
            {messages.length === 0 && (
              <div className="message-empty">
                <strong>Say hello.</strong>
              </div>
            )}
            {messages.map((message) => (
              <article
                className={`chat-message ${message.mine ? 'is-mine' : ''}`}
                key={message.id}
              >
                <span>{message.mine ? 'YOU' : chat.peer.alias}</span>
                <p>{message.body}</p>
                <time>
                  {new Date(message.created_at).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </time>
              </article>
            ))}
          </div>
          <div className="message-composer">
            <div className="typing-status">
              {peerTyping ? 'Stranger is typing…' : ' '}
            </div>
            <Textarea
              value={draft}
              maxLength={2000}
              rows={2}
              placeholder="Write a message…"
              onChange={(event) => {
                setDraft(event.target.value);
                if (Date.now() - lastTyping.current > 2500) {
                  lastTyping.current = Date.now();
                  void api.typing(chat.id).catch(() => undefined);
                }
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  send();
                }
              }}
            />
            <div className="composer-bottom">
              <div className="safety-actions">
                <button onClick={() => setDialog('report')}>
                  <Flag aria-hidden="true" /> Report
                </button>
                <button onClick={() => setDialog('block')}>
                  <UserRoundX aria-hidden="true" /> Block
                </button>
                <button onClick={() => setDialog('leave')}>Leave</button>
              </div>
              <Button
                aria-label="Send message"
                disabled={busy || !draft.trim()}
                onClick={send}
              >
                <Send aria-hidden="true" />
              </Button>
            </div>
          </div>
        </div>
      )}

      <AlertDialog
        open={dialog !== null}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {dialog === 'report'
                ? 'Report this conversation?'
                : dialog === 'block'
                  ? 'Block this stranger?'
                  : 'Stop chatting?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {dialog === 'report'
                ? 'A moderator can review the latest 20 messages. The stranger will also be blocked.'
                : dialog === 'block'
                  ? 'You will not be paired with this identity again.'
                  : 'You will leave the conversation and the random queue.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {dialog === 'report' && (
            <div className="report-fields">
              <label htmlFor="quick-report-reason">
                Reason
                <NativeSelect
                  id="quick-report-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                >
                  <NativeSelectOption value="harassment">
                    Harassment
                  </NativeSelectOption>
                  <NativeSelectOption value="sexual_content">
                    Sexual content
                  </NativeSelectOption>
                  <NativeSelectOption value="underage">
                    Possible underage user
                  </NativeSelectOption>
                  <NativeSelectOption value="spam">
                    Spam or scam
                  </NativeSelectOption>
                  <NativeSelectOption value="threats">
                    Threats
                  </NativeSelectOption>
                  <NativeSelectOption value="other">Other</NativeSelectOption>
                </NativeSelect>
              </label>
              <label htmlFor="quick-report-details">
                Optional details
                <Textarea
                  id="quick-report-details"
                  maxLength={2000}
                  value={details}
                  onChange={(event) => setDetails(event.target.value)}
                />
              </label>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={confirmDialog}
            >
              {dialog === 'report'
                ? 'Send report'
                : dialog === 'block'
                  ? 'Block'
                  : 'Leave'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
