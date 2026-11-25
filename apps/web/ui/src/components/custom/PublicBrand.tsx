import { Link } from "react-router-dom";

export default function PublicBrand() {
  return (
    <Link className="landing-brand public-brand" to="/" aria-label="Quiescent home">
      <img src="/quiescent-logo.png" width="34" height="34" alt="" />
      <span>Quiescent</span>
    </Link>
  );
}
