import { Link } from "react-router-dom";

import PublicLogo from "./PublicLogo";

export default function PublicBrand() {
  return (
    <Link className="landing-brand public-brand" to="/" aria-label="Quiescent home">
      <PublicLogo size={34} />
      <span>Quiescent</span>
    </Link>
  );
}
