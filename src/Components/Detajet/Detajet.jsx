import DetajetEKategorise from "./DetajetEKategorise";
import DetajetELlogarise from "./DetajetELlogarise";

/**
 * The drill-down, whichever kind of row was opened.
 *
 * Two components rather than one with a flag, because the two answer different questions: a
 * category is spending to be broken down further, an account is a statement with a balance at the
 * end of every day. They share the shell (`ModaliDetajeve`) and the day list (`ListaEDiteve`) and
 * nothing else, which is exactly as much as they have in common.
 *
 * No hooks here, so switching between the two kinds simply unmounts one and mounts the other.
 */
function Detajet(props) {
  if (props.zeri?.tipi === "llogari") return <DetajetELlogarise {...props} />;
  return <DetajetEKategorise {...props} />;
}

export default Detajet;
