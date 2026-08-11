import { useEffect } from "react";

const BAZA = "FinanCarePersonal";

// The description shipped in index.html, kept so a page that sets its own can hand it back.
let pershkrimiFillestar = null;

/**
 * Sets the document title, e.g. "Transaksionet | FinanCarePersonal", and - when the page passes
 * one - its description. Every route is served from the same index.html, so without this a crawler
 * (or a shared link) would see the home page's metadata on every page.
 */
function PageTitle({ title, description }) {
  useEffect(() => {
    document.title = title ? `${title} | ${BAZA}` : BAZA;

    const meta = document.querySelector('meta[name="description"]');
    if (meta) {
      if (pershkrimiFillestar === null) pershkrimiFillestar = meta.getAttribute("content") || "";
      meta.setAttribute("content", description || pershkrimiFillestar);
    }
  }, [title, description]);

  return null;
}

export default PageTitle;
