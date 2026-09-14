'use client';

import { ArrowDown, ArrowRight, LockKeyhole } from 'lucide-react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';

export function Landing({
  onBegin,
  onSignIn,
  ready,
  error,
}: {
  onBegin: () => void;
  onSignIn: () => void;
  ready: boolean;
  error: string;
}) {
  return (
    <div className="landing">
      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="hero-copy">
          <span className="eyebrow">Meet people. Keep your privacy.</span>
          <h1 id="landing-title">
            Someone worth
            <br />
            <em>getting to know.</em>
          </h1>
          <p className="hero-lead">
            For the conversations you wouldn’t have anywhere else. Meet someone
            new, take your time, and decide what you share.
          </p>
          <div className="hero-actions">
            <Button
              className="primary-button"
              disabled={!ready}
              onClick={onBegin}
            >
              {ready
                ? 'Find your kind of connection'
                : 'Checking your session…'}
              <ArrowRight aria-hidden="true" />
            </Button>
          </div>
          <p className="hero-signin">
            Already a little known here?{' '}
            <button onClick={onSignIn} disabled={!ready}>
              Sign in
            </button>
          </p>
          {error && (
            <div className="form-error" role="alert">
              <p>{error}</p>
              <Button variant="ghost" onClick={() => window.location.reload()}>
                Try reconnecting
              </Button>
            </div>
          )}
          <div className="hero-trust">
            <LockKeyhole aria-hidden="true" />
            <span>Private identity. Real boundaries. Always 18+.</span>
          </div>
        </div>
        <figure className="character-feature">
          <div className="character-frame">
            <Image
              src="/images/halfknown-characters.png"
              width={1536}
              height={1024}
              unoptimized
              fetchPriority="high"
              alt="An illustrated person, cat, and alien getting to know one another."
            />
          </div>
          <figcaption>
            <span>Different faces. Common ground.</span>
            <small>Original AI-generated characters, not member photos.</small>
          </figcaption>
        </figure>
      </section>
      <div className="preview-ribbon">
        <span className="ribbon-label">A WORK IN PROGRESS</span>
        <p>Make your profile today. Live matching and chat are coming next.</p>
        <a href="#how-it-works">
          Get to know halfknown <ArrowDown aria-hidden="true" />
        </a>
      </div>
      <section
        className="how-section"
        id="how-it-works"
        aria-labelledby="how-title"
      >
        <div className="section-intro">
          <span className="eyebrow">The idea is simple</span>
          <h2 id="how-title">
            Good company.
            <br />
            <span>On your terms.</span>
          </h2>
        </div>
        <ol className="how-list">
          <li>
            <span className="step-number">01</span>
            <div>
              <h3>Choose what people know.</h3>
              <p>
                Start with an anonymous alias, your interests, and your
                boundaries. Your email and birth date stay private.
              </p>
            </div>
          </li>
          <li>
            <span className="step-number">02</span>
            <div>
              <h3>Say what you’re here for.</h3>
              <p>
                Dating, flirting, friendship, or just talking. Choose what you
                are open to—without being put in a box.
              </p>
            </div>
          </li>
          <li>
            <span className="step-number">03</span>
            <div>
              <h3>Meet when you’re ready.</h3>
              <p>
                Planned next: Open Chat and Compatible Match. Both will respect
                mutual preferences, age boundaries, and blocks.
              </p>
            </div>
          </li>
        </ol>
      </section>
      <section className="boundary-band" aria-labelledby="boundary-title">
        <span className="boundary-icon">
          <ShieldSymbol />
        </span>
        <div>
          <h2 id="boundary-title">Your boundaries belong to you.</h2>
          <p>
            18+ only. Gender preferences stay free. Open Chat is a separate,
            explicit opt-in.
          </p>
        </div>
        <Button className="dark-button" disabled={!ready} onClick={onBegin}>
          Make yourself halfknown <ArrowRight aria-hidden="true" />
        </Button>
      </section>
    </div>
  );
}

function ShieldSymbol() {
  return <LockKeyhole aria-hidden="true" />;
}
