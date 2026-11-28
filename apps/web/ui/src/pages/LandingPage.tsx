import { useLayoutEffect } from "react";
import { File, Mail, Puzzle, X } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

import { useAuth } from "@/auth/useAuth";
import PrivacyPolicyDialog from "@/components/custom/PrivacyPolicyDialog";
import PublicLogo from "@/components/custom/PublicLogo";
import PublicThemeToggle from "@/components/custom/PublicThemeToggle";
import { usePublicTheme } from "@/hooks/use-public-theme";

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
        {hero && <span><File size={14} aria-hidden="true" /> 1 note</span>}
      </div>
    </div>
  );
}

function SampleLines({ browser = false }: { browser?: boolean }) {
  return <div className="landing-lines" aria-hidden="true"><span /><span /><span /><span />{browser && <span />}</div>;
}

function SavedTurtle({ size, walking = false }: { size: number; walking?: boolean }) {
  return (
    <svg className="landing-saved-turtle" width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <g fill="var(--landing-success-soft)" stroke="currentColor" strokeLinejoin="round">
        {walking && (
          <g fill="var(--landing-success)" strokeWidth="0.8">
            <ellipse cx="7" cy="16.4" rx="1.5" ry="1.15" />
            <ellipse cx="16.8" cy="16.4" rx="1.5" ry="1.15" />
          </g>
        )}
        <circle cx="3.6" cy="10" r="2.9" />
        <circle cx="2.9" cy="9.5" r="0.95" fill="currentColor" stroke="none" />
        <path d="M5 15C5.3 8 8.2 5.5 12 5.5S18.7 8 19 15Z" strokeWidth="1.1" />
        {walking ? (
          <path d="m9.6 10.6 1.2-2.08h2.4l1.2 2.08-1.2 2.08h-2.4Zm0 0H7.2L6 12.68l1.2 2.08m3.6-2.08-1.2 2.08m4.8-4.16h2.4l1.2 2.08-1.2 2.08m-3.6-2.08 1.2 2.08" fill="none" strokeWidth="0.75" />
        ) : (
          <path d="M14.4 10.6 13.2 12.68H10.8L9.6 10.6l1.2-2.08h2.4Z" fill="none" strokeWidth="0.9" />
        )}
        <rect x="4.2" y="14.2" width="15.3" height="2.2" rx="1.1" fill="var(--landing-success)" strokeWidth="0.8" />
      </g>
    </svg>
  );
}

