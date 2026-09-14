'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, EyeOff, Flame, Heart, MessageCircle, MoonStar, RefreshCw, ShieldCheck, Sparkles, Users, Waves } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

const intentions = [
  { id: 'dating', label: 'Dating', note: 'Something with real potential', icon: Heart },
  { id: 'flirting', label: 'Flirting', note: 'Playful conversation, no pressure', icon: Flame },
  { id: 'friendship', label: 'Friendship', note: 'Meet someone on your wavelength', icon: Users },
  { id: 'conversation', label: 'Just talking', note: 'A good chat with someone new', icon: MessageCircle },
];

const interests = ['Music', 'Films', 'Gaming', 'Books', 'Travel', 'Food', 'Tech', 'Fitness', 'Art', 'Late-night talks', 'Big questions', 'Comedy'];
const avatars = [
  { name: 'QuietComet', icon: Sparkles, className: 'avatar-violet' },
  { name: 'VelvetMoon', icon: MoonStar, className: 'avatar-coral' },
  { name: 'NeonTide', icon: Waves, className: 'avatar-cyan' },
  { name: 'EmberEcho', icon: Flame, className: 'avatar-gold' },
];
const totalSteps = 4;

type OnboardingToolInput = {
  intention: string;
  age: number;
  interests: string[];
  email: string;
};

type ModelContext = {
  registerTool: (
    tool: {
      name: string;
      title: string;
      description: string;
      inputSchema: object;
      annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
      execute: (input: unknown) => unknown;
    },
    options?: { signal?: AbortSignal },
  ) => void | Promise<void>;
};

declare global {
  interface Document {
    modelContext?: ModelContext;
  }
}

