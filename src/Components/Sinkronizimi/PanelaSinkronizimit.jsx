import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Alert, Button, Card, Col, Form, InputGroup, Row, Spinner } from "react-bootstrap";
import {
  AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Cloud, CloudOff, Code2, Database, ExternalLink,
  KeyRound, Laptop, LogIn, RefreshCw, Save, ScrollText, ShieldCheck, Smartphone, Trash2, UserPlus,
  Wand2, X,
} from "lucide-react";
import ModaliKonfigurimit from "./ModaliKonfigurimit";
import ModaliLidhjes from "./ModaliLidhjes";
import { emriStorit, rreshtatKrahasimit } from "./emratStoreve";
import FushaSekrete from "./FushaSekrete";
import { useDialog } from "../../Context/DialogContext";
import { useSync } from "../../Context/SyncContext";
import {
  dil, gjendjaSkemes, hyr, kontrolloCelesin, ndryshoCelesin, normalizoUrl, pastroKonfigurimin,
  regjistrohu, ruajKonfigurimin,
} from "../../lib/supabase";
import {
  MENYRAT, fshiCloud, harroPajisjen, lexoPajisjet, ndryshimetEFundit, numeroCloud, numeroLokal,
  permbledhjaLidhjes, riparoTani, rivendosKufijte,
} from "../../lib/sinkronizimi";
import { pajisjaKjo, riemertoPajisjen } from "../../lib/pajisja";

/** ms epoch / ISO → "10.08.2026, 21:14", or a dash when it never happened. */
function kohaLexueshme(vlera) {
  if (!vlera) return "-";
  const data = new Date(vlera);
  return Number.isNaN(data.getTime()) ? "-" : data.toLocaleString("sq-AL");
}

