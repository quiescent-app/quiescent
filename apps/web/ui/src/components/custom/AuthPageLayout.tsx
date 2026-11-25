import { useLayoutEffect, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";

import PublicBrand from "./PublicBrand";

export function AuthPrivacyConsent({
  agreed,
  onChange,
}: {
  agreed: boolean;
  onChange: (agreed: boolean) => void;
}) {
  const { search, state } = useLocation();

  return (
    <div className="auth-consent">
      <div>
        <input
          aria-describedby="auth-consent-hint"
          aria-labelledby="auth-consent-label auth-consent-policy"
          checked={agreed}
          id="auth-consent"
          onChange={(event) => onChange(event.target.checked)}
          required
          type="checkbox"
        />
        <div>
          <label htmlFor="auth-consent" id="auth-consent-label">I've read and agree to the</label>{" "}
          <Link id="auth-consent-policy" to={{ pathname: "/privacy", search }} state={state}>Privacy Policy</Link>.
        </div>
      </div>
      <p id="auth-consent-hint">Agree to the Privacy Policy to continue.</p>
    </div>
  );
}

export default function AuthPageLayout({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [title]);

  return (
    <main className="landing auth-shell">
      <aside className="auth-intro" aria-label="About Quiescent">
        <div className="auth-intro-inner">
          <PublicBrand />
          <div className="auth-intro-copy">
            <h2>Read deeply in a noisy world.</h2>
            <p>Save what’s worth reading, highlight what stays with you, and pick up where you left off.</p>
          </div>
          <figure className="auth-reader" aria-label="Focused reader preview">
            <figcaption><span>Focused reader</span><span>4 min read</span></figcaption>
            <div className="auth-reader-copy">
              <h2>The pleasure of reading slowly</h2>
              <p>Some ideas take time to settle. On a second pass, a sentence you barely noticed can change how you understand the whole piece.</p>
              <p><mark>Give yourself time to stay with an idea.</mark></p>
            </div>
            <div className="auth-reader-progress">
              <label htmlFor="auth-reader-meter">Reading progress</label>
              <progress className="landing-progress" id="auth-reader-meter" max={100} value={64} />
              <span>64%</span>
            </div>
          </figure>
        </div>
      </aside>

      <section className="auth-panel" aria-labelledby="auth-title">
        <div className="auth-heading">
          <h1 id="auth-title">{title}</h1>
          <p>{description}</p>
        </div>
        {children}
        <details className="auth-data">
          <summary>How Quiescent uses your data</summary>
          <div className="auth-data-content">
            <p>Quiescent collects:</p>
            <ul>
              <li>Your name, email, and profile photo</li>
              <li>The text, title, and link of articles you save</li>
              <li>Where you stopped reading</li>
              <li>How you use Quiescent to improve the experience</li>
            </ul>
            <p>The Chrome extension only reads a page when you click the Q. Quiescent does not sell your data.</p>
          </div>
        </details>
      </section>
    </main>
  );
}
