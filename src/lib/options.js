/**
 * Static option lists and the defaults seeded into IndexedDB the first time a browser opens
 * FinanCarePersonal. Everything here is a starting point only — once seeded, the user owns the
 * list and can rename, recolor, add to or delete every row (same pattern FinanCareLite uses for
 * its TVSH types / units).
 */

export const CURRENCIES = [
  { code: "EUR", symbol: "€", label: "Euro (EUR)" },
  { code: "ALL", symbol: "L", label: "Lek Shqiptar (ALL)" },
  { code: "USD", symbol: "$", label: "Dollar Amerikan (USD)" },
  { code: "CHF", symbol: "CHF", label: "Frank Zviceran (CHF)" },
  { code: "GBP", symbol: "£", label: "Paund Britanik (GBP)" },
  { code: "MKD", symbol: "ден", label: "Denar Makedon (MKD)" },
  { code: "RSD", symbol: "дин", label: "Dinar Serb (RSD)" },
  { code: "SEK", symbol: "kr", label: "Krona Suedeze (SEK)" },
  { code: "NOK", symbol: "kr", label: "Krona Norvegjeze (NOK)" },
  { code: "TRY", symbol: "₺", label: "Lira Turke (TRY)" },
];

export const DEFAULT_CURRENCY = "EUR";

/** Account kinds. `negativeIsNormal` marks accounts where a negative balance is expected
 * (credit cards / loans), so the UI shows the debt in red without treating it as an error.
 * `kryesore` is the all-in-one account used by single-account mode (Cilësimet → Llogaritë): cash,
 * bank and everything else are kept together in it instead of being split per account. */
export const ACCOUNT_TYPES = [
  { value: "kryesore", label: "Llogari Kryesore (të gjitha bashkë)", short: "Kryesore", icon: "Wallet", negativeIsNormal: false },
  { value: "kesh", label: "Kesh (Para në dorë)", short: "Kesh", icon: "Banknote", negativeIsNormal: false },
  { value: "bank", label: "Llogari Bankare", short: "Bankë", icon: "Landmark", negativeIsNormal: false },
  { value: "karte", label: "Kartelë Krediti", short: "Kartelë", icon: "CreditCard", negativeIsNormal: true },
  { value: "kursim", label: "Kursim", short: "Kursim", icon: "PiggyBank", negativeIsNormal: false },
  { value: "investim", label: "Investim", short: "Investim", icon: "TrendingUp", negativeIsNormal: false },
  { value: "kredi", label: "Kredi / Borxh", short: "Kredi", icon: "Receipt", negativeIsNormal: true },
];

/** Never returns undefined, so a record holding a type that was removed still renders. */
export function accountTypeMeta(value) {
  return (
    ACCOUNT_TYPES.find((t) => t.value === value) || {
      value,
      label: value,
      short: value,
      icon: "Wallet",
      negativeIsNormal: false,
    }
  );
}

/**
 * Kinds of debt note. A debt is *not* an account: it lives in its own store and never reaches
 * `accountBalance`/`totalBalance`, so a card you still owe on cannot drag the real balance
 * negative. `drejtimi` says which way it points — `detyrim` is money you owe, `kerkese` is money
 * someone owes you — which is all that changes in the wording ("paguar" vs "kthyer").
 */
export const DEBT_TYPES = [
  { value: "karte", label: "Kartelë Krediti", short: "Kartelë", icon: "CreditCard", drejtimi: "detyrim" },
  { value: "kredi", label: "Kredi Bankare", short: "Kredi", icon: "Landmark", drejtimi: "detyrim" },
  { value: "keste", label: "Blerje me Këste", short: "Këste", icon: "Receipt", drejtimi: "detyrim" },
  { value: "borxh", label: "Borxh Personal (i kam borxh dikujt)", short: "Borxh", icon: "Coins", drejtimi: "detyrim" },
  { value: "huadhene", label: "Hua e Dhënë (dikush më ka borxh)", short: "Hua e dhënë", icon: "Banknote", drejtimi: "kerkese" },
];

/** Never returns undefined, so a note holding a type that was removed still renders. */
export function debtTypeMeta(value) {
  return (
    DEBT_TYPES.find((t) => t.value === value) || {
      value,
      label: value,
      short: value,
      icon: "Receipt",
      drejtimi: "detyrim",
    }
  );
}

/** A line on a debt note: `pagese` brings the balance down, `shtese` puts it back up (a new
 * purchase on the card, interest, a late fee). */
export const DEBT_ENTRY_TYPES = [
  { value: "pagese", label: "Pagesë", sign: -1 },
  { value: "shtese", label: "Shtesë / Blerje e re", sign: 1 },
];

