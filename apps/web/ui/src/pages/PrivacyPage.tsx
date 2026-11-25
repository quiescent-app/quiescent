import { useLayoutEffect } from "react";
import { Link, useLocation } from "react-router-dom";

import PublicBrand from "@/components/custom/PublicBrand";

const supportEmail = "quiescent.support@gmail.com";

const policySections = [
  {
    id: "what-we-collect",
    title: "What we collect",
    content: (
      <ul>
        <li><strong>Your email address</strong> identifies your account.</li>
        <li><strong>The title, web address, and text of saved articles</strong> let you read them again from your library.</li>
        <li><strong>Reading progress</strong> lets you pick up where you stopped.</li>
      </ul>
    ),
  },
  {
    id: "extension",
    title: "What the extension reads",
    content: <p>When you click the Q to save an article, the extension reads the current page for the article’s title, web address, and text. It does not watch your browsing, read other tabs, or keep a browsing history.</p>,
  },
  {
    id: "how-we-use-data",
    title: "How we use your data",
    content: <p>We use your data to run your account and show your saved articles and reading progress on computers where you sign in.</p>,
  },
  {
    id: "sharing",
    title: "Who we share it with",
    content: <p>We do not sell your data or use it for advertising. We share it with providers that help us run Quiescent, or when the law requires it.</p>,
  },
  {
    id: "deletion",
    title: "Keeping and deleting your data",
    content: <p>Your library stays with your account when you sign out. To request deletion of your account and saved data, email <a href={`mailto:${supportEmail}`}>{supportEmail}</a>.</p>,
  },
  {
    id: "security",
    title: "Security",
    content: <p>Your data is encrypted in transit. Access within Quiescent is limited to people who need it to run the service.</p>,
  },
  {
    id: "policy-changes",
    title: "Changes to this policy",
    content: <p>If we change what we collect or how we use it, we’ll update this policy and its effective date.</p>,
  },
  {
    id: "contact",
    title: "Contact",
    content: <p>Send questions about your data to <a href={`mailto:${supportEmail}`}>{supportEmail}</a>.</p>,
  },
];

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
          <p className="privacy-date">Effective <time dateTime="2026-11-18">November 18, 2026</time></p>
          <p>Quiescent is a reading app with a website and a Chrome extension. It saves articles to your library so you can read them later.</p>
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
