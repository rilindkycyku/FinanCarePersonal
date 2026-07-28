import { useEffect } from "react";

/** Sets document.title, e.g. "Transaksionet | FinanCarePersonal". */
function PageTitle({ title }) {
  useEffect(() => {
    document.title = title ? `${title} | FinanCarePersonal` : "FinanCarePersonal";
  }, [title]);
  return null;
}

export default PageTitle;
