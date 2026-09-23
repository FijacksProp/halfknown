import { ArrowRight, Heart, MessageCircle, Users } from 'lucide-react';
import Image from 'next/image';

export function Landing({
  ready,
  error,
  onBegin,
  onSignIn,
}: {
  ready: boolean;
  error: string;
  onBegin: () => void;
  onSignIn: () => void;
}) {
  return (
    <div className="site-landing">
      <header className="site-header shell">
        <a className="wordmark" href="#top" aria-label="Halfknown home">
          halfknown<span>.</span>
        </a>
        <nav aria-label="Main navigation">
          <a href="#how">How it works</a>
          <a href="#characters">The characters</a>
        </nav>
        <button className="header-signin" onClick={onSignIn}>
          Sign in <ArrowRight size={16} />
        </button>
      </header>

      <main id="top">
        <section className="new-hero shell">
          <div className="new-hero-copy">
            <span className="section-kicker">
              <span className="kicker-line" /> A PLACE TO FIND YOUR PEOPLE
            </span>
            <h1>
              Come curious.
              <br />
              <em>Leave connected.</em>
            </h1>
            <p>
              Meet people you might never have crossed paths with. Follow the
              ones who interest you, talk freely, and make room for something
              more.
            </p>
            <div className="new-hero-actions">
              <button
                className="round-action"
                onClick={onBegin}
                disabled={!ready}
              >
                Find your people <ArrowRight size={20} />
              </button>
              <span>Free to meet. Free to message.</span>
            </div>
            {error && (
              <p className="social-error" role="alert">
                {error}
              </p>
            )}
            <div className="hero-note">
              <span className="note-mark">18+</span> A social space for adults.
              Your character comes first; reveal more when you choose.
            </div>
          </div>
          <div
            className="new-hero-art"
            aria-label="Illustrated group of a goblin, vampire and human artist"
          >
            <Image
              src="/images/halfknown-creators.png"
              alt="A goblin, vampire and human artist hanging out together"
              width={1536}
              height={1024}
            />
            <span className="art-tag art-tag-one">many kinds of people</span>
            <span className="art-tag art-tag-two">one place to meet</span>
          </div>
        </section>

        <section className="landing-band" id="how">
          <div className="shell landing-band-inner">
            <div>
              <span className="section-kicker">THE IDEA</span>
              <h2>
                Some connections
                <br />
                start unexpectedly.
              </h2>
            </div>
            <div className="idea-steps">
              <article>
                <span>01</span>
                <Users size={22} />
                <h3>Find someone interesting</h3>
                <p>
                  Explore people through their interests, character groups, and
                  what they love doing.
                </p>
              </article>
              <article>
                <span>02</span>
                <Heart size={22} />
                <h3>Make it mutual</h3>
                <p>
                  Follow, request a connection, and decide together if you want
                  to keep talking.
                </p>
              </article>
              <article>
                <span>03</span>
                <MessageCircle size={22} />
                <h3>Let it grow</h3>
                <p>
                  Message freely. Friendship, collaboration, attraction—it can
                  go where you both want.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section className="character-section shell" id="characters">
          <div>
            <span className="section-kicker">MEET THE CAST</span>
            <h2>
              Pick a character.
              <br />
              <em>Be yourself.</em>
            </h2>
            <p>
              Humans, aliens, animals, goblins and vampires all have a place
              here. Your character group is a playful identity you can carry
              into future community events.
            </p>
            <button onClick={onBegin} className="text-action">
              Choose yours <ArrowRight size={19} />
            </button>
          </div>
          <div className="character-group-art">
            <Image
              src="/images/halfknown-characters.png"
              alt="An illustrated human, animal character and alien together"
              width={1536}
              height={1024}
            />
          </div>
        </section>

        <section className="landing-end">
          <div className="shell">
            <span className="section-kicker">READY WHEN YOU ARE</span>
            <h2>
              Your next good conversation
              <br />
              could start here.
            </h2>
            <button
              className="round-action light"
              onClick={onBegin}
              disabled={!ready}
            >
              Join Halfknown <ArrowRight size={20} />
            </button>
          </div>
        </section>
      </main>
      <footer className="site-footer shell">
        <span className="wordmark">
          halfknown<span>.</span>
        </span>
        <span>Meet people. See where it goes.</span>
      </footer>
    </div>
  );
}
