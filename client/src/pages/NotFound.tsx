import { Link, useLocation } from "react-router-dom";
import { useTitle } from "../hooks/useTitle";

export default function NotFound() {
  useTitle("404 | beans");
  const { pathname } = useLocation();

  return (
    <section className="page page--center">
      <h1 className="error-code">404</h1>
      <p>
        No route matched <code>{pathname}</code>
      </p>
      <Link to="/" className="btn btn-primary">
        Go Home
      </Link>
    </section>
  );
}

