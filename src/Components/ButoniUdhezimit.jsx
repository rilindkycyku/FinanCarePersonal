import { Link, useLocation } from "react-router-dom";
import { HelpCircle } from "lucide-react";
import { udhezimiPerShteg } from "../lib/udhezimet";
import "../Pages/Styles/Personal.css";

/**
 * «Si përdoret kjo faqe?» - lidhja nga një faqe te udhëzimi i saj.
 *
 * Faqja nuk e emërton udhëzimin që kërkon: e gjen nga adresa ku ndodhet (`udhezimiPerShteg`), pra
 * nuk ka çfarë të mbetet pas nëse një udhëzim riemërtohet, dhe një faqe e re pa udhëzim nuk shfaq
 * një lidhje të thyer - butoni thjesht nuk vizatohet.
 *
 * Ndodhet te koka e çdo faqeje, jo te një zë i vetëm menuje, sepse pyetja «si përdoret kjo» lind
 * pikërisht aty ku dikush ka ngecur - dhe rruga deri te udhëzuesi e mbyll faqen që po shikonte.
 */
function ButoniUdhezimit({ className = "" }) {
  const { pathname } = useLocation();
  const udhezimi = udhezimiPerShteg(pathname);

  if (!udhezimi) return null;

  return (
    <Link
      to={`/udhezuesi/${udhezimi.id}`}
      className={`fcp-udh-ndihma ${className}`.trim()}
      title={`Si përdoret faqja ${udhezimi.etiketa}`}
    >
      <HelpCircle size={14} />
      <span>Si përdoret</span>
    </Link>
  );
}

export default ButoniUdhezimit;
