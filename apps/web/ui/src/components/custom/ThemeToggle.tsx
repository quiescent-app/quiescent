interface ThemeToggleProps {
  dark: boolean;
  onToggle: () => void;
}

export function ThemeToggle({ dark, onToggle }: ThemeToggleProps) {
  const label = dark ? "Switch to light mode" : "Switch to dark mode";

  return (
    <button aria-label={label} className="q-theme-toggle" onClick={onToggle} title={label} type="button">
      <svg
        aria-hidden="true"
        fill="none"
        height={18}
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth={1.65}
        viewBox="0 0 24 24"
        width={18}
      >
        {dark ? (
          <path d="M20.6 15.1A8.7 8.7 0 0 1 8.9 3.4 9 9 0 1 0 20.6 15.1Z" />
        ) : (
          <>
            <circle cx={12} cy={12} r={4} />
            <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.4 1.4m11.2 11.2L19 19M5 19l1.4-1.4M17.6 6.4 19 5" />
          </>
        )}
      </svg>
    </button>
  );
}