/**
 * How urgent a planned purchase is. The priority only sorts the list and colours the badge — every
 * unfinished plan is set aside from the daily allowance all the same, because an "opsionale" plan
 * you still intend to buy takes the same money out of the month as any other.
 */
export const PLAN_PRIORITIES = [
  { value: "domosdoshme", label: "E domosdoshme", short: "Domosdoshme", ngjyra: "#f43f5e", rendi: 0 },
  { value: "normale", label: "Normale", short: "Normale", ngjyra: "#06b6d4", rendi: 1 },
  { value: "opsionale", label: "Opsionale", short: "Opsionale", ngjyra: "#94a3b8", rendi: 2 },
];

/** Never returns undefined, so a plan holding a priority that was removed still renders. */
export function planPriorityMeta(value) {
  return (
    PLAN_PRIORITIES.find((p) => p.value === value) || {
      value,
      label: value || "Normale",
      short: value || "Normale",
      ngjyra: "#06b6d4",
      rendi: 1,
    }
  );
}

export const TRANSACTION_TYPES = [
  { value: "hyrje", label: "Hyrje", sign: 1 },
  { value: "shpenzim", label: "Shpenzim", sign: -1 },
  { value: "transfer", label: "Transfer", sign: 0 },
];

export const TRANSACTION_TYPE_LABELS = {
  hyrje: "Hyrje",
  shpenzim: "Shpenzim",
  transfer: "Transfer",
};

/** Recurrence steps used by `nextOccurrence()` in finance.js. */
export const FREQUENCIES = [
  { value: "ditore", label: "Ditore", unit: "day", step: 1 },
  { value: "javore", label: "Javore", unit: "week", step: 1 },
  { value: "dyjavore", label: "Dy-javore", unit: "week", step: 2 },
  { value: "mujore", label: "Mujore", unit: "month", step: 1 },
  { value: "tremujore", label: "Tremujore", unit: "month", step: 3 },
  { value: "gjashtemujore", label: "Gjashtëmujore", unit: "month", step: 6 },
  { value: "vjetore", label: "Vjetore", unit: "year", step: 1 },
];

/** The periods a statement can cover. `periodBounds()` in finance.js turns each into real dates. */
export const STATEMENT_PERIODS = [
  { value: "muaji", label: "Ky muaj" },
  { value: "kaluar", label: "Muaji i kaluar" },
  { value: "viti", label: "Ky vit" },
  { value: "gjithcka", label: "Gjithë historiku" },
];

export const CATEGORY_COLORS = [
  "#10b981", "#06b6d4", "#8b5cf6", "#f59e0b", "#f43f5e",
  "#ec4899", "#84cc16", "#3b82f6", "#14b8a6", "#a855f7",
  "#ef4444", "#eab308", "#22c55e", "#0ea5e9", "#f97316",
];

/** Icon names must exist in `ICONS` (src/lib/icons.js), which is what renders them. */
export const CATEGORY_ICONS = [
  "Utensils", "Coffee", "ShoppingCart", "Home", "Zap", "Smartphone", "Car", "Fuel",
  "Bus", "HeartPulse", "Pill", "Film", "Music", "Shirt", "GraduationCap", "BookOpen",
  "Plane", "Dumbbell", "Gift", "PawPrint", "Baby", "Scissors", "Wrench", "CreditCard",
  "Briefcase", "Coins", "Laptop", "TrendingUp", "Landmark", "Banknote", "PiggyBank",
  "Sparkles", "Receipt", "MoreHorizontal",
];

