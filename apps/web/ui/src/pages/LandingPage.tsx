import { useLayoutEffect } from "react";
import { ArrowRight, BookmarkCheck, Mail, NotebookPen, Puzzle } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

import { useAuth } from "@/auth/useAuth";
import PrivacyPolicyDialog from "@/components/custom/PrivacyPolicyDialog";

const sections = [
  { id: "save", label: "Save" },
  { id: "read", label: "Read" },
];

const articleTitle = "Why slow reading still matters";
const reading = [
  { title: "The Wealth of Nations", minutes: 18, progress: 23 },
  { title: "How Raft keeps logs in agreement", minutes: 14, progress: 58 },
  { title: "Spaced repetition for the rest of us", minutes: 9, progress: 100 },
];

function ReaderPreview({ hero = false }: { hero?: boolean }) {
  return (
    <div className={`landing-reader landing-panel${hero ? " landing-reader--hero" : ""}`}>
      <progress className="landing-progress landing-reader-meter" value={42} max={100} aria-label="Example article progress" />
      {hero && <p className="landing-label">AEON.CO · 12 MIN READ</p>}
      <p className="landing-preview-title">{articleTitle}</p>
      <p>
        Attention is not a fixed supply we spend, but a habit we build. Each time we stay with a hard paragraph,{" "}
        <mark>we train the patience that understanding needs</mark>{hero ? ", and the next one comes a little easier." : "."}
      </p>
      {hero ? (
        <p>Skimming feels efficient. It is, for finding. It is not, for keeping.</p>
      ) : (
        <p className="landing-note"><strong>Note:</strong> compare with the chapter on deep work</p>
      )}
      <div className="landing-reader-meta">
        <span>Section 2 / 6 · 42%</span>
        {hero && <span><NotebookPen size={14} aria-hidden="true" /> 1 note</span>}
      </div>
    </div>
  );
}

function SampleLines() {
  return <div className="landing-lines" aria-hidden="true"><span /><span /><span /><span /></div>;
}

