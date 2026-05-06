import { Link } from "react-router-dom";
import { useTitle } from "../hooks/useTitle";

export default function Home() {
  useTitle("Home | beans");

  return (
    <section className="page">
      <h1>Welcome Home</h1>
      <p>This is the home page of your React Router + TypeScript app.</p>
      <div className="button-group">
        <Link to="/about" className="btn btn-primary">
          Learn More
        </Link>
        <Link to="/dashboard" className="btn btn-secondary">
          Dashboard →
        </Link>
      </div>
    </section>
  );
}

