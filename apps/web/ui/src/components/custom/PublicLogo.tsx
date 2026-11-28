export default function PublicLogo({ size, label }: { size: number; label?: string }) {
  return (
    <svg className="landing-logo" width={size} height={size} viewBox="0 0 100 100" role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <rect width="100" height="100" rx="22" fill="var(--landing-brand-surface)" />
      <g fill="currentColor">
        <rect x="45.5" y="17.5" width="9" height="12" rx="4.5" />
        <ellipse cx="25.5" cy="36" rx="5" ry="3.6" transform="rotate(35 25.5 36)" />
        <ellipse cx="74.5" cy="36" rx="5" ry="3.6" transform="rotate(-35 74.5 36)" />
        <ellipse cx="27" cy="63" rx="4.6" ry="3" transform="rotate(-35 27 63)" />
        <path d="M60 70l18 7-8-17Z" />
      </g>
      <circle cx="50" cy="51" r="19.5" fill="none" stroke="currentColor" strokeWidth="9.5" />
      <path d="M40.5 46.6Q43.8 44 50 48.6Q56.2 44 59.5 46.6M40.5 53.2Q43.8 50.6 50 55.2Q56.2 50.6 59.5 53.2M50 48.6v6.6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
