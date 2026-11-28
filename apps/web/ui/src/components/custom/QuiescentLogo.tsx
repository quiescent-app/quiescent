interface QuiescentLogoProps {
  dark: boolean;
  className?: string;
}

export function QuiescentLogo({ dark, className }: QuiescentLogoProps) {
  return <img alt="" className={className} src={dark ? "/quiescent-logo-dark.png" : "/quiescent-logo.png"} />;
}
