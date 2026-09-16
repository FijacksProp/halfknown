'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  EyeOff,
  Heart,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
  Smile,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui/input-otp';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { Progress } from '@/components/ui/progress';
import { Landing } from '@/components/halfknown/landing';
import { ChatWorkspace } from '@/components/halfknown/chat-workspace';
import {
  api,
  ApiError,
  type Account,
  type Catalog,
  type Onboarding,
  type Preferences,
  type SavedProfile,
} from '@/lib/api';
import {
  adultBirthDate,
  emptyDraft,
  emptyPreferences,
  label,
  stepValid,
  toggleChoice,
  validPreferences,
} from '@/lib/onboarding';

type Screen =
  | 'landing'
  | 'loading'
  | 'onboarding'
  | 'signin'
  | 'verify'
  | 'ready'
  | 'preferences';
const languages = {
  en: 'English',
  fr: 'French',
  es: 'Spanish',
  pt: 'Portuguese',
  de: 'German',
  ar: 'Arabic',
  hi: 'Hindi',
  ja: 'Japanese',
  zh: 'Chinese',
  yo: 'Yoruba',
  ig: 'Igbo',
  ha: 'Hausa',
};

export default function Home() {
  const [screen, setScreen] = useState<Screen>('landing');
  const [sessionReady, setSessionReady] = useState(false);
  const [step, setStep] = useState(1);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [draft, setDraft] = useState<Onboarding>(emptyDraft);
  const [account, setAccount] = useState<Account | null>(null);
  const [saved, setSaved] = useState<SavedProfile | null>(null);
  const [preferences, setPreferences] = useState<Preferences>(emptyPreferences);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [returning, setReturning] = useState(false);
  const [resendAt, setResendAt] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const working = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    let active = true;
    async function boot() {
      try {
        const [options, identity, me] = await Promise.all([
          api.catalog(),
          api.preview(),
          api.me().catch((reason: unknown) => {
            if (reason instanceof ApiError && reason.status === 403)
              return null;
            throw reason;
          }),
        ]);
        const profile = me?.onboarding_complete ? await api.profile() : null;
        if (!active) return;
        setCatalog(options);
        setDraft((current) => ({
          ...current,
          avatar_id: identity.avatar_id,
          policy_version: options.policy_version,
        }));
        setAccount(me);
        setSaved(profile);
        setEmail(me?.email ?? '');
        setSessionReady(true);
        setScreen(profile ? 'ready' : me ? 'onboarding' : 'landing');
      } catch (reason) {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : 'Could not load your account.',
          );
      }
    }
    void boot();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    heading.current?.focus();
  }, [screen, step]);
  useEffect(() => {
    const update = () =>
      setSecondsLeft(Math.max(0, Math.ceil((resendAt - Date.now()) / 1000)));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [resendAt]);

  function change<K extends keyof Onboarding>(key: K, value: Onboarding[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function run(action: () => Promise<void>) {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 403) {
        setAccount(null);
        setSaved(null);
        setChallengeId('');
        setCode('');
        setScreen('signin');
        setReturning(true);
        setError(
          'Your session needs refreshing. Sign in again; your unsaved choices are still here.',
        );
      } else {
        setError(
          reason instanceof Error
            ? reason.message
            : 'Something went wrong. Please try again.',
        );
      }
    } finally {
      working.current = false;
      setBusy(false);
    }
  }

  async function persistProfile() {
    // Another tab may have completed onboarding. Do not overwrite that profile with a new draft.
    const me = await api.me();
    setAccount(me);
    if (me.onboarding_complete) {
      setSaved(await api.profile());
      setScreen('ready');
      return;
    }
    let result: SavedProfile;
    try {
      result = await api.createProfile(draft);
    } catch (reason) {
      if (!(reason instanceof ApiError) || reason.status !== 409) throw reason;
      result = await api.profile();
    }
    setSaved(result);
    setAccount({ ...me, onboarding_complete: true });
    setDraft(emptyDraft());
    setScreen('ready');
  }

  async function sendCode() {
    const result = await api.requestCode(email.trim());
    setChallengeId(result.challenge_id);
    setCode('');
    setResendAt(Date.now() + 60_000);
    setScreen('verify');
    setNotice(
      'If this address can sign in, a six-digit code is on its way. It expires after 10 minutes.',
    );
  }

  async function verify() {
    await api.verifyCode(challengeId, code);
    setCode('');
    setChallengeId('');
    // If profile recovery fails, the user can retry sign-in or reload; the OTP is already consumed.
    setScreen('signin');
    const me = await api.me();
    setAccount(me);
    setEmail(me.email);
    if (me.onboarding_complete) {
      setSaved(await api.profile());
      setDraft(emptyDraft());
      setScreen('ready');
    } else if (returning) {
      setDraft((current) => ({
        ...current,
        avatar_id: current.avatar_id || catalog!.avatars[0],
        policy_version: catalog!.policy_version,
      }));
      setStep(1);
      setScreen('onboarding');
      setNotice('You are signed in. Finish your profile to continue.');
    } else {
      // A failed save is retried without asking for the consumed code again.
      setStep(4);
      setScreen('onboarding');
      await persistProfile();
    }
  }

  async function signOut() {
    await api.logout();
    setAccount(null);
    setSaved(null);
    setEmail('');
    setCode('');
    setChallengeId('');
    setPreferences(emptyPreferences());
    setDraft({
      ...emptyDraft(),
      avatar_id: catalog!.avatars[0],
      policy_version: catalog!.policy_version,
    });
    setStep(1);
    setScreen('signin');
    setReturning(true);
    setNotice('You are signed out.');
  }

  const editingPreferences = screen === 'preferences';
  const inOnboarding = screen === 'onboarding';
  const inEmail = screen === 'signin' || (inOnboarding && step === 4);
  const canContinue =
    screen === 'verify'
      ? /^[0-9]{6}$/.test(code)
      : screen === 'signin'
        ? !!email.trim()
        : editingPreferences
          ? validPreferences(preferences)
          : stepValid(step, draft) &&
            (step !== 4 || !!account || !!email.trim());

  async function submit() {
    if (!canContinue) return;
    if (screen === 'verify') return verify();
    if (screen === 'signin') return sendCode();
    if (editingPreferences) {
      const result = await api.savePreferences(preferences);
      setSaved((current) =>
        current ? { ...current, preferences: result } : null,
      );
      setScreen('ready');
      setNotice('Matching preferences saved.');
      return;
    }
    if (step < 4) {
      setStep(step + 1);
      return;
    }
    if (account) return persistProfile();
    setReturning(false);
    await sendCode();
  }

  return (
    <main className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="topbar">
        <button
          className="brand"
          aria-label="Halfknown home"
          disabled={busy}
          onClick={() => {
            setScreen(account?.onboarding_complete ? 'ready' : 'landing');
            if (sessionReady) setError('');
          }}
        >
          <span className="brand-mark" aria-hidden="true">
            h<span>.</span>
          </span>
          <span>
            halfknown<span className="brand-dot">.</span>
          </span>
        </button>
        {screen === 'landing' && (
          <nav className="top-nav" aria-label="Main navigation">
            <a href="#how-it-works">How it works</a>
            <span className="preview-label">For adults, 18+</span>
          </nav>
        )}
        {account ? (
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => void run(signOut)}
          >
            Sign out
          </Button>
        ) : screen === 'landing' ? (
          <Button
            variant="outline"
            className="header-signin"
            disabled={!sessionReady}
            onClick={() => {
              setReturning(true);
              setScreen('signin');
              setError('');
            }}
          >
            Sign in <ArrowRight aria-hidden="true" />
          </Button>
        ) : (
          <span className="privacy-note">
            <EyeOff aria-hidden="true" /> Your identity, your choice
          </span>
        )}
      </header>
      <div id="main-content" tabIndex={-1}>
        {screen === 'landing' ? (
          <Landing
            ready={sessionReady}
            error={error}
            onBegin={() => {
              setStep(1);
              setScreen('onboarding');
              setError('');
            }}
            onSignIn={() => {
              setReturning(true);
              setScreen('signin');
              setError('');
            }}
          />
        ) : screen === 'loading' ? (
          <section className="ready-view">
            <h1 ref={heading} tabIndex={-1}>
              Opening Halfknown
            </h1>
            {error ? (
              <>
                <p role="alert">{error}</p>
                <Button onClick={() => window.location.reload()}>
                  Try again
                </Button>
              </>
            ) : (
              <output>Checking your session…</output>
            )}
          </section>
        ) : screen === 'ready' && saved ? (
          <ChatWorkspace
            saved={saved}
            onPreferences={() => {
              setPreferences({
                ...saved.preferences,
                genders: [...saved.preferences.genders],
              });
              setScreen('preferences');
              setNotice('');
            }}
          />
        ) : (
          <section className="onboarding-layout">
            <aside className="story-panel">
              <span className="eyebrow">
                <Heart aria-hidden="true" /> A little introduction
              </span>
              <h1>
                Come as you are.
                <br />
                <em>Keep a little mystery.</em>
              </h1>
              <p className="story-lead">
                No perfect photos. No clever bio required. Just a few things
                that make you, you.
              </p>
              {inOnboarding && (
                <ol className="setup-steps" aria-label="Profile setup progress">
                  {[
                    'Your intention',
                    'Your boundaries',
                    'Your personality',
                    'Your private sign-in',
                  ].map((name, index) => (
                    <li
                      key={name}
                      aria-current={step === index + 1 ? 'step' : undefined}
                      data-complete={step > index + 1}
                    >
                      <span>
                        {step > index + 1 ? (
                          <Check aria-hidden="true" />
                        ) : (
                          `0${index + 1}`
                        )}
                      </span>
                      <div>
                        {name}
                        <small>
                          {step > index + 1
                            ? 'Done. Very you.'
                            : step === index + 1
                              ? 'You are here'
                              : 'Coming up'}
                        </small>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
              <div className="safety-callout">
                <ShieldCheck aria-hidden="true" />
                <span>
                  <strong>Your identity stays yours.</strong>Your email and
                  birth date are never shown to a match. Share personal details
                  only when you choose.
                </span>
              </div>
            </aside>
            <form
              className="onboarding-card"
              onSubmit={(event) => {
                event.preventDefault();
                void run(submit);
              }}
              aria-busy={busy}
            >
              {inOnboarding && (
                <>
                  <div className="card-topline">
                    <span>Step {step} of 4</span>
                    <span>{Math.round(((step - 1) / 4) * 100)}% of setup</span>
                  </div>
                  <Progress
                    value={((step - 1) / 4) * 100}
                    className="onboarding-progress"
                  />
                </>
              )}
              <fieldset disabled={busy} className="step-content">
                {inOnboarding && step === 1 && (
                  <>
                    <StepHeading title="What brings you here?" ref={heading}>
                      Choose one or more. There is room for different kinds of
                      connection.
                    </StepHeading>
                    <ChoiceChips
                      variant="intentions"
                      values={catalog!.intentions}
                      selected={draft.intentions}
                      onChange={(value) =>
                        change(
                          'intentions',
                          toggleChoice(draft.intentions, value),
                        )
                      }
                    />
                    {!account && (
                      <Button
                        type="button"
                        variant="ghost"
                        className="secondary-action"
                        onClick={() => {
                          setReturning(true);
                          setScreen('signin');
                          setError('');
                        }}
                      >
                        Already joined? Sign in
                      </Button>
                    )}
                  </>
                )}
                {inOnboarding && step === 2 && (
                  <>
                    <StepHeading
                      title="Your boundaries come first"
                      ref={heading}
                    >
                      Your birth date stays private. Halfknown is for adults
                      aged 18 and over.
                    </StepHeading>
                    <label className="form-field" htmlFor="birth-date">
                      Date of birth
                      <Input
                        id="birth-date"
                        type="date"
                        value={draft.birth_date}
                        required
                        onChange={(event) =>
                          change('birth_date', event.target.value)
                        }
                        aria-describedby="birthday-note"
                      />
                    </label>
                    <p id="birthday-note" className="field-note">
                      {draft.birth_date && !adultBirthDate(draft.birth_date)
                        ? 'Enter a valid birth date. You must be at least 18.'
                        : 'Enter this carefully; changing a saved birth date requires support.'}
                    </p>
                    <label className="form-field">
                      Your gender
                      <NativeSelect
                        value={draft.gender}
                        required
                        onChange={(event) =>
                          change('gender', event.target.value)
                        }
                      >
                        <NativeSelectOption value="">
                          Choose an option
                        </NativeSelectOption>
                        {catalog!.genders.map((value) => (
                          <NativeSelectOption value={value} key={value}>
                            {label(value)}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                    </label>
                    <PreferenceFields
                      values={draft.preferences}
                      genders={catalog!.genders}
                      onChange={(value) => change('preferences', value)}
                    />
                  </>
                )}
                {inOnboarding && step === 3 && (
                  <>
                    <StepHeading title="A little more you" ref={heading}>
                      Pick 3–5 interests. These give a new conversation
                      somewhere to start.
                    </StepHeading>
                    <ChoiceChips
                      values={catalog!.interests}
                      selected={draft.interests}
                      onChange={(value) =>
                        change(
                          'interests',
                          toggleChoice(draft.interests, value, 5),
                        )
                      }
                    />
                    <output className="selection-count">
                      {draft.interests.length} of 5 selected
                    </output>
                    <label className="form-field">
                      Chat language
                      <NativeSelect
                        value={draft.languages[0]}
                        onChange={(event) =>
                          change('languages', [event.target.value])
                        }
                      >
                        {Object.entries(languages).map(([value, name]) => (
                          <NativeSelectOption value={value} key={value}>
                            {name}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                    </label>
                    <label className="form-field">
                      Conversation style
                      <NativeSelect
                        value={draft.conversation_style}
                        onChange={(event) =>
                          change('conversation_style', event.target.value)
                        }
                      >
                        {catalog!.styles.map((value) => (
                          <NativeSelectOption value={value} key={value}>
                            {label(value)}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                    </label>
                    <div className="avatar-preview">
                      <Smile aria-hidden="true" />
                      <span>{label(draft.avatar_id)} identity</span>
                      <Button
                        type="button"
                        variant="ghost"
                        aria-label="Shuffle avatar"
                        onClick={() =>
                          change(
                            'avatar_id',
                            catalog!.avatars[
                              (catalog!.avatars.indexOf(draft.avatar_id) + 1) %
                                catalog!.avatars.length
                            ],
                          )
                        }
                      >
                        <RefreshCw aria-hidden="true" />
                      </Button>
                    </div>
                    <p className="field-note">
                      Your anonymous alias will be assigned when your profile is
                      saved.
                    </p>
                  </>
                )}
                {inEmail && (
                  <>
                    <StepHeading
                      title={
                        screen === 'signin'
                          ? 'Good to have you here'
                          : account
                            ? 'Save your anonymous profile'
                            : 'One last private step'
                      }
                      ref={heading}
                    >
                      {account
                        ? `Signed in as ${account.email}.`
                        : 'We will send a six-digit sign-in code. No password, and your email is never shown to matches.'}
                    </StepHeading>
                    {!account && (
                      <label className="form-field" htmlFor="email-address">
                        Email address
                        <Input
                          id="email-address"
                          type="email"
                          autoComplete="email"
                          required
                          maxLength={254}
                          placeholder="you@example.com"
                          value={email}
                          onChange={(event) => setEmail(event.target.value)}
                        />
                      </label>
                    )}
                    {inOnboarding && (
                      <>
                        <details className="policy-details">
                          <summary>Privacy and community guidelines</summary>
                          <p>
                            We use your email for sign-in. Saving a profile
                            stores your birth date privately, plus your chosen
                            interests and matching preferences. Sign out on
                            shared devices. Unsaved choices are lost on refresh.
                          </p>
                          <p>
                            Adults only. Do not impersonate others, harass,
                            threaten, scam, or submit explicit content. Messages
                            are stored on our servers, not end-to-end encrypted.
                            Reporting shares the latest 20 messages with staff.
                          </p>
                          {catalog?.policies?.terms && (
                            <p>
                              <a
                                href={catalog.policies.terms}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Terms of service
                              </a>
                              {' · '}
                              <a
                                href={catalog.policies.privacy}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Privacy policy
                              </a>
                              {' · '}
                              <a
                                href={catalog.policies.guidelines}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Community guidelines
                              </a>
                            </p>
                          )}
                        </details>
                        <label className="consent-row" htmlFor="accept-terms">
                          <Checkbox
                            id="accept-terms"
                            checked={draft.accepted_terms}
                            onCheckedChange={(value) =>
                              change('accepted_terms', value === true)
                            }
                          />
                          <span>
                            {catalog?.policies?.terms
                              ? 'I agree to the Terms of Service and acknowledge the Privacy Policy linked above.'
                              : 'I understand the data practices described above.'}
                          </span>
                        </label>
                        <label
                          className="consent-row"
                          htmlFor="accept-guidelines"
                        >
                          <Checkbox
                            id="accept-guidelines"
                            checked={draft.accepted_guidelines}
                            onCheckedChange={(value) =>
                              change('accepted_guidelines', value === true)
                            }
                          />
                          <span>
                            I agree to the adult-only community guidelines
                            above.
                          </span>
                        </label>
                      </>
                    )}
                  </>
                )}
                {screen === 'verify' && (
                  <>
                    <StepHeading title="Check your inbox" ref={heading}>
                      Enter the six-digit code for {email}. Keep this page open
                      while you check.
                    </StepHeading>
                    <label className="form-field" htmlFor="email-code">
                      Sign-in code
                    </label>
                    <InputOTP
                      id="email-code"
                      maxLength={6}
                      pattern="^[0-9]*$"
                      autoComplete="one-time-code"
                      inputMode="numeric"
                      value={code}
                      onChange={setCode}
                    >
                      <InputOTPGroup>
                        {[0, 1, 2, 3, 4, 5].map((index) => (
                          <InputOTPSlot
                            index={index}
                            key={index}
                            className="otp-slot"
                          />
                        ))}
                      </InputOTPGroup>
                    </InputOTP>
                    <Button
                      type="button"
                      className="secondary-action"
                      variant="ghost"
                      disabled={secondsLeft > 0}
                      onClick={() => void run(sendCode)}
                    >
                      {secondsLeft > 0
                        ? `Resend in ${secondsLeft}s`
                        : 'Resend code'}
                    </Button>
                    <p className="field-note">
                      Check your spam folder too. Never share your sign-in code
                      with anyone.
                    </p>
                  </>
                )}
                {editingPreferences && (
                  <>
                    <StepHeading
                      title="Who would you like to meet?"
                      ref={heading}
                    >
                      Compatibility works both ways. Gender preferences are
                      free.
                    </StepHeading>
                    <PreferenceFields
                      values={preferences}
                      genders={catalog!.genders}
                      onChange={setPreferences}
                    />
                  </>
                )}
              </fieldset>
              {error && (
                <p role="alert" className="form-error">
                  {error}
                </p>
              )}
              {notice && <output className="form-notice">{notice}</output>}
              <div className="card-actions">
                <Button
                  type="button"
                  variant="ghost"
                  className="back-button"
                  disabled={busy || (inOnboarding && step === 1)}
                  onClick={() => {
                    setError('');
                    setNotice('');
                    if (editingPreferences) setScreen('ready');
                    else if (screen === 'verify') {
                      setCode('');
                      setChallengeId('');
                      setScreen(returning ? 'signin' : 'onboarding');
                    } else if (screen === 'signin') {
                      setScreen('onboarding');
                      setStep(1);
                    } else setStep(step - 1);
                  }}
                >
                  <ArrowLeft aria-hidden="true" />{' '}
                  {editingPreferences ? 'Cancel' : 'Back'}
                </Button>
                <Button
                  type="submit"
                  className="continue-button"
                  disabled={busy || !canContinue}
                >
                  {busy
                    ? 'Please wait…'
                    : screen === 'verify'
                      ? 'Verify code'
                      : editingPreferences
                        ? 'Save preferences'
                        : inEmail
                          ? account
                            ? 'Save profile'
                            : 'Send code'
                          : 'Continue'}
                  <ArrowRight aria-hidden="true" />
                </Button>
              </div>
            </form>
          </section>
        )}
      </div>
      <footer className="site-footer">
        <span className="footer-wordmark">halfknown.</span>
        <span>A little unknown. A lot to discover.</span>
        <small>18+ · Your boundaries come first</small>
      </footer>
    </main>
  );
}

function StepHeading({
  title,
  children,
  ref,
}: {
  title: string;
  children: React.ReactNode;
  ref: React.Ref<HTMLHeadingElement>;
}) {
  return (
    <div className="step-heading">
      <h2 ref={ref} tabIndex={-1}>
        {title}
      </h2>
      <p>{children}</p>
    </div>
  );
}

function ChoiceChips({
  values,
  selected,
  onChange,
  variant = 'chips',
}: {
  values: string[];
  selected: string[];
  onChange: (value: string) => void;
  variant?: 'chips' | 'intentions';
}) {
  return (
    <div
      className={variant === 'intentions' ? 'intention-grid' : 'interest-grid'}
    >
      {values.map((value) => (
        <label
          className={`interest-chip ${selected.includes(value) ? 'is-selected' : ''}`}
          key={value}
        >
          <Checkbox
            checked={selected.includes(value)}
            onCheckedChange={() => onChange(value)}
          />
          {variant === 'intentions' ? (
            <span className="intention-copy">
              <span className="intention-symbol" aria-hidden="true">
                {value === 'dating' ? (
                  <Heart />
                ) : value === 'flirting' ? (
                  <Smile />
                ) : value === 'friendship' ? (
                  <MessageCircle />
                ) : (
                  <EyeOff />
                )}
              </span>
              <strong>{label(value)}</strong>
              <small>
                {
                  (
                    {
                      dating: 'Let’s see where this goes.',
                      flirting: 'A spark. No pressure.',
                      friendship: 'Find your kind of person.',
                      conversation: 'A good place to say hello.',
                    } as Record<string, string>
                  )[value]
                }
              </small>
            </span>
          ) : (
            label(value)
          )}
        </label>
      ))}
    </div>
  );
}

function PreferenceFields({
  values,
  genders,
  onChange,
}: {
  values: Preferences;
  genders: string[];
  onChange: (value: Preferences) => void;
}) {
  return (
    <div className="preference-fields">
      <fieldset>
        <legend>Genders you are open to in Compatible Match</legend>
        <ChoiceChips
          values={genders}
          selected={values.genders}
          onChange={(value) =>
            onChange({
              ...values,
              genders: toggleChoice(values.genders, value),
            })
          }
        />
      </fieldset>
      <div className="age-range">
        <label className="form-field" htmlFor="min-age">
          Minimum age
          <Input
            id="min-age"
            type="number"
            min={18}
            max={120}
            required
            value={Number.isNaN(values.min_age) ? '' : values.min_age}
            onChange={(event) =>
              onChange({ ...values, min_age: event.target.valueAsNumber })
            }
          />
        </label>
        <label className="form-field" htmlFor="max-age">
          Maximum age
          <Input
            id="max-age"
            type="number"
            min={values.min_age || 18}
            max={120}
            required
            value={Number.isNaN(values.max_age) ? '' : values.max_age}
            onChange={(event) =>
              onChange({ ...values, max_age: event.target.valueAsNumber })
            }
          />
        </label>
      </div>
      <label className="consent-row" htmlFor="open-chat-opt-in">
        <Checkbox
          id="open-chat-opt-in"
          checked={values.open_chat_opt_in}
          onCheckedChange={(value) =>
            onChange({ ...values, open_chat_opt_in: value === true })
          }
        />
        <span>Also let me use Open Chat with any gender.</span>
      </label>
      <p className="field-note">
        Open Chat ignores gender preferences only when both people opt in. Age,
        language, shared intentions, and blocks still apply. You can turn this
        off anytime.
      </p>
    </div>
  );
}