export default function Home() {
  const [step, setStep] = useState(1);
  const [intention, setIntention] = useState('dating');
  const [age, setAge] = useState('');
  const [selectedInterests, setSelectedInterests] = useState<string[]>(['Music', 'Late-night talks']);
  const [avatarIndex, setAvatarIndex] = useState(0);
  const [email, setEmail] = useState('');
  const [complete, setComplete] = useState(false);

  const avatar = avatars[avatarIndex];
  const AvatarIcon = avatar.icon;
  const progress = (step / totalSteps) * 100;
  const canContinue = useMemo(() => {
    if (step === 2) return Number(age) >= 18;
    if (step === 3) return selectedInterests.length >= 3;
    if (step === 4) return /^\S+@\S+\.\S+$/.test(email);
    return true;
  }, [age, email, selectedInterests.length, step]);

  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();

    const registration = context.registerTool({
      name: 'complete_onboarding_preview',
      title: 'Complete onboarding preview',
      description: 'Configure and complete the visible anonymous-profile onboarding preview.',
      inputSchema: {
        type: 'object',
        properties: {
          intention: { type: 'string', enum: intentions.map((item) => item.id) },
          age: { type: 'integer', minimum: 18, maximum: 100 },
          interests: { type: 'array', minItems: 3, maxItems: 5, items: { type: 'string', enum: interests } },
          email: { type: 'string', format: 'email' },
        },
        required: ['intention', 'age', 'interests', 'email'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        const value = input as OnboardingToolInput;
        if (!intentions.some((item) => item.id === value.intention)) throw new Error('Choose a supported intention.');
        if (!Number.isInteger(value.age) || value.age < 18 || value.age > 100) throw new Error('Age must be between 18 and 100.');
        if (!Array.isArray(value.interests) || value.interests.length < 3 || value.interests.length > 5 || value.interests.some((item) => !interests.includes(item))) throw new Error('Choose 3 to 5 supported interests.');
        if (!/^\S+@\S+\.\S+$/.test(value.email)) throw new Error('Enter a valid email address.');

        setIntention(value.intention);
        setAge(String(value.age));
        setSelectedInterests(value.interests);
        setEmail(value.email);
        setStep(totalSteps);
        setComplete(true);
        return { status: 'complete', alias: avatars[avatarIndex].name };
      },
    }, { signal: lifecycle.signal });

    void Promise.resolve(registration).catch(() => undefined);
    return () => lifecycle.abort();
  }, [avatarIndex]);

  function toggleInterest(interest: string) {
    setSelectedInterests((current) => current.includes(interest)
      ? current.filter((item) => item !== interest)
      : current.length < 5 ? [...current, interest] : current);
  }

  function nextStep() {
    if (!canContinue) return;
    if (step === totalSteps) return setComplete(true);
    setStep((current) => current + 1);
  }

  if (complete) {
    return (
      <main className="app-shell">
        <div className="ambient ambient-one" /><div className="ambient ambient-two" />
        <header className="topbar">
          <Brand />
          <div className="profile-pill"><span className={`mini-avatar ${avatar.className}`}><AvatarIcon aria-hidden="true" /></span><span>{avatar.name}</span></div>
        </header>
        <section className="ready-view">
          <div className="ready-copy">
            <span className="eyebrow"><Check /> Your anonymous profile is ready</span>
            <h1>How do you want to meet someone?</h1>
            <p>Choose your pace. Your real identity stays private until you both decide otherwise.</p>
          </div>
          <div className="mode-grid">
            <button className="mode-card mode-card-open" type="button">
              <span className="mode-icon"><MessageCircle /></span><span className="mode-status"><i /> Usually instant</span>
              <span className="mode-title">Open Chat</span><span className="mode-description">Jump into a topic-first conversation with anyone open to meeting.</span>
              <span className="mode-link">Find someone now <ArrowRight /></span>
            </button>
            <button className="mode-card mode-card-match" type="button">
              <span className="mode-icon"><Heart /></span><span className="mode-status"><Sparkles /> More intentional</span>
              <span className="mode-title">Compatible Match</span><span className="mode-description">Meet a surprise person who fits your mutual preferences and vibe.</span>
              <span className="mode-link">Find a compatible match <ArrowRight /></span>
            </button>
          </div>
          <button className="edit-profile" type="button" onClick={() => setComplete(false)}>Edit my profile</button>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <div className="ambient ambient-one" /><div className="ambient ambient-two" />
      <header className="topbar"><Brand /><div className="privacy-note"><EyeOff /> Anonymous by default</div></header>
      <section className="onboarding-layout">
        <div className="story-panel">
          <span className="eyebrow"><Sparkles /> Conversation comes first</span>
          <h1>Meet the mind.<br /><em>Then</em> the face.</h1>
          <p className="story-lead">Start with a vibe, not a profile photo. You decide what to reveal—and only when it feels mutual.</p>
          <div className="promise-list">
            <div><ShieldCheck /><span><strong>Private by design</strong>Your identity stays yours.</span></div>
            <div><Heart /><span><strong>Mutual at every step</strong>No reveal happens alone.</span></div>
            <div><MessageCircle /><span><strong>Built for real talk</strong>Prompts help the spark along.</span></div>
          </div>
        </div>

        <div className="onboarding-card">
          <div className="card-topline"><span>Step {step} of {totalSteps}</span><span>{Math.round(progress)}% complete</span></div>
          <Progress value={progress} className="onboarding-progress" />
          <div className="step-content" key={step}>
            {step === 1 && <>
              <div className="step-heading"><span className="step-kicker">Let&apos;s start with the feeling</span><h2>What brings you here?</h2><p>You can change this whenever your mood does.</p></div>
              <RadioGroup value={intention} onValueChange={(value) => setIntention(String(value))} className="choice-grid">
                {intentions.map((item) => { const Icon = item.icon; return (
                  <label className={`choice-card ${intention === item.id ? 'is-selected' : ''}`} key={item.id}>
                    <RadioGroupItem value={item.id} className="sr-only" /><span className="choice-icon"><Icon /></span>
                    <span><strong>{item.label}</strong><small>{item.note}</small></span><span className="choice-check"><Check /></span>
                  </label>); })}
              </RadioGroup>
            </>}

            {step === 2 && <>
              <div className="step-heading"><span className="step-kicker">One important check</span><h2>How old are you?</h2><p>This space is strictly for adults. Your birthday stays private.</p></div>
              <div className="age-field"><Input type="number" min="18" max="100" inputMode="numeric" placeholder="Your age" value={age} onChange={(event) => setAge(event.target.value)} aria-label="Your age" />
                {age && Number(age) < 18 ? <small>You must be at least 18 to join.</small> : null}</div>
              <div className="safety-callout"><ShieldCheck /><span><strong>Why we ask</strong>Age boundaries are always respected in matching and cannot be bypassed.</span></div>
            </>}

            {step === 3 && <>
              <div className="step-heading"><span className="step-kicker">Build your conversation orbit</span><h2>Pick 3–5 things you&apos;re into</h2><p>We&apos;ll use these to make first conversations feel less random.</p></div>
              <div className="interest-grid">{interests.map((interest) => { const selected = selectedInterests.includes(interest); return (
                <label className={`interest-chip ${selected ? 'is-selected' : ''}`} key={interest}><Checkbox checked={selected} onCheckedChange={() => toggleInterest(interest)} className="sr-only" />{interest}{selected ? <Check /> : null}</label>); })}</div>
              <div className="selection-count">{selectedInterests.length} of 5 selected</div>
            </>}

            {step === 4 && <>
              <div className="step-heading avatar-heading"><span className="step-kicker">Your first anonymous identity</span><h2>Meet {avatar.name}</h2><p>This is how new matches will know you. Shuffle until one feels right.</p></div>
              <div className="avatar-stage"><div className={`avatar-orb ${avatar.className}`}><AvatarIcon aria-hidden="true" /></div>
                <button className="shuffle-button" type="button" onClick={() => setAvatarIndex((avatarIndex + 1) % avatars.length)}><RefreshCw /> Shuffle identity</button></div>
              <label className="email-field"><span>Where should we send your private sign-in link?</span><Input type="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} /><small>No password. Your email is never shown to matches.</small></label>
            </>}
          </div>
          <div className="card-actions">
            <Button variant="ghost" size="lg" className="back-button" disabled={step === 1} onClick={() => setStep((current) => Math.max(1, current - 1))}><ArrowLeft /> Back</Button>
            <Button size="lg" className="continue-button" disabled={!canContinue} onClick={nextStep}>{step === totalSteps ? 'Create my profile' : 'Continue'} <ArrowRight /></Button>
          </div>
        </div>
      </section>
      <footer className="site-footer"><span>18+ only</span><span>Respect is the entry fee.</span><a href="#">Safety</a><a href="#">Privacy</a></footer>
    </main>
  );
}

function Brand() {
  return <div className="brand" aria-label="Unveil home"><span className="brand-mark"><Sparkles /></span><span>unveil</span><small>beta</small></div>;
}