/** The project's subdomain, which is what people recognise - the full URL is mostly noise. */
function emriProjektit(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/** "sot 21:14", "dje 08:02", "10.08.2026" - a device list is read for how recently, not for when. */
function saMePare(vlera) {
  const data = new Date(vlera);
  if (Number.isNaN(data.getTime())) return "-";
  const ditet = Math.floor((Date.now() - data.getTime()) / 86400000);
  const ora = data.toLocaleTimeString("sq-AL", { hour: "2-digit", minute: "2-digit" });
  if (ditet <= 0) return `sot ${ora}`;
  if (ditet === 1) return `dje ${ora}`;
  if (ditet < 7) return `${ditet} ditë më parë`;
  return data.toLocaleDateString("sq-AL");
}

/**
 * Everything about syncing with the user's own Supabase project, as one half of the data page.
 *
 * It was a page of its own until the two halves were put together: syncing and Eksporto / Importo
 * are the same question asked twice - where does this ledger exist besides this browser - and
 * keeping them apart meant knowing in advance which of the two menu entries held the half you
 * needed. Only the half on screen is mounted (see `TeDhena`), so nothing here counts cloud rows or
 * lists devices while the export buttons are the ones being read.
 */
function PanelaSinkronizimit() {
  const dialog = useDialog();
  const { konfigurimi, lidhur, automatik, duke, gabim, sinkronizoTani, pastroGabimin } = useSync();

  // Prefilled from what is already saved, for the one case where this form comes back on a device
  // that was connected: a refresh the project refused (password changed, project paused) drops the
  // session but keeps the project. Only the password is missing, so only the password is asked.
  const [form, setForm] = useState(() => ({
    url: konfigurimi.url || "",
    anonKey: konfigurimi.anonKey || "",
    email: konfigurimi.email || "",
    password: "",
  }));
  const [pune, setPune] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [nCloud, setNCloud] = useState(null);
  // What this device holds, counted the same way the cloud counts its rows. The two used to be a
  // row count next to a *transaction* count, which is how a cloud copy missing three quarters of a
  // ledger managed to look merely odd rather than wrong.
  const [nLokal, setNLokal] = useState(null);
  // Which migration the connected project has reached, and what it still owes - read from the
  // project itself rather than from this device, since the project is the thing being migrated.
  const [skema, setSkema] = useState(null);
  // Read from the address on the very first render rather than in an effect: the failure
  // announcement below decides whether to open a dialog during that same commit, and a `setState`
  // from an effect would still be `false` when it looks.
  const [sqlHapur, setSqlHapur] = useState(
    () => new URLSearchParams(window.location.search).get("konfiguro") === "1"
  );
  // The key-rotation field, closed until asked for: it is a once-a-year action sitting next to
  // buttons pressed every day.
  const [celesiIRi, setCelesiIRi] = useState(null);
  // This browser's own name, and the devices the project has seen. The name is local (it describes
  // this browser, not the ledger); the list is read from the project, which is the whole point -
  // the answer to "which device did that?" has to come from somewhere both devices can see.
  const [pajisja, setPajisja] = useState(() => pajisjaKjo());
  const [emriRi, setEmriRi] = useState(null);
  const [pajisjet, setPajisjet] = useState(null);
  const [ndryshimet, setNdryshimet] = useState(null);
  // The two sides counted store by store - the same reading the connect dialog shows, kept on the
  // page because "222 rreshta nga 221 rekorde" answers "is it working" and nothing else. Which
  // store is short is the question anybody actually has.
  const [ndarja, setNdarja] = useState(null);
  const [gjurmaHapur, setGjurmaHapur] = useState(false);
  // Whether this device has been told what to do with the cloud copy. `false` and nothing else:
  // a device connected before this release carries `null` and has long since decided by using it.
  const duhetVendim = lidhur && konfigurimi.lidhjaVerifikuar === false;
  const [lidhjaHapur, setLidhjaHapur] = useState(false);

  /**
   * `?konfiguro=1` opens the setup dialog straight away - the home screen sends people here with
   * it when the project has no table yet, and a button that promised "set the project up" should
   * not land on a page where the thing has to be found again. The param is dropped afterwards so a
   * refresh does not reopen it.
   */
  useEffect(() => {
    if (searchParams.get("konfiguro") !== "1") return;
    const next = new URLSearchParams(searchParams);
    next.delete("konfiguro");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const setField = (name, value) => setForm((prev) => ({ ...prev, [name]: value }));

  /**
   * Every result of a button on this page, said in a dialog rather than in a banner at the top.
   *
   * A banner appears above buttons that are often a screen further down, so on a phone the answer
   * to "did that work?" lands off-screen - and the answer to a button press is the one thing
   * nobody should have to go looking for. The same modal the rest of the app uses for its
   * confirmations, so a failure here reads like every other message in the app.
   *
   * The single failure with a fix worth offering - a project whose setup SQL was never run - gets
   * the script as its own button instead of a paragraph telling the user where to find it.
   */
  const njofto = async (lloji, teksti, sql = false) => {
    const titulli = { success: "U krye", danger: "Gabim", warning: "Kujdes", info: "Njoftim" }[lloji];
    if (!sql) {
      await dialog.alert(teksti, { title: titulli, variant: lloji });
      return;
    }
    const shfaq = await dialog.confirm(teksti, {
      title: titulli,
      variant: lloji,
      confirmLabel: "Konfiguro projektin",
      cancelLabel: "Në rregull",
    });
    if (shfaq) setSqlHapur(true);
  };

  // A sync that failed on its own - at startup, on the timer, after a save - has nobody watching a
  // return value, so it is announced here the same way a pressed button would be. Once per distinct
  // failure: the same broken wifi retrying every ten minutes is one piece of news, not five.
  const gabimiTreguar = useRef(null);
  useEffect(() => {
    if (!gabim) return;
    const celesi = `${gabim.kodi || ""}:${gabim.mesazhi}`;
    if (gabimiTreguar.current === celesi) return;
    gabimiTreguar.current = celesi;
    // Nothing to announce while the dialog that fixes it is already on screen - which is exactly
    // the case when the home screen sent the user straight here. A second dialog over the first
    // would cover the field they came to fill in.
    if (sqlHapur) return;
    njofto("danger", gabim.mesazhi, gabim.kodi === "tabela").then(pastroGabimin);
    // `njofto` is rebuilt on every render; depending on it would reopen the dialog for ever.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gabim, sqlHapur]);

  // How much is up there, asked once per visit - the one number that answers "did it really go?".
  useEffect(() => {
    if (!lidhur) {
      setNCloud(null);
      setNLokal(null);
      return;
    }
    let anuluar = false;
    Promise.all([numeroCloud(), numeroLokal()])
      .then(([neCloud, lokal]) => {
        if (anuluar) return;
        setNCloud(neCloud);
        setNLokal(lokal);
      })
      .catch(() => {
        if (!anuluar) setNCloud(null);
      });
    return () => {
      anuluar = true;
    };
  }, [lidhur, konfigurimi.fundit]);

  // The devices this project has seen, and the last rows written to it. Both are read only on a
  // connected device and refreshed after every sync, since a sync is the only thing that changes
  // either of them.
  useEffect(() => {
    if (!lidhur) {
      setPajisjet(null);
      setNdryshimet(null);
      setNdarja(null);
      return undefined;
    }
    let anuluar = false;
    permbledhjaLidhjes()
      .then((p) => !anuluar && setNdarja(p))
      .catch(() => !anuluar && setNdarja(null));
    lexoPajisjet()
      .then((lista) => !anuluar && setPajisjet(lista))
      .catch(() => !anuluar && setPajisjet([]));
    ndryshimetEFundit(12)
      .then((lista) => !anuluar && setNdryshimet(lista))
      .catch(() => !anuluar && setNdryshimet([]));
    return () => {
      anuluar = true;
    };
  }, [lidhur, konfigurimi.fundit]);

  /**
   * The decision dialog opens by itself the first time a connected device lands here without
   * having made one - which is exactly the moment somebody has just typed their password and is
   * looking at the screen. Not reopened afterwards if it is dismissed with «Më vonë»: the card
   * behind it stays, and nothing is pushed either way until it is answered.
   */
  const lidhjaTreguar = useRef(false);
  useEffect(() => {
    if (!duhetVendim || lidhjaTreguar.current || sqlHapur || Boolean(pune)) return;
    lidhjaTreguar.current = true;
    setLidhjaHapur(true);
  }, [duhetVendim, sqlHapur, pune]);

  /**
   * Whether the project is still on an older migration than this release ships.
   *
   * Asked of the project, once per visit and again after every sync, because a release that
   * changes the schema has no other way of reaching somebody's own database - nobody deploys to
   * it, and the app is the only thing that knows what it should look like.
   */
  useEffect(() => {
    if (!lidhur) {
      setSkema(null);
      return;
    }
    let anuluar = false;
    gjendjaSkemes()
      .then((gj) => !anuluar && setSkema(gj))
      .catch(() => !anuluar && setSkema(null));
    return () => {
      anuluar = true;
    };
  }, [lidhur, konfigurimi.fundit]);

  /**
   * The warnings this page can raise, said in the app's own dialog rather than only in a banner.
   *
   * A banner sits wherever the layout puts it, which on a phone is usually below the fold: the
   * cloud copy went on missing three quarters of a ledger in plain sight because the two numbers
   * that disagreed were a paragraph nobody had a reason to read. So each of these announces itself
   * once, with the button that fixes it inside the dialog; the banner stays behind as the standing
   * reminder for anyone who answers «Më vonë».
   *
   * Once per distinct state, never on every render or every sync - and never while the setup
   * dialog is already open, which would put a window over the field the user came to fill in.
   */
  const paralajmerimiTreguar = useRef(null);
  useEffect(() => {
    if (!lidhur || sqlHapur || Boolean(pune)) return;
    // A device that has not yet said what to do with the cloud copy is *expected* to disagree with
    // it - that is the whole question it is being asked. Warning about the gap on top of the
    // dialog that exists to close it would be two windows saying the same thing.
    if (duhetVendim) return;

    const mungojne = nCloud !== null && nLokal !== null && nCloud < nLokal ? nLokal - nCloud : 0;
    const njoftimi = mungojne
      ? {
          celesi: `mungojne:${mungojne}`,
          lloji: "warning",
          teksti: `Projektit i mungojnë ${mungojne} rekorde që ndodhen në këtë pajisje. Ndodh kur tabela zbrazet ose rikrijohet jashtë aplikacionit: pajisja i mban ato si të dërguara dhe nuk i çon më lart.`,
          etiketa: "Riparo tani",
          veprimi: handleRiparo,
        }
      : skema?.perditeso && !skema.mungon
        ? {
            celesi: `skema:${skema.versioni}`,
            lloji: "warning",
            teksti: `Projekti juaj është në versionin ${skema.versioni} të skemës, kurse ky aplikacion pret versionin ${skema.iFundit}. Deri sa të përditësohet, gjërat e reja mund të mos ruhen si duhet.`,
            etiketa: "Përditëso projektin",
            veprimi: () => setSqlHapur(true),
          }
        : konfigurimi.oraServerit === false
          ? {
              celesi: "ora",
              lloji: "warning",
              teksti:
                "Projekti juaj nuk po e vendos vetë orën e rreshtave - ka gjasa ta keni konfiguruar para se skripti ta shtonte atë hap. Pa të, një pajisje me orë të pasaktë mund t'i mbajë ndryshimet e veta pa u parë nga të tjerat.",
              etiketa: "Konfiguro projektin",
              veprimi: () => setSqlHapur(true),
            }
          : null;

    if (!njoftimi || paralajmerimiTreguar.current === njoftimi.celesi) return;
    paralajmerimiTreguar.current = njoftimi.celesi;

    dialog
      .confirm(njoftimi.teksti, {
        title: "Kujdes",
        variant: njoftimi.lloji,
        confirmLabel: njoftimi.etiketa,
        cancelLabel: "Më vonë",
      })
      .then((po) => po && njoftimi.veprimi());
    // Rebuilt every render, so depending on them would reopen the dialog for ever.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lidhur, sqlHapur, duhetVendim, nCloud, nLokal, skema, konfigurimi.oraServerit]);

  const lidhu = async (mode) => {
    const url = normalizoUrl(form.url);
    if (!url) {
      njofto("danger", "Adresa e projektit nuk duket e vlefshme - kopjoni «Project URL» nga Supabase (p.sh. https://abcdefgh.supabase.co).");
      return;
    }
    const celesi = kontrolloCelesin(form.anonKey);
    if (!celesi.ok) {
      njofto("danger", celesi.gabim);
      return;
    }
    if (!form.email.trim() || !form.password) {
      njofto("danger", "Shkruani email-in dhe fjalëkalimin e llogarisë brenda projektit tuaj.");
      return;
    }

    setPune(mode);
    pastroGabimin();
    try {
      if (mode === "regjistrohu") {
        const { konfirmim } = await regjistrohu({ email: form.email, password: form.password, url, anonKey: celesi.celesi });
        if (konfirmim) {
          await njofto(
            "warning",
            "Llogaria u krijua, por projekti kërkon konfirmim me email. Hapni linkun që sapo ju erdhi dhe pastaj shtypni «Hyr»."
          );
          return;
        }
      } else {
        await hyr({ email: form.email, password: form.password, url, anonKey: celesi.celesi });
      }
      // A device that has just connected knows nothing about what is up there, so the first run
      // takes the whole cloud copy - and, until the dialog below is answered, sends nothing at
      // all. The watermarks are reset so that first run really does see everything.
      rivendosKufijte();
      const permbledhja = await sinkronizoTani();
      setForm((prev) => ({ ...prev, password: "" }));
      if (permbledhja?.kerkohetVendim) {
        // The dialog opens by itself a moment later; this says why, so the numbers on the page do
        // not look like a sync that half worked.
        njofto(
          "info",
          `U lidh me projektin dhe u morën ${permbledhja.marre} ndryshime. Kjo pajisje nuk ka dërguar ende asgjë - zgjidhni më poshtë çfarë duhet të ndodhë me kopjen në cloud.`
        );
      } else if (permbledhja) {
        njofto(
          "success",
          `U lidh me projektin. U morën ${permbledhja.marre} ndryshime dhe u dërguan ${permbledhja.derguar}.`
        );
      }
    } catch (err) {
      njofto("danger", err?.message || "Lidhja dështoi.", err?.kodi === "tabela");
    } finally {
      setPune(null);
    }
  };

  /**
   * Marks everything the project turns out not to have, and sends it.
   *
   * The same thing a sync does by itself once a day, on the button - because somebody reading two
   * numbers that disagree should not have to wait a day for the app to notice what they can
   * already see.
   */
  const handleRiparo = async () => {
    setPune("riparo");
    try {
      const sa = await riparoTani();
      // Sent afterwards either way. Finding nothing to re-mark does not mean there is nothing to
      // send: the records may already be waiting, and stopping here would answer a page that says
      // «the project is missing 211 records» with «there was nothing to repair».
      const permbledhja = await sinkronizoTani();
      const derguar = permbledhja?.derguar ?? 0;
      njofto(
        "success",
        sa > 0
          ? `U gjetën ${sa} rekorde që mungonin te projekti; u dërguan ${derguar}.`
          : `Rekordet ishin tashmë në radhë për dërgim; u dërguan ${derguar}.`
      );
    } catch (err) {
      njofto("danger", err?.message || "Riparimi dështoi.");
    } finally {
      setPune(null);
    }
  };

  /**
   * The three directions, each behind the confirmation its consequences deserve.
   *
   * «Bashko» loses nothing, so it runs on the press. The other two destroy one side or the other,
   * and both ask for the word to be typed - the same gate the wipe on the settings page uses, and
   * for the same reason: a stray tap can dismiss a dialog, it cannot type «MERR».
   */
  const handleMenyra = async (menyra) => {
    if (menyra === MENYRAT.MERR) {
      const ok = await dialog.confirm(
        <>
          Kjo pajisje bëhet kopje e projektit tuaj. Çdo transaksion, kategori apo llogari që ndodhet{" "}
          <strong>vetëm këtu</strong> fshihet dhe nuk kthehet dot.
          <ul className="text-start mt-2 mb-2 ps-4">
            <li>Fotot e faturave nuk preken - ato nuk sinkronizohen fare.</li>
            <li>Të dhënat te projekti nuk preken.</li>
          </ul>
          Nëse nuk jeni i sigurt, mbyllni këtë dhe zgjidhni <strong>Bashko</strong>.
        </>,
        {
          title: "Merr gjithçka nga projekti",
          confirmLabel: "Zëvendëso këtë pajisje",
          cancelLabel: "Hiq dorë",
          variant: "danger",
          requireText: "MERR",
        }
      );
      if (!ok) return;
    }
    if (menyra === MENYRAT.DERGO && nCloud !== 0) {
      const ok = await dialog.confirm(
        <>
          Gjithçka që ndodhet në këtë pajisje shkon te projekti dhe{" "}
          <strong>mbishkruan</strong> çfarë ka aty - aktualisht{" "}
          <strong>{nCloud === null ? "…" : nCloud}</strong> rreshta. Pajisjet e tjera do ta marrin
          këtë version në sinkronizimin e tyre të radhës.
          <ul className="text-start mt-2 mb-2 ps-4">
            <li>Përdoreni vetëm nëse kjo pajisje është ajo me të dhënat e sakta.</li>
            <li>
              Nëse kjo pajisje sapo është pastruar ose është e re, ky është veprimi që fshin punën e
              pajisjeve të tjera.
            </li>
          </ul>
        </>,
        {
          title: "Dërgo këtë pajisje mbi cloud",
          confirmLabel: "E kuptoj, dërgo",
          cancelLabel: "Hiq dorë",
          variant: "danger",
          requireText: "DËRGO",
        }
      );
      if (!ok) return;
    }

    setPune(menyra);
    try {
      const permbledhja = await sinkronizoTani({ menyra });
      setLidhjaHapur(false);
      if (permbledhja) {
        njofto(
          "success",
          `U morën ${permbledhja.marre} ndryshime dhe u dërguan ${permbledhja.derguar}. Kjo pajisje tani sinkronizohet normalisht.`
        );
      }
    } catch (err) {
      njofto("danger", err?.message || "Veprimi dështoi.");
    } finally {
      setPune(null);
    }
  };

  const handleEmri = async (e) => {
    e.preventDefault();
    setPajisja(riemertoPajisjen(emriRi));
    setEmriRi(null);
    // Written into the project on the next sync, which is also what refreshes the list below.
    await sinkronizoTani();
  };

  const handleHarroPajisjen = async (p) => {
    const ok = await dialog.confirm(
      <>
        Hiqet nga lista pajisja <strong>{p.emri}</strong>. Të dhënat e saj te projekti nuk preken -
        kjo fshin vetëm shënimin se ajo pajisje ka sinkronizuar ndonjëherë. Nëse ajo pajisje
        sinkronizon sërish, rishfaqet.
      </>,
      { title: "Hiq pajisjen nga lista", confirmLabel: "Hiq" }
    );
    if (!ok) return;
    setPune("pajisja");
    try {
      await harroPajisjen(p.id);
      setPajisjet((lista) => (lista ?? []).filter((x) => x.id !== p.id));
    } catch (err) {
      njofto("danger", err?.message || "Pajisja nuk u hoq.");
    } finally {
      setPune(null);
    }
  };

  const handleSinkronizo = async (ngaFillimi = false) => {
    const permbledhja = await sinkronizoTani({ ngaFillimi });
    if (permbledhja) {
      njofto("success", `U morën ${permbledhja.marre} ndryshime dhe u dërguan ${permbledhja.derguar}.`);
    }
  };

  const handleRuajCelesin = async (e) => {
    e.preventDefault();
    setPune("celesi");
    try {
      await ndryshoCelesin(celesiIRi);
      setCelesiIRi(null);
      njofto("success", "Çelësi u përditësua - kjo pajisje po e përdor atë të riun.");
    } catch (err) {
      njofto("danger", err?.message || "Çelësi nuk u ndryshua.");
    } finally {
      setPune(null);
    }
  };

  const handleShkeputu = async () => {
    const ok = await dialog.confirm(
      <>
        Kjo pajisje ndalon së sinkronizuari dhe harron projektin, çelësin dhe sesionin. Të dhënat
        tuaja mbeten të plota si këtu ashtu edhe në Supabase - mund të rilidheni kur të doni.
      </>,
      { title: "Shkëput sinkronizimin", confirmLabel: "Shkëput" }
    );
    if (!ok) return;
    await dil();
    pastroKonfigurimin();
    njofto("success", "Kjo pajisje u shkëput nga sinkronizimi.");
  };

  /**
   * Two gates, like the wipe on the settings page and for the same reason: this one reaches past
   * the device it is pressed on. The first spells out what disappears, the second only unlocks
   * once the word is typed - a stray double-tap can dismiss one dialog, never both.
   */
  const handleFshiCloud = async () => {
    const ok = await dialog.confirm(
      <>
        Fshihen të gjitha rreshtat tuaj në tabelën <code>financare_records</code> të projektit tuaj -
        aktualisht <strong>{nCloud === null ? "…" : nCloud}</strong> rreshta.
        <ul className="text-start mt-2 mb-2 ps-4">
          <li>Të dhënat në këtë shfletues nuk preken.</li>
          <li>
            Pajisjet e tjera që nuk kanë sinkronizuar ende <strong>nuk i marrin dot</strong>{" "}
            ndryshimet e ngarkuara deri tani.
          </li>
          <li>Sinkronizimi i radhës nga kjo pajisje e ringarkon gjithçka që keni këtu.</li>
        </ul>
        Nëse doni thjesht ta ndalni sinkronizimin, përdorni <strong>Shkëput këtë pajisje</strong> -
        kopja mbetet e paprekur.
      </>,
      { title: "Fshi kopjen në cloud", confirmLabel: "E kuptoj, vazhdo", variant: "danger" }
    );
    if (!ok) return;

    const konfirmimi = await dialog.confirm(
      <>
        Hapi i fundit. Rreshtat te projekti juaj Supabase fshihen përgjithmonë dhe veprimi nuk
        zhbëhet nga këtu.
      </>,
      {
        title: "Konfirmimi i Fundit",
        confirmLabel: "Fshi kopjen",
        cancelLabel: "Hiq dorë",
        variant: "danger",
        requireText: "FSHI",
      }
    );
    if (!konfirmimi) return;
    setPune("fshij");
    try {
      await fshiCloud();
      setNCloud(0);
      njofto("success", "Kopja në cloud u zbraz.");
    } catch (err) {
      njofto("danger", err?.message || "Fshirja dështoi.");
    } finally {
      setPune(null);
    }
  };

  const fundit = konfigurimi.fundit;

  return (
    <>
      <h1 className="fcp-section-title">
        {lidhur ? <Cloud size={22} className="text-primary" /> : <CloudOff size={22} className="text-primary" />}
        Sinkronizimi mes pajisjeve
      </h1>
      <p className="text-muted mb-4">
        Aplikacioni nuk ka server. Nëse doni të njëjtat të dhëna në telefon dhe në kompjuter,
        lidhni një projekt <strong>Supabase tuajin</strong> - falas për një përdorim si ky - dhe
        të dhënat udhëtojnë mes pajisjeve tuaja përmes <em>bazës suaj</em>. Askush tjetër, as unë
        as ndonjë shërbim i FinanCarePersonal, nuk i sheh dhe nuk i ruan ato.
      </p>

      <ModaliKonfigurimit show={sqlHapur} onHide={() => setSqlHapur(false)} url={konfigurimi.url || normalizoUrl(form.url)}
        nga={skema?.versioni ?? 0}
        onGati={() => {
          pastroGabimin();
          gjendjaSkemes().then(setSkema).catch(() => undefined);
          sinkronizoTani();
        }} />

      <ModaliLidhjes
        show={lidhjaHapur}
        onHide={() => setLidhjaHapur(false)}
        duke={Boolean(pune) || duke}
        onZgjidh={handleMenyra}
      />

      {/* Connected, and holding everything back until somebody says which side is right. The
          card stays for as long as that is true - the dialog can be dismissed, the question
          cannot, and a device in this state is syncing in one direction only. */}
      {duhetVendim && (
        <Alert variant="info">
          <strong>Kjo pajisje po vetëm lexon nga projekti.</strong> Derisa të vendosni çfarë të
          ndodhë me kopjen në cloud, asnjë transaksion, kategori apo llogari nga kjo pajisje nuk
          dërgohet lart - kështu një pajisje e sapo pastruar nuk i mbishkruan dot të dhënat e
          vërteta.
          <div className="mt-3">
            <Button variant="outline-light" size="sm" onClick={() => setLidhjaHapur(true)} disabled={Boolean(pune)}>
              <ShieldCheck size={15} className="me-1" /> Shiko dhe vendos
            </Button>
          </div>
        </Alert>
      )}

      {/* A release can change what the project's table has to look like, and there is no deploy
          that could do it - so the app compares what it ships with what the project reports and
          says so here. `mungon` is a different message (the project was never set up at all),
          already handled by the failure this page shows above. */}
      {lidhur && skema?.perditeso && !skema.mungon && (
        <Alert variant="warning">
          Projekti juaj është në versionin {skema.versioni} të skemës, kurse ky aplikacion pret
          versionin {skema.iFundit}. Deri sa të përditësohet, gjërat e reja mund të mos ruhen si
          duhet.
          <ul className="mb-0 mt-2 ps-3 small">
            {skema.pezull.map((m) => (
              <li key={m.versioni}>{m.emri}</li>
            ))}
          </ul>
          <div className="mt-3">
            <Button variant="outline-light" size="sm" onClick={() => setSqlHapur(true)}>
              <Wand2 size={15} className="me-1" /> Përditëso projektin
            </Button>
          </div>
        </Alert>
      )}

      {/* Detected from what the last push came back with (sinkronizimi.js): a project set up
          before the trigger existed keeps whatever time the device sent, and then the order of
          the whole table depends on every device's clock being right. */}
      {lidhur && konfigurimi.oraServerit === false && (
        <Alert variant="warning">
          Projekti juaj nuk po e vendos vetë orën e rreshtave - ka gjasa ta keni konfiguruar para
          se skripti ta shtonte atë hap. Ekzekutojeni skriptin sërish (përsëritja është e sigurt):
          pa të, një pajisje me orë të pasaktë mund t&apos;i mbajë ndryshimet e veta pa u parë nga
          të tjerat.
          <div className="mt-3">
            <Button variant="outline-light" size="sm" onClick={() => setSqlHapur(true)}>
              <Code2 size={15} className="me-1" /> Konfiguro projektin
            </Button>
          </div>
        </Alert>
      )}

      {!lidhur ? (
        <>
          {konfigurimi.url && (
            <Alert variant="warning">
              Sesioni i kësaj pajisjeje nuk vlen më. Projekti dhe çelësi janë ende këtu - mjafton
              fjalëkalimi dhe <strong>Hyr dhe sinkronizo</strong>; hapin e parë mund ta kaloni.
            </Alert>
          )}

          <Card className="profile-card border-0 p-4 mb-4">
            <h2 className="fcp-card-title fw-bold mb-3">
              <Database size={18} className="me-2 text-primary" />
              Hapi 1 - Krijoni projektin dhe tabelën
            </h2>
            <ol className="text-muted small ps-3 mb-3" style={{ lineHeight: 1.9 }}>
              <li>
                Hapni{" "}
                <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer">
                  supabase.com/dashboard <ExternalLink size={12} />
                </a>{" "}
                dhe krijoni një projekt të ri (plani falas mjafton - një vit transaksionesh zë
                disa megabajt).
              </li>
              <li>
                Te <strong>Authentication → URL Configuration</strong> vendosni{" "}
                <strong>Site URL</strong> te adresa e këtij aplikacioni. Parazgjedhja e Supabase
                është <code>http://localhost:3000</code>, pra linku i konfirmimit do të hapte një
                faqe që nuk ekziston. Me adresën e duhur, ai link ju kthen këtu tashmë të futur.
              </li>
              <li>
                Te <strong>Project Settings</strong> merrni <strong>Project URL</strong> (te{" "}
                <em>Data API</em>) dhe çelësin <strong>publishable</strong> -{" "}
                <code>sb_publishable_…</code> te <em>API Keys</em>. Nëse projekti juaj ka ende
                çelësin e vjetër <em>anon</em> te skeda <em>Legacy</em>, edhe ai punon; i riu është
                ai që Supabase rekomandon dhe ai që mund ta zëvendësoni vetëm atë kur t&apos;ju
                duhet. Çelësat <em>secret</em> / <em>service_role</em> mos i kopjoni kurrë këtu.
              </li>
              <li>
                Shtypni <strong>Konfiguro projektin</strong> këtu poshtë: hapet redaktori i
                projektit tuaj me skriptin brenda dhe mjafton <strong>Run</strong>. Tabelën nuk e
                krijon dot çelësi që ngjitni te Hapi 2 - Supabase nuk ia lejon atij këtë punë, dhe
                kjo është mbrojtje, jo mangësi.
              </li>
            </ol>
            <div>
              <Button className="btn-primary" onClick={() => setSqlHapur(true)}>
                <Wand2 size={16} className="me-1" /> Konfiguro projektin
              </Button>
            </div>
          </Card>

          <Card className="profile-card border-0 p-4 mb-4">
            <h2 className="fcp-card-title fw-bold mb-3">
              <LogIn size={18} className="me-2 text-primary" />
              Hapi 2 - Lidhni këtë pajisje
            </h2>
            <p className="text-muted small mb-3">
              Llogaria krijohet brenda projektit tuaj, jo diku tjetër. Përdorni të njëjtin email
              dhe fjalëkalim në çdo pajisje që doni të mbani në hap. Herën e parë shtypni{" "}
              <strong>Krijo llogari</strong>, në pajisjet e tjera <strong>Hyr</strong>.
            </p>
            <Form
              onSubmit={(e) => {
                e.preventDefault();
                lidhu("hyr");
              }}
            >
              <Row className="g-3">
                <Form.Group as={Col} md={7} controlId="sync-url">
                  <Form.Label>Project URL</Form.Label>
                  <Form.Control
                    placeholder="https://abcdefgh.supabase.co"
                    value={form.url}
                    onChange={(e) => setField("url", e.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                  />
                </Form.Group>

                <FushaSekrete
                  id="sync-key"
                  md={5}
                  label="Çelësi publik"
                  placeholder="sb_publishable_… ose eyJhbGciOi…"
                  value={form.anonKey}
                  onChange={(e) => setField("anonKey", e.target.value)}
                  autoComplete="off"
                  ndihma="Publishable (ose anon i vjetër) - çelësi i destinuar për shfletues."
                />

                <Form.Group as={Col} md={6} controlId="sync-email">
                  <Form.Label>Email</Form.Label>
                  <Form.Control
                    type="email"
                    placeholder="ju@shembull.com"
                    value={form.email}
                    onChange={(e) => setField("email", e.target.value)}
                    autoComplete="username"
                  />
                </Form.Group>

                <FushaSekrete
                  id="sync-password"
                  md={6}
                  label="Fjalëkalimi"
                  placeholder="të paktën 6 karaktere"
                  value={form.password}
                  onChange={(e) => setField("password", e.target.value)}
                  autoComplete="current-password"
                />

                <Col md={12} className="d-flex flex-wrap gap-2">
                  <Button type="submit" className="btn-primary" disabled={Boolean(pune)}>
                    {pune === "hyr" ? (
                      <Spinner animation="border" size="sm" className="me-2" />
                    ) : (
                      <LogIn size={16} className="me-1" />
                    )}
                    Hyr dhe sinkronizo
                  </Button>
                  <Button variant="outline-light" onClick={() => lidhu("regjistrohu")} disabled={Boolean(pune)}>
                    {pune === "regjistrohu" ? (
                      <Spinner animation="border" size="sm" className="me-2" />
                    ) : (
                      <UserPlus size={16} className="me-1" />
                    )}
                    Krijo llogari
                  </Button>
                </Col>
              </Row>
            </Form>
          </Card>
        </>
      ) : (
        <>
          <Card className="profile-card border-0 p-4 mb-4">
            <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-3">
              <div>
                <h2 className="fcp-card-title fw-bold mb-1">E lidhur me projektin tuaj</h2>
                <div className="fcp-row-sub">
                  {emriProjektit(konfigurimi.url)} · {konfigurimi.email}
                </div>
              </div>
              <div className="text-end">
                <div className="fcp-row-sub">Sinkronizimi i fundit</div>
                <div className="fw-bold">{kohaLexueshme(fundit?.kur)}</div>
              </div>
            </div>

            {fundit?.gabim ? (
              <Alert variant="warning" className="py-2 px-3 small">
                Përpjekja e fundit dështoi: {fundit.gabim}
              </Alert>
            ) : (
              fundit && (
                <p className="text-muted small mb-3">
                  Herën e fundit u morën <strong>{fundit.marre}</strong> ndryshime dhe u dërguan{" "}
                  <strong>{fundit.derguar}</strong>. Në cloud ndodhen{" "}
                  <strong>{nCloud === null ? "…" : nCloud}</strong> rreshta nga{" "}
                  <strong>{nLokal === null ? "…" : nLokal}</strong> rekorde që mban kjo pajisje.
                </p>
              )
            )}

            {/* The cloud may hold more than this device (tombstones swept here, rows another
                device deleted), never less - so this way round it is always something to act
                on, and never a false alarm. */}
            {!duhetVendim && nCloud !== null && nLokal !== null && nCloud < nLokal && (
              <Alert variant="warning" className="py-2 px-3 small">
                Projektit i mungojnë <strong>{nLokal - nCloud}</strong> rekorde që ndodhen këtu.
                Ndodh kur tabela zbrazet ose rikrijohet jashtë aplikacionit: pajisja i mban ato
                si të dërguara dhe nuk i çon më lart. Sinkronizimi e kontrollon vetë një herë në
                ditë - ose shtypeni tani.
                <div className="mt-2">
                  <Button variant="outline-light" size="sm" onClick={handleRiparo} disabled={Boolean(pune) || duke}>
                    {pune === "riparo" ? (
                      <Spinner animation="border" size="sm" className="me-2" />
                    ) : (
                      <ShieldCheck size={15} className="me-1" />
                    )}
                    Riparo kopjen në cloud
                  </Button>
                </div>
              </Alert>
            )}

            <Form.Check
              type="switch"
              id="sync-automatik"
              className="mb-1"
              label="Sinkronizo automatikisht"
              checked={automatik}
              onChange={(e) => ruajKonfigurimin({ automatik: e.target.checked })}
            />
            <div className="fcp-row-sub mb-3">
              Kur është aktiv, sinkronizimi bëhet vetë: kur hapet aplikacioni, pak sekonda pas çdo
              ndryshimi, kur ktheheni te skeda dhe kur pajisja kthehet online. Kur është joaktiv,
              asgjë nuk del nga shfletuesi derisa ta shtypni butonin vetë.
            </div>

            <div className="d-flex flex-wrap gap-2">
              <Button className="btn-primary" onClick={() => handleSinkronizo(false)} disabled={duke || Boolean(pune)}>
                {duke ? <Spinner animation="border" size="sm" className="me-2" /> : <RefreshCw size={16} className="me-1" />}
                Sinkronizo tani
              </Button>
              <Button variant="outline-light" onClick={handleShkeputu} disabled={duke || Boolean(pune)}>
                <CloudOff size={16} className="me-1" /> Shkëput këtë pajisje
              </Button>
            </div>

            {/* The two directions that overwrite one side with the other. They used to be one
                button called «Shkarko gjithçka nga cloud», which also silently re-uploaded
                everything this device held - so the button that sounded like the safe one was
                the one that could overwrite the other devices. Now they are two, they say what
                they do, and each asks for its word to be typed. */}
            <div className="mt-3">
              <div className="fcp-row-sub mb-2">
                Kur dy pajisje nuk përputhen dhe doni ta zgjidhni ju vetë se cila ka të drejtë:
              </div>
              <div className="d-flex flex-wrap gap-2">
                <Button
                  variant="outline-light"
                  size="sm"
                  onClick={() => handleMenyra(MENYRAT.BASHKO)}
                  disabled={duke || Boolean(pune)}
                >
                  {pune === MENYRAT.BASHKO && <Spinner animation="border" size="sm" className="me-2" />}
                  Bashko me projektin
                </Button>
                <Button
                  variant="outline-warning"
                  size="sm"
                  onClick={() => handleMenyra(MENYRAT.MERR)}
                  disabled={duke || Boolean(pune)}
                >
                  {pune === MENYRAT.MERR ? (
                    <Spinner animation="border" size="sm" className="me-2" />
                  ) : (
                    <ArrowDownToLine size={15} className="me-1" />
                  )}
                  Merr gjithçka nga projekti
                </Button>
                <Button
                  variant="outline-danger"
                  size="sm"
                  onClick={() => handleMenyra(MENYRAT.DERGO)}
                  disabled={duke || Boolean(pune)}
                >
                  {pune === MENYRAT.DERGO ? (
                    <Spinner animation="border" size="sm" className="me-2" />
                  ) : (
                    <ArrowUpFromLine size={15} className="me-1" />
                  )}
                  Dërgo gjithçka nga kjo pajisje
                </Button>
              </div>
            </div>

            {celesiIRi === null ? (
              <button
                type="button"
                className="btn btn-link p-0 mt-3 text-decoration-none fcp-row-sub"
                onClick={() => setCelesiIRi(konfigurimi.anonKey || "")}
              >
                <KeyRound size={14} className="me-1" /> Ndrysho çelësin publik
              </button>
            ) : (
              <Form onSubmit={handleRuajCelesin} className="mt-3">
                <Row className="g-2 align-items-end">
                  <FushaSekrete
                    id="sync-celesi-ri"
                    md={7}
                    label="Çelësi publik i ri"
                    placeholder="sb_publishable_…"
                    value={celesiIRi}
                    onChange={(e) => setCelesiIRi(e.target.value)}
                    // Opens holding the current key, so it can be revealed and compared with the
                    // dashboard - but selected on focus, because the reason anyone is here is to
                    // paste a different one over it.
                    onFocus={(e) => e.target.select()}
                    autoComplete="off"
                    ndihma="Provohet te projekti para se të ruhet, pra një çelës i gabuar nuk e lë pajisjen pa sinkronizim. Për të kaluar te një projekt tjetër duhet shkëputja."
                  />
                  <Col md={5} className="d-flex gap-2">
                    <Button type="submit" className="btn-primary" disabled={pune === "celesi"}>
                      {pune === "celesi" ? (
                        <Spinner animation="border" size="sm" className="me-2" />
                      ) : (
                        <Save size={16} className="me-1" />
                      )}
                      Ruaj çelësin
                    </Button>
                    <Button variant="secondary" onClick={() => setCelesiIRi(null)} disabled={pune === "celesi"}>
                      Anulo
                    </Button>
                  </Col>
                </Row>
              </Form>
            )}
          </Card>

          {/* What is actually stored, on each side, store by store - the same table the connect
              dialog shows. The page used to say only "222 rreshta nga 221 rekorde", which
              answers whether sync is working and nothing else; when a store *is* short, this is
              the only view that says which one. */}
          <Card className="profile-card border-0 p-4 mb-4">
            <h2 className="fcp-card-title fw-bold mb-3">
              <Database size={18} className="me-2 text-primary" />
              Çka ruhet aktualisht
            </h2>
            {ndarja === null ? (
              <div className="fcp-row-sub">Po numërohen të dyja anët...</div>
            ) : (
              <>
                <div className="table-responsive">
                  <table className="table table-sm align-middle mb-0">
                    <thead>
                      <tr className="fcp-row-sub">
                        <th className="fw-normal"> </th>
                        <th className="fw-normal text-end">Te projekti</th>
                        <th className="fw-normal text-end">Në këtë pajisje</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rreshtatKrahasimit(ndarja).map((rr) => (
                        <tr key={rr.store}>
                          <td>{emriStorit(rr.store, true)}</td>
                          <td className="text-end">{rr.cloud || "—"}</td>
                          <td className="text-end">{rr.lokal || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="fw-bold border-top">
                        <td>Gjithsej</td>
                        <td className="text-end">{ndarja.cloud}</td>
                        <td className="text-end">{ndarja.lokal}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <div className="fcp-row-sub mt-2">
                  {ndarja.teNjejta} rekorde ndodhen në të dyja anët, {ndarja.vetemLokale} vetëm
                  këtu dhe {ndarja.vetemCloud} vetëm te projekti. Numërohen edhe shënimet e
                  fshirjeve, prandaj një shifër këtu mund të jetë më e madhe se ajo që shfaqin
                  faqet. Fotot e faturave nuk sinkronizohen dhe nuk numërohen fare.
                </div>
              </>
            )}
          </Card>

          {/* Who wrote what. One account is signed in on every device, so without this the
              project cannot answer the only question that matters after a sync does something
              unexpected - and the user was left comparing screenshots. */}
          <Card className="profile-card border-0 p-4 mb-4">
            <h2 className="fcp-card-title fw-bold mb-3">
              <Smartphone size={18} className="me-2 text-primary" />
              Pajisjet tuaja
            </h2>

            {emriRi === null ? (
              <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
                <span className="fcp-row-sub">Kjo pajisje quhet</span>
                <strong>{pajisja.emri}</strong>
                <button
                  type="button"
                  className="btn btn-link p-0 text-decoration-none fcp-row-sub"
                  onClick={() => setEmriRi(pajisja.emri)}
                >
                  <KeyRound size={13} className="me-1" /> ndrysho
                </button>
              </div>
            ) : (
              <Form onSubmit={handleEmri} className="mb-3">
                <InputGroup>
                  <Form.Control
                    value={emriRi}
                    onChange={(e) => setEmriRi(e.target.value)}
                    placeholder="p.sh. Tableti i shtëpisë"
                    maxLength={40}
                    autoFocus
                  />
                  <Button type="submit" className="btn-primary">
                    <Save size={16} className="me-1" /> Ruaj
                  </Button>
                  <Button variant="secondary" onClick={() => setEmriRi(null)}>
                    Anulo
                  </Button>
                </InputGroup>
                <Form.Text muted>
                  Emri ruhet vetëm në këtë shfletues dhe udhëton bashkë me çdo rresht që dërgon
                  kjo pajisje, që ta njihni te lista dhe te gjurma më poshtë.
                </Form.Text>
              </Form>
            )}

            {pajisjet === null ? (
              <div className="fcp-row-sub">Po lexohen pajisjet...</div>
            ) : pajisjet.length === 0 ? (
              <div className="fcp-row-sub">
                Asnjë pajisje nuk është shënuar ende te projekti. Shënimi shtohet në
                sinkronizimin e radhës.
              </div>
            ) : (
              <div className="d-flex flex-column gap-2">
                {pajisjet.map((p) => (
                  <div
                    key={p.id}
                    className="d-flex align-items-center justify-content-between gap-2 p-2 border border-secondary rounded-3"
                  >
                    <div className="d-flex align-items-center gap-2">
                      <Laptop size={16} className={p.kjo ? "text-primary" : "text-muted"} />
                      <div>
                        <div className="fw-bold">
                          {p.emri}
                          {p.kjo && <span className="fcp-row-sub ms-2">(kjo pajisje)</span>}
                        </div>
                        <div className="fcp-row-sub">
                          Sinkronizoi {saMePare(p.sinkFundit)} · mban {p.rreshta} rekorde · dërgoi{" "}
                          {p.derguar} herën e fundit
                        </div>
                      </div>
                    </div>
                    {!p.kjo && (
                      <Button
                        variant="link"
                        size="sm"
                        className="text-muted p-1"
                        title="Hiq nga lista"
                        onClick={() => handleHarroPajisjen(p)}
                        disabled={Boolean(pune)}
                      >
                        <X size={16} />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              className="btn btn-link p-0 mt-3 text-decoration-none fcp-row-sub align-self-start"
              onClick={() => setGjurmaHapur((e) => !e)}
            >
              <ScrollText size={14} className="me-1" />
              {gjurmaHapur ? "Fshih ndryshimet e fundit" : "Shiko ndryshimet e fundit te projekti"}
            </button>

            {gjurmaHapur && (
              <div className="mt-2">
                {ndryshimet === null ? (
                  <div className="fcp-row-sub">Po lexohet...</div>
                ) : ndryshimet.length === 0 ? (
                  <div className="fcp-row-sub">Projekti nuk ka ende asnjë rresht.</div>
                ) : (
                  <ul className="list-unstyled mb-0 small">
                    {ndryshimet.map((n) => (
                      <li key={`${n.store}:${n.id}:${n.kur}`} className="fcp-row-sub py-1">
                        {saMePare(n.kur)} · {n.fshire ? "u fshi" : "u shkrua"} {emriStorit(n.store)}{" "}
                        ·{" "}
                        {n.pajisja ? (
                          <strong>{n.pajisja}{n.kjo ? " (kjo pajisje)" : ""}</strong>
                        ) : (
                          <em>pa gjurmë pajisjeje</em>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {konfigurimi.pajisjeKolona === false && (
                  <Alert variant="warning" className="py-2 px-3 small mt-2 mb-0">
                    Projekti juaj ende nuk i mban kolonat që tregojnë pajisjen. Shtypni{" "}
                    <strong>Konfiguro projektin</strong> më lart dhe ekzekutoni skriptin - nga ai
                    çast çdo rresht i ri e mban emrin e pajisjes që e dërgoi.
                  </Alert>
                )}
              </div>
            )}
          </Card>

          <Card className="profile-card fcp-zona-rrezik border-0 p-4 mb-4">
            <h2 className="fcp-card-title fw-bold mb-2">
              <AlertTriangle size={18} className="me-2 fcp-neg" />
              Kopja në cloud
            </h2>
            <p className="text-muted small mb-3">
              Zbraz tabelën te projekti juaj. Përdoreni nëse doni të nisni sinkronizimin nga e
              para ose të hiqni gjithçka nga Supabase; ledgeri në këtë shfletues nuk preket dhe
              sinkronizimi i radhës e ringarkon nga këtu.
            </p>
            <div>
              <Button variant="danger" onClick={handleFshiCloud} disabled={pune === "fshij"}>
                {pune === "fshij" ? (
                  <Spinner animation="border" size="sm" className="me-2" />
                ) : (
                  <Trash2 size={16} className="me-1" />
                )}
                Fshi kopjen në cloud
              </Button>
            </div>
          </Card>
        </>
      )}

      <Card className="profile-card border-0 p-4 mb-4">
        <h2 className="fcp-card-title fw-bold mb-3">
          <ShieldCheck size={18} className="me-2 text-primary" />
          Sa e sigurt është
        </h2>
        <ul className="text-muted small ps-3 mb-0" style={{ lineHeight: 1.9 }}>
          <li>
            <strong>Çelësi publik nuk është fjalëkalim.</strong> Ai është publik nga natyra - çdo
            aplikacion Supabase e dërgon te shfletuesi, dhe vetë Supabase-i shkruan se mund të
            ndahet lirisht. Ajo që mbron të dhënat është rregulli RLS i skriptit: pa hyrë me email
            dhe fjalëkalim, çelësi nuk lexon dot asnjë rresht.
          </li>
          <li>
            <strong>Çelësat secret / service_role mos i vendosni kurrë këtu.</strong> Ata i
            anashkalojnë rregullat. Aplikacioni i refuzon vetë nëse ngjiten gabimisht.
          </li>
          <li>
            <strong>Kredencialet ruhen në këtë pajisje</strong> (localStorage), bashkë me sesionin.
            Nuk janë më të ndjeshme se vetë ledgeri, që tashmë ndodhet i plotë në këtë shfletues:
            kush hyn në pajisjen tuaj i sheh transaksionet ashtu ose ashtu. Në një kompjuter të
            përbashkët përdorni <strong>Shkëput këtë pajisje</strong> kur mbaroni.
          </li>
          <li>
            <strong>Të dhënat shkojnë vetëm te projekti juaj</strong>, i vendosur në rajonin që
            zgjidhni ju, dhe udhëtojnë përmes HTTPS. FinanCarePersonal mbetet pa server.
          </li>
          <li>
            <strong>Fotot e faturave nuk sinkronizohen.</strong> Ato janë pjesa më e madhe e
            hapësirës dhe kërkojnë Supabase Storage; për t&apos;i çuar në një pajisje tjetër
            përdorni kopjen ZIP te faqja <strong>Eksporto / Importo</strong>.
          </li>
          <li>
            <strong>Fiton ndryshimi më i fundit.</strong> Nëse i njëjti transaksion redaktohet në
            dy pajisje pa qenë online në mes, mbetet versioni i ruajtur më vonë. Rreshtat e
            ndryshëm nuk përplasen kurrë.
          </li>
          <li>
            <strong>Një pajisje e re nuk dërgon asgjë pa e pyetur ju.</strong> Sapo lidhet, ajo
            vetëm lexon dhe ju tregon sa rreshta ka secila anë; deri sa të zgjidhni, kopja në
            cloud nuk preket. Listat e parazgjedhura (llogaritë dhe kategoritë që krijohen vetë)
            humbasin gjithmonë ndaj asaj që ka cloud-i, sepse kanë të njëjtat id në çdo pajisje.
          </li>
          <li>
            <strong>Çdo rresht mban emrin e pajisjes që e dërgoi.</strong> Me një email të vetëm
            në të gjitha pajisjet, kjo është e vetmja mënyrë për të parë se cila prej tyre e bëri
            një ndryshim - shihni listën te <strong>Pajisjet tuaja</strong> më lart.
          </li>
        </ul>
      </Card>
    </>
  );
}

export default PanelaSinkronizimit;