export default function LandingPage() {
  const { status } = useAuth();
  const { hash, key } = useLocation();
  const { theme, nextTheme, toggleTheme } = usePublicTheme();
  const signedIn = status === "authenticated";
  const startAction = (
    <Link className="landing-button" to={signedIn ? "/library" : "/signin"}>
      {signedIn ? "Open your library" : "Get started"}
    </Link>
  );
  const chromeStoreUrl = import.meta.env.VITE_CHROME_WEB_STORE_URL?.trim()
    || "https://chromewebstore.google.com/search/Quiescent";
  const installAction = (
    <a className="landing-button landing-button--secondary" href={chromeStoreUrl} target="_blank" rel="noopener noreferrer">
      <Puzzle size={17} aria-hidden="true" /> Add to Chrome
    </a>
  );

  useLayoutEffect(() => {
    if (!hash || hash === "#top") {
      if (hash) document.getElementById("top")?.focus({ preventScroll: true });
      if (window.scrollY !== 0) window.scrollTo(0, 0);
      return;
    }

    const target = document.getElementById(hash.slice(1));
    target?.focus({ preventScroll: true });
    target?.scrollIntoView();
  }, [hash, key]);

  return (
    <div className="landing" data-theme={theme} id="top" tabIndex={-1}>
      <Link className="landing-skip" to="#landing-main">Skip to content</Link>
      <header className="landing-header">
        <div className="landing-header-inner">
          <Link className="landing-brand" to="#top" aria-label="Quiescent, back to top">
            <PublicLogo size={30} />
            <span>Quiescent</span>
          </Link>
          <nav aria-label="Main navigation">
            {sections.map(({ id, label }) => (
              <Link key={id} to={`#${id}`} aria-current={hash === `#${id}` ? "location" : undefined}>{label}</Link>
            ))}
            <Link to="/library">Library</Link>
          </nav>
          <div className="landing-header-actions">
            <PublicThemeToggle nextTheme={nextTheme} onToggle={toggleTheme} />
            <Link to={signedIn ? "/library" : "/signin"}>{signedIn ? "My library" : "Sign in"}</Link>
            {installAction}
          </div>
        </div>
      </header>

      <main id="landing-main" tabIndex={-1}>
        <section className="landing-hero" aria-labelledby="landing-hero-heading">
          <div className="landing-wrap landing-hero-grid">
            <div>
              <p className="landing-hero-brand">
                <PublicLogo size={52} />
                Quiescent
              </p>
              <h1 id="landing-hero-heading">Read deeply in a noisy world.</h1>
              <p className="landing-hero-tagline">For intentional readers.</p>
              <p className="landing-copy">For people who read to learn, not to scroll.</p>
              <div className="landing-actions">
                {startAction}
                {installAction}
              </div>
            </div>
            <figure className="landing-hero-preview" aria-label="Example of a saved article in reader view">
              <ReaderPreview hero />
              <figcaption className="landing-save-toast">
                <SavedTurtle size={36} walking />
                <div>Saved to Read later<small>From Chrome, in one click</small></div>
              </figcaption>
            </figure>
          </div>
        </section>

        <section className="landing-section" id="save" tabIndex={-1} aria-labelledby="landing-save-heading">
          <div className="landing-wrap">
            <p className="landing-label">Save</p>
            <h2 id="landing-save-heading">Found something worth reading, but can't read it now?</h2>
            <p className="landing-copy">Click the Q in Chrome and it's saved to your library.</p>
            <svg className="landing-browser-pointer" viewBox="0 0 480 68" aria-hidden="true" focusable="false">
              <path d="M2 3C168 3 443 3 477 65" strokeDasharray="5 5" vectorEffect="non-scaling-stroke" />
              <path d="m466 59 11 6 2-12" vectorEffect="non-scaling-stroke" />
            </svg>
            <figure className="landing-panel landing-browser" aria-label="Example of saving an article from Chrome">
              <div className="landing-browser-toolbar">
                <span className="landing-window-dots" aria-hidden="true"><i /><i /><i /></span>
                <span className="landing-address">aeon.co/essays/why-slow-reading-still-matters</span>
                <PublicLogo size={28} label="Quiescent extension" />
              </div>
              <div className="landing-browser-body">
                <div><p className="landing-preview-title">{articleTitle}</p><SampleLines browser /></div>
                <div className="landing-bookmark">
                  <strong><SavedTurtle size={28} /> Saved to Read later</strong>
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
              <h2 id="landing-progress-heading">Track your reading progress in our Library!</h2>
              <p className="landing-copy">Lost your place, or forgot how far you got?</p>
              <p className="landing-copy">Every reading shows your progress as a %, so you stay in control of what you read.</p>
            </div>
            <ul className="landing-progress-list" aria-label="Example of reading progress in the library">
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
            <p className="landing-label">Read</p>
            <h2 id="landing-read-heading">Hard to focus when the article is buried in ads and pop-ups?</h2>
            <p className="landing-copy">Reader view shows just the text, so you can read, highlight and take notes in one calm place.</p>
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
                  <p className="landing-popup">Subscribe to our newsletter! <X size={14} aria-hidden="true" /></p>
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
            <PublicLogo size={48} />
            <h2 id="landing-closing-heading">Start with one reading.</h2>
            <div className="landing-actions">
              {startAction}
              {installAction}
            </div>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-wrap">
          <div>
            <p className="landing-brand"><PublicLogo size={28} /> Quiescent</p>
            <p>Read deeply in a noisy world.</p>
          </div>
          <ul>
            <li><PrivacyPolicyDialog theme={theme} /></li>
            <li><a href="mailto:quiescent.support@gmail.com"><Mail size={14} aria-hidden="true" /> quiescent.support@gmail.com</a></li>
          </ul>
          <small>© {new Date().getFullYear()} Quiescent</small>
        </div>
      </footer>
    </div>
  );
}
