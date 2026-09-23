'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, LockKeyhole } from 'lucide-react';
import Image from 'next/image';
import { Landing } from '@/components/halfknown/landing';
import { SocialWorkspace } from '@/components/halfknown/social-workspace';
import { Avatar, avatarOptions } from '@/components/halfknown/avatar';
import {
  api,
  ApiError,
  type Account,
  type Catalog,
  type SavedProfile,
} from '@/lib/api';

type Screen = 'landing' | 'setup' | 'signin' | 'verify' | 'app';

export default function Home() {
  const [screen, setScreen] = useState<Screen>('landing');
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [saved, setSaved] = useState<SavedProfile | null>(null);
  const [avatar, setAvatar] = useState('human-01');
  const [gender, setGender] = useState('undisclosed');
  const [interests, setInterests] = useState<string[]>([]);
  const [adult, setAdult] = useState(false);
  const [terms, setTerms] = useState(false);
  const [guidelines, setGuidelines] = useState(false);
  const [discoverable, setDiscoverable] = useState(false);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [challenge, setChallenge] = useState('');
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function reloadAccount() {
    const current = await api.me();
    setAccount(current);
    if (current.onboarding_complete) {
      setSaved(await api.profile());
      setScreen('app');
    } else setScreen('setup');
  }

  useEffect(() => {
    let alive = true;
    void Promise.all([
      api.catalog(),
      api.me().catch((reason) => {
        if (reason instanceof ApiError && reason.status === 403) return null;
        throw reason;
      }),
    ])
      .then(async ([options, current]) => {
        if (!alive) return;
        setCatalog(options);
        setReady(true);
        setAccount(current);
        if (current?.onboarding_complete) {
          const profile = await api.profile();
          if (alive) {
            setSaved(profile);
            setScreen('app');
          }
        } else if (current) setScreen('setup');
      })
      .catch((reason) => {
        if (alive)
          setError(
            reason instanceof Error
              ? reason.message
              : 'Halfknown could not open.',
          );
      });
    return () => {
      alive = false;
    };
  }, []);

  async function perform(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  }
  function toggleInterest(value: string) {
    setInterests((previous) =>
      previous.includes(value)
        ? previous.filter((item) => item !== value)
        : previous.length < 5
          ? [...previous, value]
          : previous,
    );
  }
  async function begin(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!catalog) return;
    await perform(async () => {
      const result = await api.randomAccess({
        gender,
        avatar_id: avatar,
        interests,
        discoverable,
        adult_confirmed: adult,
        accepted_terms: terms,
        accepted_guidelines: guidelines,
        policy_version: catalog.policy_version,
      });
      setAccount(result.account);
      setSaved({ profile: result.profile, preferences: result.preferences });
      setScreen('app');
    });
  }
  async function requestCode(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    await perform(async () => {
      const result = await api.requestCode(email);
      setChallenge(result.challenge_id);
      setScreen('verify');
    });
  }
  async function verifyCode(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    await perform(async () => {
      await api.verifyCode(challenge, code);
      await reloadAccount();
    });
  }
  async function signOut() {
    await api.logout();
    setAccount(null);
    setSaved(null);
    setScreen('landing');
  }

  if (screen === 'app' && account && saved && catalog)
    return (
      <SocialWorkspace
        account={account}
        saved={saved}
        catalog={catalog}
        onSignOut={signOut}
        onAccountChange={reloadAccount}
      />
    );
  if (screen === 'landing')
    return (
      <Landing
        ready={ready}
        error={error}
        onBegin={() => {
          setError('');
          setScreen('setup');
        }}
        onSignIn={() => {
          setError('');
          setScreen('signin');
        }}
      />
    );
  return (
    <div className="entry-page">
      <div className="entry-art">
        <button className="wordmark" onClick={() => setScreen('landing')}>
          halfknown<span>.</span>
        </button>
        <div>
          <span className="section-kicker">MAKE YOUR FIRST HELLO</span>
          <h1>
            Everyone arrives
            <br />
            <em>as someone new.</em>
          </h1>
          <p>
            Your character is just the beginning. The people you meet make the
            rest of the story.
          </p>
        </div>
        <Image
          src="/images/halfknown-characters.png"
          alt="Illustrated Halfknown characters"
          width={1536}
          height={1024}
        />
      </div>
      <main className="entry-main">
        <button
          className="back-link"
          onClick={() => {
            setError('');
            setScreen('landing');
          }}
        >
          <ArrowLeft size={18} /> Back to home
        </button>
        {screen === 'setup' && (
          <form className="entry-form" onSubmit={begin}>
            <span className="section-kicker">STEP ONE OF ONE</span>
            <h2>Come as you are.</h2>
            <p>
              Pick a character and a few things you’re into. You can add more to
              your profile later.
            </p>
            <h3>Choose a character</h3>
            <div className="entry-avatar-grid">
              {avatarOptions.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={avatar === item.id ? 'selected' : ''}
                  onClick={() => setAvatar(item.id)}
                  aria-pressed={avatar === item.id}
                >
                  <Avatar id={item.id} size="medium" />
                  <span>{item.group}</span>
                </button>
              ))}
            </div>
            <label className="form-label">
              Your gender <span>(only shared if you choose to)</span>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
              >
                {catalog?.genders.map((item) => (
                  <option key={item} value={item}>
                    {item === 'undisclosed'
                      ? 'Prefer not to say'
                      : item.replaceAll('_', ' ')}
                  </option>
                ))}
              </select>
            </label>
            <h3>
              Pick a few interests <span>(optional)</span>
            </h3>
            <div className="choice-pills">
              {catalog?.interests.map((item) => (
                <button
                  type="button"
                  key={item}
                  className={interests.includes(item) ? 'on' : ''}
                  onClick={() => toggleInterest(item)}
                >
                  {item.replaceAll('-', ' ')}
                </button>
              ))}
            </div>
            <div className="entry-checks">
              <label>
                <input
                  type="checkbox"
                  checked={discoverable}
                  onChange={(e) => setDiscoverable(e.target.checked)}
                />{' '}
                Show my character and profile in Discover. I can change this
                later.
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={adult}
                  onChange={(e) => setAdult(e.target.checked)}
                  required
                />{' '}
                I confirm I’m 18 or older.
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={terms}
                  onChange={(e) => setTerms(e.target.checked)}
                  required
                />{' '}
                I agree to the{' '}
                {catalog?.policies.terms ? (
                  <a href={catalog.policies.terms} target="_blank">
                    terms
                  </a>
                ) : (
                  'terms'
                )}{' '}
                and{' '}
                {catalog?.policies.privacy ? (
                  <a href={catalog.policies.privacy} target="_blank">
                    privacy policy
                  </a>
                ) : (
                  'privacy policy'
                )}
                .
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={guidelines}
                  onChange={(e) => setGuidelines(e.target.checked)}
                  required
                />{' '}
                I agree to the{' '}
                {catalog?.policies.guidelines ? (
                  <a href={catalog.policies.guidelines} target="_blank">
                    community guidelines
                  </a>
                ) : (
                  'community guidelines'
                )}
                .
              </label>
            </div>
            {error && (
              <p className="social-error" role="alert">
                {error}
              </p>
            )}
            <button
              className="round-action entry-submit"
              disabled={busy || !ready || !adult || !terms || !guidelines}
            >
              Enter Halfknown <ArrowRight size={18} />
            </button>
            <p className="entry-fine">
              <LockKeyhole size={15} /> No email needed to start. Add one later
              to keep your connections.
            </p>
          </form>
        )}
        {screen === 'signin' && (
          <form className="entry-form signin-form" onSubmit={requestCode}>
            <span className="section-kicker">WELCOME BACK</span>
            <h2>Your people are waiting.</h2>
            <p>
              Enter the email linked to your profile. We’ll send you a code—no
              password to remember.
            </p>
            <label className="form-label">
              Email address
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                autoComplete="email"
              />
            </label>
            {error && (
              <p className="social-error" role="alert">
                {error}
              </p>
            )}
            <button
              className="round-action entry-submit"
              disabled={busy || !email.trim()}
            >
              Send a sign-in code <ArrowRight size={18} />
            </button>
            <button
              type="button"
              className="text-action"
              onClick={() => {
                setError('');
                setScreen('setup');
              }}
            >
              New here? Join Halfknown
            </button>
          </form>
        )}
        {screen === 'verify' && (
          <form className="entry-form signin-form" onSubmit={verifyCode}>
            <span className="section-kicker">CHECK YOUR INBOX</span>
            <h2>One little code.</h2>
            <p>
              We sent a six-digit code to <strong>{email}</strong>.
            </p>
            <label className="form-label">
              Verification code
              <input
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                placeholder="000000"
                autoComplete="one-time-code"
              />
            </label>
            {error && (
              <p className="social-error" role="alert">
                {error}
              </p>
            )}
            <button
              className="round-action entry-submit"
              disabled={busy || code.length !== 6}
            >
              Continue <Check size={18} />
            </button>
            <button
              type="button"
              className="text-action"
              onClick={() => {
                setError('');
                setScreen('signin');
              }}
            >
              Use a different email
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
