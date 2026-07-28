import { Container, Spinner } from "react-bootstrap";
import NavBar from "./NavBar";
import Footer from "./Footer";
import PageTitle from "./PageTitle";
import "../Pages/Styles/Personal.css";

/**
 * Shown while the first IndexedDB read is in flight. Without it every page would paint its
 * computed figures from empty arrays for a frame or two — a dashboard reading "0,00 €" and
 * "0 llogari aktive" before the real data lands, which looks like data loss rather than loading.
 */
function PageLoading({ title }) {
  return (
    <div className="fcp-page">
      <PageTitle title={title} />
      <NavBar />
      <Container className="py-5 text-center">
        <Spinner animation="border" variant="success" className="mb-3" />
        <p className="text-muted mb-0">Duke ngarkuar të dhënat...</p>
      </Container>
      <Footer />
    </div>
  );
}

export default PageLoading;
