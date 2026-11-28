const supportEmail = "quiescent.support@gmail.com";

export const policySections = [
  {
    id: "what-we-collect",
    title: "What we collect",
    content: (
      <>
        <p>Quiescent collects:</p>
        <ul>
          <li><strong>Your name, email and profile photo</strong>, from Google when you continue with Google, or your email address when you sign in with an email link. We use them to create and identify your account.</li>
          <li><strong>The text, title and link of articles you save</strong>, and PDFs you upload, so you can read them in Quiescent on any computer you sign in on. Highlights and notes you make are stored with them.</li>
          <li><strong>Where you stopped reading</strong>, so each item opens where you left off.</li>
          <li><strong>How you use Quiescent, to improve it</strong>: events such as "article saved" or "item opened", with IDs, counts, durations and the website's domain. These events never contain the text of what you read, highlight or write.</li>
        </ul>
      </>
    ),
  },
  {
    id: "extension",
    title: "What the extension reads",
    content: <p>The extension only reads a page when you click the Q. It does not watch your browsing, read other tabs or keep a history of the sites you visit. When you click the Q on a page, it reads that page's article text, title and link to save it. Before you sign in and agree to this policy, the extension collects and sends nothing.</p>,
  },
  {
    id: "how-we-use-data",
    title: "How we use it",
    content: (
      <ul>
        <li>To run your account and keep your library in sync across your computers.</li>
        <li>To show your saved articles, reading progress, highlights and notes back to you.</li>
        <li>To find and fix problems and to decide what to improve, using the usage events above.</li>
        <li>To send sign-in links and messages about your account. We don't send marketing email.</li>
      </ul>
    ),
  },
  {
    id: "sharing",
    title: "Who we share it with",
    content: <p><strong>We never sell your data</strong>, and we don't use it for advertising. We share it only with service providers that help us run Quiescent (hosting, sign-in and email delivery), under contracts that let them use it only for that, or when the law requires it.</p>,
  },
  {
    id: "deletion",
    title: "Keeping it and deleting it",
    content: <p>We keep your data while you have an account. Signing out removes your session from that computer; your library is kept. To delete your account and everything in it, email <a href={`mailto:${supportEmail}`}>{supportEmail}</a>. We delete it, or remove anything that identifies you, within 30 days.</p>,
  },
  {
    id: "security",
    title: "Security",
    content: <p>Your data is encrypted in transit. Access inside Quiescent is limited to the people who need it to run the service.</p>,
  },
  {
    id: "policy-changes",
    title: "Changes to this policy",
    content: <p>If we change what we collect or how we use it, we'll update this page and its date, and ask you to agree again before the change applies to you.</p>,
  },
  {
    id: "contact",
    title: "Contact",
    content: <p>Questions about your data: <a href={`mailto:${supportEmail}`}>{supportEmail}</a></p>,
  },
];

export const policyIntroduction = (
  <>
    <p className="privacy-date">Effective <time dateTime="2026-11-18">November 18, 2026</time></p>
    <p>Quiescent is a reading app: a website (quiescent.app) and a Chrome extension that save articles to your library so you can read them later. This policy explains what we collect, why, and the choices you have.</p>
  </>
);
