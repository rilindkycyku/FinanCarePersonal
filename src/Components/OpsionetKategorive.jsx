import { useMemo } from "react";
import { pemaKategorive } from "../lib/kategorite";

/**
 * The `<option>`s of every category picker in the app, in one place: top-level categories on their
 * own, and a category that has subcategories as an `<optgroup>` holding itself plus its children.
 *
 * Rendered as options rather than as a whole `<Form.Select>` on purpose - each form keeps its own
 * value, validation, size and hint text exactly as it had them, and the only thing that changes at
 * the call site is what goes between the tags.
 *
 * `<optgroup>` is doing real work here rather than decorating the list: on a phone the browser's
 * own picker (the full-screen list this app is mostly used through) turns the label into a heading,
 * so "Kafe" and "Drekë në Punë" arrive under "Kafe & Restorant" instead of scattered through one
 * alphabetical run of fifty names. The parent stays selectable inside its own group, because
 * "somewhere in food, I am not going to say where" is a real answer and forcing a subcategory would
 * only produce badly filed transactions.
 */
function OpsionetKategorive({ categories, lloji }) {
  const pema = useMemo(() => pemaKategorive(categories, lloji), [categories, lloji]);

  return pema.map((k) =>
    k.femijet.length === 0 ? (
      <option key={k.id} value={k.id}>
        {k.emri}
      </option>
    ) : (
      <optgroup key={k.id} label={k.emri}>
        <option value={k.id}>{k.emri} (në përgjithësi)</option>
        {k.femijet.map((f) => (
          <option key={f.id} value={f.id}>
            {f.emri}
          </option>
        ))}
      </optgroup>
    )
  );
}

export default OpsionetKategorive;
