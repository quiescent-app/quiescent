import { useLayoutEffect } from "react";
import { Link, useLocation } from "react-router-dom";

import { policyIntroduction, policySections } from "@/components/custom/privacyPolicyContent";
import PublicBrand from "@/components/custom/PublicBrand";
import PublicThemeToggle from "@/components/custom/PublicThemeToggle";
import { usePublicTheme } from "@/hooks/use-public-theme";

export default function PrivacyPage() {
  const { hash, key, search, state } = useLocation();
  const { theme, nextTheme, toggleTheme } = usePublicTheme();

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
    <div className="landing privacy-page" data-theme={theme}>
      <header className="privacy-header">
        <PublicBrand />
        <PublicThemeToggle nextTheme={nextTheme} onToggle={toggleTheme} />
      </header>
      <main className="privacy-content">
        <header>
          <h1>Privacy Policy</h1>
          {policyIntroduction}
        </header>
        {policySections.map(({ id, title, content }) => (
          <section key={id} className="privacy-section">
            <h2 id={id} tabIndex={-1}>
              <Link
                to={{ search, hash: `#${id}` }}
                state={state}
                aria-current={hash === `#${id}` ? "location" : undefined}
              >
                {title}
              </Link>
            </h2>
            {content}
          </section>
        ))}
        <footer className="privacy-signin">
          <Link className="landing-button" to={{ pathname: "/signin", search }} state={state}>Sign in</Link>
        </footer>
      </main>
    </div>
  );
}
