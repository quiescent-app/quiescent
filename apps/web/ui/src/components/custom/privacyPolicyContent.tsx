const supportEmail = "quiescent.support@gmail.com";

export const policySections = [
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

export const policyIntroduction = (
  <>
    <p className="privacy-date">Effective <time dateTime="2026-11-18">November 18, 2026</time></p>
    <p>Quiescent is a reading app with a website and a Chrome extension. It saves articles to your library so you can read them later.</p>
  </>
);
