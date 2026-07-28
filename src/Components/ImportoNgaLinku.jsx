import { useEffect, useRef } from "react";
import { useData } from "../Context/DataContext";
import { useDialog } from "../Context/DialogContext";
import { importAllData } from "../lib/db";
import { decodeTransferLink } from "../lib/transferQr";

/**
 * Opens a transfer that arrived as a link — the QR another device showed, scanned with the phone's
 * own camera app rather than one built into this page.
 *
 * The payload rides in the fragment, which never reaches a server, and it is cleared from the
 * address bar as soon as it has been read so the data does not sit in history. Nothing is written
 * before the user has seen what is in it and said yes.
 */
function ImportoNgaLinku() {
  const { reload } = useData();
  const dialog = useDialog();
  const lexuar = useRef(false);

  useEffect(() => {
    if (lexuar.current || !window.location.hash.includes("#fcp=")) return;
    lexuar.current = true;

    (async () => {
      try {
        const data = await decodeTransferLink();
        // Read once, then dropped from the address bar and from history.
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
        if (!data) return;

        const ok = await dialog.confirm(
          `Ky link mban një kopje të plotë: ${data.transactions?.length ?? 0} transaksione, ${
            data.accounts?.length ?? 0
          } llogari dhe ${data.categories?.length ?? 0} kategori. Hapja e tij zëvendëson gjithçka që keni në këtë pajisje. Vazhdo?`,
          { title: "Transfer nga një pajisje tjetër", confirmLabel: "Zëvendëso të dhënat" }
        );
        if (!ok) return;

        await importAllData(data);
        await reload();
        await dialog.alert("Të dhënat u transferuan me sukses.", { title: "Gati", variant: "success" });
      } catch (err) {
        await dialog.alert(`Linku nuk u lexua dot: ${err.message}`, { title: "Transferi dështoi", variant: "danger" });
      }
    })();
  }, [dialog, reload]);

  return null;
}

export default ImportoNgaLinku;
