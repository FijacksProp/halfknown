'use client';

import {
  ArrowDown,
  ArrowRight,
  Heart,
  LockKeyhole,
  MessageCircle,
  MoveUpRight,
  Sparkles,
} from 'lucide-react';
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
          <span className="eyebrow">
            <span className="tiny-cross" aria-hidden="true">
              ✳
            </span>{' '}
            A stranger. A spark. A possibility.
          </span>
          <h1 id="landing-title">
            Less profile.
            <br />
            More <span className="red-word">possibility.</span>
          </h1>
          <p className="hero-lead">
            A little flirting. A new friendship. A conversation that surprises
            you. Start with who you are, not what you look like.
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
        <div className="conversation-stage">
          <span className="stage-note">
            it starts with a hello <MoveUpRight aria-hidden="true" />
          </span>
          <div
            className="conversation-example"
            aria-label="Fictional example conversation, not a live chat"
          >
            <div className="example-top">
              <span className="example-icon">
                <MessageCircle aria-hidden="true" />
              </span>
              <span>
                <strong>The first hello</strong>
                <small>Example conversation</small>
              </span>
              <Heart className="example-heart" aria-hidden="true" />
            </div>
            <div className="example-messages">
              <div className="example-person">
                <span className="alias-icon alias-blue">C</span>
                <span>
                  Comet<small>Identity stays private</small>
                </span>
              </div>
              <p className="sample-bubble bubble-left">
                Important question. Are we sharing the last slice?
              </p>
              <p className="sample-bubble bubble-right">
                Depends. Are we on a date? <span aria-hidden="true">👀</span>
              </p>
              <p className="sample-bubble bubble-left">
                Let’s start with a hello.
              </p>
              <div className="example-person person-right">
                <span>
                  Orbit<small>A little curious</small>
                </span>
                <span className="alias-icon alias-red">O</span>
              </div>
            </div>
            <div className="example-bottom">
              <LockKeyhole aria-hidden="true" /> No real names required.
            </div>
          </div>
          <div className="chemistry-tag">
            <Sparkles aria-hidden="true" />
            <span>
              personality
              <br />
              <strong>looks good on you.</strong>
            </span>
          </div>
          <p className="stage-caption">Less pressure. A little more you.</p>
        </div>
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
            Be yourself.
            <br />
            Leave a little
            <br />
            <span>to discover.</span>
          </h2>
        </div>
        <ol className="how-list">
          <li>
            <span className="step-number">01</span>
            <div>
              <h3>A name that isn’t your name.</h3>
              <p>
                Start with an anonymous alias, your interests, and your
                boundaries. Your email and birth date stay private.
              </p>
            </div>
          </li>
          <li>
            <span className="step-number">02</span>
            <div>
              <h3>Your mood. Your kind of hello.</h3>
              <p>
                Dating, flirting, friendship, or just talking. Choose what you
                are open to—without being put in a box.
              </p>
            </div>
          </li>
          <li>
            <span className="step-number">03</span>
            <div>
              <h3>Connection, at your pace.</h3>
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
          <h2 id="boundary-title">A little mystery. Clear boundaries.</h2>
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