export const DEFAULT_CATEGORIES = [
  // ── Shpenzimet ───────────────────────────────────────────────
  { id: "cat_default_ushqim", emri: "Ushqim & Pije", lloji: "shpenzim", ngjyra: "#f59e0b", ikona: "Utensils" },
  { id: "cat_default_restorant", emri: "Kafe & Restorant", lloji: "shpenzim", ngjyra: "#f97316", ikona: "Coffee" },
  { id: "cat_default_shtepi", emri: "Blerje Shtëpiake", lloji: "shpenzim", ngjyra: "#84cc16", ikona: "ShoppingCart" },
  { id: "cat_default_qira", emri: "Qira / Banesa", lloji: "shpenzim", ngjyra: "#8b5cf6", ikona: "Home" },
  { id: "cat_default_fatura", emri: "Fatura & Shërbime", lloji: "shpenzim", ngjyra: "#06b6d4", ikona: "Zap" },
  { id: "cat_default_telefon", emri: "Telefon & Internet", lloji: "shpenzim", ngjyra: "#0ea5e9", ikona: "Smartphone" },
  { id: "cat_default_transport", emri: "Transport", lloji: "shpenzim", ngjyra: "#3b82f6", ikona: "Car" },
  { id: "cat_default_karburant", emri: "Karburant", lloji: "shpenzim", ngjyra: "#eab308", ikona: "Fuel" },
  { id: "cat_default_shendetesi", emri: "Shëndetësi", lloji: "shpenzim", ngjyra: "#f43f5e", ikona: "HeartPulse" },
  { id: "cat_default_argetim", emri: "Argëtim", lloji: "shpenzim", ngjyra: "#ec4899", ikona: "Film" },
  { id: "cat_default_veshje", emri: "Veshje", lloji: "shpenzim", ngjyra: "#a855f7", ikona: "Shirt" },
  { id: "cat_default_edukim", emri: "Edukim", lloji: "shpenzim", ngjyra: "#14b8a6", ikona: "GraduationCap" },
  { id: "cat_default_udhetime", emri: "Udhëtime", lloji: "shpenzim", ngjyra: "#22c55e", ikona: "Plane" },
  { id: "cat_default_sport", emri: "Sport & Fitnes", lloji: "shpenzim", ngjyra: "#10b981", ikona: "Dumbbell" },
  { id: "cat_default_dhurata", emri: "Dhurata", lloji: "shpenzim", ngjyra: "#ef4444", ikona: "Gift" },
  { id: "cat_default_kredi", emri: "Kredi & Kamata", lloji: "shpenzim", ngjyra: "#64748b", ikona: "CreditCard" },
  { id: "cat_default_keste", emri: "Këste të Kartelës (Bonus)", lloji: "shpenzim", ngjyra: "#3b82f6", ikona: "Receipt" },
  { id: "cat_default_tjera_shp", emri: "Shpenzime të Tjera", lloji: "shpenzim", ngjyra: "#94a3b8", ikona: "MoreHorizontal" },

  // ── Hyrjet ──────────────────────────────────────────────────
  { id: "cat_default_rroga", emri: "Rroga", lloji: "hyrje", ngjyra: "#10b981", ikona: "Briefcase" },
  { id: "cat_default_bonus", emri: "Bonus & Shpërblime", lloji: "hyrje", ngjyra: "#22c55e", ikona: "Coins" },
  { id: "cat_default_freelance", emri: "Punë e Lirë (Freelance)", lloji: "hyrje", ngjyra: "#06b6d4", ikona: "Laptop" },
  { id: "cat_default_investime", emri: "Investime & Dividendë", lloji: "hyrje", ngjyra: "#8b5cf6", ikona: "TrendingUp" },
  { id: "cat_default_qira_marre", emri: "Qira e Marrë", lloji: "hyrje", ngjyra: "#f59e0b", ikona: "Landmark" },
  { id: "cat_default_dhurata_hyrje", emri: "Dhurata të Marra", lloji: "hyrje", ngjyra: "#ec4899", ikona: "Gift" },
  { id: "cat_default_tjera_hyrje", emri: "Hyrje të Tjera", lloji: "hyrje", ngjyra: "#94a3b8", ikona: "MoreHorizontal" },
];

export const DEFAULT_ACCOUNTS = [
  { id: "acc_default_kesh", emri: "Kesh", lloji: "kesh", bilanciFillestar: 0, ngjyra: "#10b981", shenim: "", arkivuar: false },
  { id: "acc_default_bank", emri: "Llogaria Bankare", lloji: "bank", bilanciFillestar: 0, ngjyra: "#06b6d4", shenim: "", arkivuar: false },
];

/** The account single-account mode creates when the database has none left to merge into. */
export const MAIN_ACCOUNT_DEFAULT = {
  emri: "Llogaria Kryesore",
  lloji: "kryesore",
  bilanciFillestar: 0,
  ngjyra: "#10b981",
  shenim: "",
  arkivuar: false,
};

export const MONTHS_SHORT = ["Jan", "Shk", "Mar", "Pri", "Maj", "Qer", "Kor", "Gus", "Sht", "Tet", "Nën", "Dhj"];

export const MONTHS_LONG = [
  "Janar", "Shkurt", "Mars", "Prill", "Maj", "Qershor",
  "Korrik", "Gusht", "Shtator", "Tetor", "Nëntor", "Dhjetor",
];

/** Genitive forms, for phrases like "Pasqyra e korrikut 2026". */
export const MONTHS_GENITIVE = [
  "janarit", "shkurtit", "marsit", "prillit", "majit", "qershorit",
  "korrikut", "gushtit", "shtatorit", "tetorit", "nëntorit", "dhjetorit",
];

export const DAYS_LONG = ["e diel", "e hënë", "e martë", "e mërkurë", "e enjte", "e premte", "e shtunë"];