export default function LandingPage() {
  const { status } = useAuth();
  const { hash, key } = useLocation();
  const signedIn = status === "authenticated";
  const startPath = signedIn ? "/library" : "/signin";
  const startLabel = signedIn ? "Open your library" : "Get started";
  const chromeStoreUrl = import.meta.env.VITE_CHROME_WEB_STORE_URL?.trim()
    || "https://chromewebstore.google.com/search/Quiescent";
  const installAction = (
    <a className="landing-button landing-button--secondary" href={chromeStoreUrl} target="_blank" rel="noopener noreferrer">
      <Puzzle size={17} aria-hidden="true" /> Add to Chrome
    </a>
  );

  useLayoutEffect(() => {
    if (!hash) {
      if (window.scrollY !== 0) window.scrollTo(0, 0);
      return;
    }

    const target = document.getElementById(hash.slice(1));
    target?.focus({ preventScroll: true });
    target?.scrollIntoView();
  }, [hash, key]);

  return (
    <div className="landing" id="top" tabIndex={-1}>
      <Link className="landing-skip" to="#landing-main">Skip to content</Link>
      <header className="landing-header">
        <div className="landing-header-inner">
          <Link className="landing-brand" to="#top" aria-label="Quiescent, back to top">
            <img src="/quiescent-logo.png" width="30" height="30" alt="" />
            <span>Quiescent</span>
          </Link>
          <nav aria-label="Main navigation">
            {sections.map(({ id, label }) => (
              <Link key={id} to={`#${id}`} aria-current={hash === `#${id}` ? "location" : undefined}>{label}</Link>
            ))}
            <Link to="/library">Library</Link>
          </nav>
          <div className="landing-header-actions">
            <Link to={signedIn ? "/library" : "/signin"}>{signedIn ? "My library" : "Sign in"}</Link>
            {installAction}
          </div>
        </div>
      </header>

      <main id="landing-main" tabIndex={-1}>
        <section className="landing-hero">
          <div className="landing-wrap landing-hero-grid">
            <div>
              <h1>Read deeply <em>in a noisy world.</em></h1>
              <p className="landing-copy">For people who read to learn, not to scroll.</p>
              <div className="landing-actions">
                <Link className="landing-button" to={startPath}>{startLabel} <ArrowRight size={17} aria-hidden="true" /></Link>
                {installAction}
              </div>
            </div>
            <figure className="landing-hero-preview" aria-label="Example of a saved article in reader view">
              <ReaderPreview hero />
              <figcaption className="landing-save-toast">
                <BookmarkCheck size={22} aria-hidden="true" />
                <div>Saved to Read Later<small>From Chrome, in one click</small></div>
              </figcaption>
            </figure>
          </div>
        </section>

        <section className="landing-section" id="save" tabIndex={-1} aria-labelledby="landing-save-heading">
          <div className="landing-wrap landing-feature">
            <div>
              <h2 id="landing-save-heading">Save it for a quieter moment.</h2>
              <p className="landing-copy">Click the Q in Chrome and it's saved to your library.</p>
            </div>
            <figure className="landing-panel landing-browser" aria-label="Example of saving an article from Chrome">
              <div className="landing-browser-toolbar">
                <span className="landing-window-dots" aria-hidden="true"><i /><i /><i /></span>
                <span className="landing-address">aeon.co/essays/why-slow-reading-still-matters</span>
                <img src="/quiescent-logo.png" width="30" height="30" alt="Quiescent extension" />
              </div>
              <div className="landing-browser-body">
                <div><p className="landing-preview-title">{articleTitle}</p><SampleLines /></div>
                <div className="landing-bookmark">
                  <strong><BookmarkCheck size={17} aria-hidden="true" /> Saved to Read Later</strong>
                  <p>{articleTitle}</p>
                  <span>Read now</span>
                </div>
              </div>
            </figure>
          </div>
        </section>

        <section className="landing-section landing-section--tinted" id="progress" tabIndex={-1} aria-labelledby="landing-progress-heading">
          <div className="landing-wrap landing-reading-progress">
            <div>
              <h2 id="landing-progress-heading">Pick up where you left off.</h2>
              <p className="landing-copy">See how far you’ve read at a glance in your library.</p>
            </div>
            <ul className="landing-panel landing-progress-list">
              {reading.map(({ title, minutes, progress }) => (
                <li key={title} className={progress === 100 ? "landing-progress-complete" : undefined}>
                  <div><strong>{title}</strong><span>{progress}%</span></div>
                  <small>Article · {minutes} min</small>
                  <progress className="landing-progress" value={progress} max={100} aria-label={`Reading progress for ${title}`} />
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="landing-section landing-section--tinted" id="read" tabIndex={-1} aria-labelledby="landing-read-heading">
          <div className="landing-wrap">
            <h2 id="landing-read-heading">Give the article your full attention.</h2>
            <p className="landing-copy">Reader view clears away ads and pop-ups so you can read, highlight, and take notes in one place.</p>
            <div className="landing-comparison landing-section-preview">
              <figure>
                <figcaption className="landing-label">Before</figcaption>
                <div className="landing-panel landing-noisy-page">
                  <div className="landing-ad">Ad</div>
                  <div className="landing-noisy-columns">
                    <div>
                      <p className="landing-preview-title">{articleTitle}</p>
                      <SampleLines />
                      <div className="landing-ad">Ad</div>
                      <SampleLines />
                    </div>
                    <div className="landing-noisy-sidebar" aria-hidden="true"><span /><span /><span /></div>
                  </div>
                  <p className="landing-popup">Subscribe to our newsletter! <span aria-hidden="true">×</span></p>
                </div>
              </figure>
              <figure>
                <figcaption className="landing-label">In reader view</figcaption>
                <ReaderPreview />
              </figure>
            </div>
          </div>
        </section>

        <section className="landing-closing" aria-labelledby="landing-closing-heading">
          <div className="landing-wrap">
            <h2 id="landing-closing-heading">Start with one reading.</h2>
            <div className="landing-actions">
              <Link className="landing-button" to={startPath}>{startLabel} <ArrowRight size={17} aria-hidden="true" /></Link>
              {installAction}
            </div>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-wrap">
          <div>
            <p className="landing-brand"><img src="/quiescent-logo.png" width="30" height="30" alt="" /> Quiescent</p>
            <p>Read deeply in a noisy world.</p>
          </div>
          <ul>
            <li><PrivacyPolicyDialog /></li>
            <li><a href="mailto:quiescent.support@gmail.com"><Mail size={14} aria-hidden="true" /> quiescent.support@gmail.com</a></li>
          </ul>
          <small>© {new Date().getFullYear()} Quiescent</small>
        </div>
      </footer>

    </div>
  );
}
