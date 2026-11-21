import { useNavigate } from "react-router-dom";

export default function PrivacyPage() {
  const navigate = useNavigate();

  return (
    <main className="privacy-shell">
      <div className="auth-brand" aria-label="Quiescent">
        <img className="auth-brand-mark" src="/quiescent-logo.png" alt="" />
        <span>Quiescent</span>
      </div>

      <div className="privacy-panel">
        <h1>Privacy Policy</h1>
        <p className="privacy-updated">Effective November 18, 2026</p>

        <section>
          <p>Quiescent is a reading app:
             a website (quiescent.app) and a Chrome extension that save articles to your library so you can read them later.
             This policy explains what we collect, why, and the choices you have.</p>
        </section>

        <section className="privacy-section">
          <h2>What we collect</h2>
          <p>Quiescent collects:</p>
          <ul>
            <li><strong>Your name, email and profile photo</strong>,
                from Google when you continue with Google,
                or your email address when you sign in with an email link.
                We use them to create and identify your account.
            </li>
            <li><strong>The text, title and link of articles you save</strong>,
                and PDFs you upload, so you can read them in Quiescent on any computer you sign in on.
                Highlights and notes you make are stored with them.
            </li>
            <li><strong>Where you stopped reading</strong>,
                so each item opens where you left off.
            </li>
            <li><strong>How you use Quiescent, to improve it</strong>:
                events such as "article saved" or "item opened",
                with IDs, counts, durations and the website's domain.
                These events never contain the text of what you read, highlight or write.
            </li>
          </ul>
        </section>

        <section className="privacy-section">
          <h2>What the extension reads</h2>
          <p>The extension only reads a page when you click the Q.
             It does not watch your browsing, read other tabs or keep a history of the sites you visit.
             When you click the Q on a page, it reads that page's article text, title and link to save it.
             Before you sign in and agree to this policy, the extension collects and sends nothing.
          </p>
        </section>

        <section className="privacy-section">
          <h2>How we use it</h2>
          <ul>
            <li>To run your account and keep your library in sync across your computers.</li>
            <li>To show your saved articles, reading progress, highlights and notes back to you.</li>
            <li>To find and fix problems and to decide what to improve, using the usage events above.</li>
            <li>To send sign-in links and messages about your account. We don't send marketing email.</li>
          </ul>
        </section>

        <section className="privacy-section">
          <h2>Who we share it with</h2>
          <p><strong>We never sell your data</strong>, and we don't use it for advertising.
             We share it only with service providers that help us run Quiescent (hosting, sign-in and email delivery),
             under contracts that let them use it only for that, or when the law requires it.
          </p>
        </section>

        <section className="privacy-section">
          <h2>Keeping it and deleting it</h2>
          <p>We keep your data while you have an account.
             Signing out removes your session from that computer; your library is kept.
             To delete your account and everything in it, email <a href="mailto:quiescent.support@gmail.com">quiescent.support@gmail.com</a>.
             We delete it, or remove anything that identifies you, within 30 days.
          </p>
        </section>

        <section className="privacy-section">
          <h2>Security</h2>
          <p>Your data is encrypted in transit.
             Access inside Quiescent is limited to the people who need it to run the service.
          </p>
        </section>

        <section className="privacy-section">
          <h2>Changes to this policy</h2>
          <p>If we change what we collect or how we use it,
             we'll update this page and its date,
             and ask you to agree again before the change applies to you.
          </p>
        </section>

        <section className="privacy-section">
          <h2>Contact</h2>
          <p>Questions about your data: <a href="mailto:quiescent.support@gmail.com">quiescent.support@gmail.com</a></p>
        </section>

        <hr className="privacy-divider" />

        <button className="privacy-signin" onClick={() => navigate("/login")} type="button">Sign in</button>
      </div>
    </main>
  );
}
