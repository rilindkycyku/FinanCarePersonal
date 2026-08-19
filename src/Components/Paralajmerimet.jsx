import { useEffect, useRef } from "react";
import { useData } from "../Context/DataContext";
import { njoftoListen } from "../lib/njoftimet";
import { paralajmerimetENisjes } from "../lib/paralajmerimet";
import { todayISO } from "../lib/format";

/** The ledger has just been read; a moment later is soon enough for a reminder, and it keeps the
 * first paint clear. */
const VONESA = 4000;

/**
 * The reminders that belong to opening the app rather than to saving something: recurring payments
 * that have reached their date and are still waiting.
 *
 * Renders nothing. The dashboard already carries the same warning as a banner - this is for the
 * person who opened the app to check one thing and closed it again without scrolling, and it is
 * limited to one per day by the key (`pagesa:<data>`), whatever the app does.
 */
function Paralajmerimet() {
  const { profile, recurring, loading } = useData();
  const teDhenat = useRef({});
  teDhenat.current = { profile, recurring };

  const aktiv = Boolean(profile?.njoftimePagesa);

  useEffect(() => {
    if (loading || !aktiv) return undefined;
    const ora = setTimeout(() => {
      njoftoListen(paralajmerimetENisjes({ ...teDhenat.current, sot: todayISO() }));
    }, VONESA);
    return () => clearTimeout(ora);
  }, [loading, aktiv]);

  return null;
}

export default Paralajmerimet;
