import { useLayoutEffect } from "react";
import { Link, useLocation } from "react-router-dom";

import { policyIntroduction, policySections } from "@/components/custom/privacyPolicyContent";
import PublicBrand from "@/components/custom/PublicBrand";

export default function PrivacyPage() {
  const { hash, key, search, state } = useLocation();
  useLayoutEffect(() => {
    if (!hash) {
      window.scrollTo(0, 0);
      return;
    }

    const heading = document.getElementById(hash.slice(1));
    heading?.focus({ preventScroll: true });
    heading?.scrollIntoView?.();
  }, [hash, key]);

  return (
    <div className="landing privacy-page">
      <header className="privacy-header">
        <div className="landing-wrap privacy-header-inner">
          <PublicBrand />
        </div>
      </header>
      <main className="landing-wrap privacy-content">
        <header className="privacy-intro">
          <h1>Privacy Policy</h1>
          {policyIntroduction}
        </header>
        <div className="privacy-body">
          <nav className="privacy-toc" aria-label="On this page">
            <p>On this page</p>
            <ul>
              {policySections.map(({ id, title }) => (
                <li key={id}>
                  <Link
                    to={{ search, hash: `#${id}` }}
                    state={state}
                    aria-current={hash === `#${id}` ? "location" : undefined}
                  >
                    {title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="privacy-sections">
            {policySections.map(({ id, title, content }) => (
              <section key={id} className="privacy-section">
                <h2 id={id} tabIndex={-1}>{title}</h2>
                {content}
              </section>
            ))}
            <Link className="landing-button privacy-signin" to={{ pathname: "/signin", search }} state={state}>Sign in</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
