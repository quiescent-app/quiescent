import { Moon, Sun } from "lucide-react";

export default function PublicThemeToggle({
  nextTheme,
  onToggle,
}: {
  nextTheme: "light" | "dark";
  onToggle: () => void;
}) {
  const Icon = nextTheme === "dark" ? Sun : Moon;
  const label = `Switch to ${nextTheme} mode`;

  return (
    <button className="landing-theme" type="button" onClick={onToggle} aria-label={label} title={label}>
      <Icon size={17} aria-hidden="true" />
    </button>
  );
}
