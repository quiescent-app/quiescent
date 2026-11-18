import { useLayoutEffect, useRef } from "react";
import { BookmarkCheck, BookOpen, FileText, FolderOpen, NotebookPen, Puzzle } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

import { useAuth } from "@/auth/useAuth";

import "@/styles/landingPage.css";

const sections = [
  { id: "save", label: "Save" },
  { id: "read", label: "Read" },
  { id: "library", label: "Library" },
];

const articleTitle = "Why slow reading still matters";
const reading = [
  { title: "How Raft keeps logs in agreement", minutes: 14, progress: 58 },
  { title: "The Wealth of Nations", minutes: 18, progress: 23 },
];
const finished = { title: "Spaced repetition for the rest of us", minutes: 9, progress: 100 };
const folders = [
  { title: "Econ 301", count: "4 readings" },
  { title: "Interview prep", count: "4 readings" },
  { title: "Thesis, someday", count: "Empty" },
];
const shelves: { title: string; tone: string; items: { title: string; progress?: number }[] }[] = [
  { title: "Reading", tone: "reading", items: reading },
  { title: "Read Later", tone: "later", items: [{ title: articleTitle }, { title: "Consistent hashing, explained" }] },
  { title: "Finished", tone: "finished", items: [{ title: finished.title }] },
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
        <p className="landing-note"><strong>Note</strong> · Compare with the chapter on deep work</p>
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

function LibraryPreview() {
  return (
    <>
      <div className="landing-shelves">
        {shelves.map(({ title, tone, items }) => (
          <div className="landing-panel landing-shelf" key={title}>
            <h3><span className={`landing-dot landing-dot--${tone}`} aria-hidden="true" />{title}</h3>
            <ul>
              {items.map((item) => (
                <li key={item.title}>
                  <span><BookOpen size={15} aria-hidden="true" />{item.title}</span>
                  {item.progress !== undefined && (
                    <progress className="landing-progress" value={item.progress} max={100} aria-label={`Reading progress for ${item.title}`} />
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="landing-panel landing-folders">
        <h3><FolderOpen size={22} aria-hidden="true" /> Folders for your own topics</h3>
        <ul>
          {folders.map(({ title, count }) => (
            <li key={title}>
              <span className="landing-folder-icon"><FolderOpen size={30} strokeWidth={1.4} aria-hidden="true" /></span>
              <span>{title}</span>
              <small>{count}</small>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

export default function LandingPage() {
  const { status } = useAuth();
  const { hash, key } = useLocation();
  const signedIn = status === "authenticated";
  const startPath = signedIn ? "/library" : "/signup";
  const startLabel = signedIn ? "Open your library" : "Get started";
  const chromeStoreUrl = import.meta.env.VITE_CHROME_WEB_STORE_URL?.trim();
  const installDialog = useRef<HTMLDialogElement>(null);
  const installLabel = <><Puzzle size={17} aria-hidden="true" /> Add to Chrome</>;
  const installAction = chromeStoreUrl ? (
    <a className="landing-button landing-button--secondary" href={chromeStoreUrl}>{installLabel}</a>
  ) : (
    <button
      type="button"
      className="landing-button landing-button--secondary"
      aria-haspopup="dialog"
      onClick={() => installDialog.current?.showModal()}
    >
      {installLabel}
    </button>
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
          </nav>
          <div className="landing-header-actions">
            <Link to={signedIn ? "/library" : "/login"}>{signedIn ? "My library" : "Sign in"}</Link>
            {installAction}
          </div>
        </div>
      </header>

      <main id="landing-main" tabIndex={-1}>
        <section className="landing-hero">
          <div className="landing-wrap landing-hero-grid">
            <div>
              <p className="landing-brand landing-brand--hero">
                <img src="/quiescent-logo.png" width="52" height="52" alt="" /> Quiescent
              </p>
              <h1>Read deeply in a noisy world.</h1>
              <p className="landing-hero-lead">For intentional readers.</p>
              <p className="landing-copy">For people who read to learn, not to scroll.</p>
              <div className="landing-actions">
                <Link className="landing-button" to={startPath}>{startLabel}</Link>
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
          <div className="landing-wrap">
            <p className="landing-label">Save</p>
            <h2 id="landing-save-heading">Found something worth reading, but can't read it now?</h2>
            <p className="landing-copy">Click the Q in Chrome and it's saved to your library.</p>
            <figure className="landing-panel landing-browser landing-section-preview" aria-label="Example of saving an article from Chrome">
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
                  <p className="landing-preview-title">{articleTitle}</p>
                  <SampleLines />
                  <div className="landing-ad">Ad</div>
                  <p className="landing-popup">Subscribe to our newsletter! <span aria-hidden="true">×</span></p>
                </div>
              </figure>
              <figure>
                <figcaption className="landing-label">In reader view</figcaption>
                <ReaderPreview />
              </figure>
            </div>
            <div className="landing-reading-progress">
              <div>
                <h3>Track your reading progress.</h3>
                <p className="landing-copy">Lost your place, or forgot how far you got? Each reading shows how much you've finished.</p>
              </div>
              <ul className="landing-panel landing-progress-list">
                {[reading[1], reading[0], finished].map(({ title, minutes, progress }) => (
                  <li key={title}>
                    <div><strong>{title}</strong><span>{progress}%</span></div>
                    <small>Article · {minutes} min</small>
                    <progress className="landing-progress" value={progress} max={100} aria-label={`Reading progress for ${title}`} />
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="landing-section" id="library" tabIndex={-1} aria-labelledby="landing-library-heading">
          <div className="landing-wrap">
            <p className="landing-label">Library</p>
            <h2 id="landing-library-heading">Lost track of what you're reading, and what's next?</h2>
            <p className="landing-copy">Your Library keeps it in order: Reading, Read Later, and Finished, plus folders for your own topics.</p>
            <div className="landing-section-preview"><LibraryPreview /></div>
          </div>
        </section>

        <section className="landing-roadmap landing-section--tinted" aria-labelledby="landing-roadmap-heading">
          <div className="landing-wrap">
            <h2 id="landing-roadmap-heading">Coming next</h2>
            <ul>
              <li><FileText size={19} aria-hidden="true" /> Upload your own PDFs and EPUBs, and read them alongside your articles.</li>
              <li><BookOpen size={19} aria-hidden="true" /> Ask Q! to explain a passage you’ve highlighted.</li>
            </ul>
          </div>
        </section>

        <section className="landing-closing" aria-labelledby="landing-closing-heading">
          <div className="landing-wrap">
            <h2 id="landing-closing-heading">Start with one reading.</h2>
            <div className="landing-actions">
              <Link className="landing-button" to={startPath}>{startLabel}</Link>
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
            <li><a href="https://quiescentdemo.netlify.app/privacy">Privacy Policy</a></li>
            <li><a href="mailto:quiescent.support@gmail.com">quiescent.support@gmail.com</a></li>
          </ul>
          <small>© {new Date().getFullYear()} Quiescent</small>
        </div>
      </footer>

      {!chromeStoreUrl && (
        <dialog ref={installDialog} className="landing-install-dialog" aria-labelledby="landing-install-title" aria-describedby="landing-install-description">
          <h2 id="landing-install-title">Quiescent for Chrome</h2>
          <p id="landing-install-description" className="landing-copy">
            Installation from the Chrome Web Store is currently unavailable.
          </p>
          <form method="dialog" className="landing-actions">
            <button type="submit" className="landing-button">Close</button>
            <a className="landing-button landing-button--secondary" href="mailto:quiescent.support@gmail.com">Contact support</a>
          </form>
        </dialog>
      )}
    </div>
  );
}
