/**
 * Static option lists and the defaults seeded into IndexedDB the first time a browser opens
 * FinanCarePersonal. Everything here is a starting point only - once seeded, the user owns the
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
 * negative. `drejtimi` says which way it points - `detyrim` is money you owe, `kerkese` is money
 * someone owes you - which is all that changes in the wording ("paguar" vs "kthyer").
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
 * How urgent a planned purchase is. The priority only sorts the list and colours the badge - every
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
  "Sparkles", "Shield", "Receipt", "Scale", "MoreHorizontal",
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
  // Added after the first release: everyday baskets the original list sent to "Shpenzime të Tjera",
  // where they stopped saying anything. A drogeri run (DM, Bipa) is the clearest case - it is not
  // food and not a household purchase, and it happens every other week.
  { id: "cat_default_higjiene", emri: "Higjienë & Kozmetikë", lloji: "shpenzim", ngjyra: "#ec4899", ikona: "Sparkles" },
  { id: "cat_default_barna", emri: "Barna & Farmaci", lloji: "shpenzim", ngjyra: "#14b8a6", ikona: "Pill" },
  { id: "cat_default_femijet", emri: "Fëmijët", lloji: "shpenzim", ngjyra: "#f97316", ikona: "Baby" },
  { id: "cat_default_kafshet", emri: "Kafshët Shtëpiake", lloji: "shpenzim", ngjyra: "#84cc16", ikona: "PawPrint" },
  { id: "cat_default_abonime", emri: "Abonime & Aplikacione", lloji: "shpenzim", ngjyra: "#8b5cf6", ikona: "Music" },
  { id: "cat_default_bukuri", emri: "Bukuri & Parukeri", lloji: "shpenzim", ngjyra: "#a855f7", ikona: "Scissors" },
  { id: "cat_default_riparime", emri: "Riparime & Mirëmbajtje", lloji: "shpenzim", ngjyra: "#eab308", ikona: "Wrench" },
  { id: "cat_default_teknologji", emri: "Teknologji & Pajisje", lloji: "shpenzim", ngjyra: "#3b82f6", ikona: "Laptop" },
  { id: "cat_default_sigurime", emri: "Sigurime", lloji: "shpenzim", ngjyra: "#0ea5e9", ikona: "Shield" },
  { id: "cat_default_taksa", emri: "Taksa & Tatime", lloji: "shpenzim", ngjyra: "#64748b", ikona: "Landmark" },
  // Kept last: it is the bucket for whatever the list above still does not name.
  { id: "cat_default_tjera_shp", emri: "Shpenzime të Tjera", lloji: "shpenzim", ngjyra: "#94a3b8", ikona: "MoreHorizontal" },
  // Nuk është shpenzim i vërtetë, është rrëfim: në fund të muajit bilanci i aplikacionit nuk përputhet
  // me atë të llogarisë, sepse diçka mbeti pa u shënuar dhe tani nuk dihet çka ishte. Pa këtë rresht
  // diferenca ose shkon te «Shpenzime të Tjera» - ku gënjen statistikën, sepse duket kategori e
  // përdorur - ose nuk shënohet fare dhe gabimi bartet muaj pas muaji. Ka të njëjtin emër, ngjyrë e
  // ikonë edhe te hyrjet, që të lexohet si një gjë e vetme edhe pse modeli kërkon dy rreshta: një
  // kategori mban një `lloji` të vetëm.
  { id: "cat_default_barazim_shp", emri: "Barazim i Bilancit", lloji: "shpenzim", ngjyra: "#64748b", ikona: "Scale" },

  // ── Nënkategoritë e parazgjedhura ───────────────────────────────────────────
  // Only the baskets that were doing too much work on their own: "Ushqim & Pije" alone answered for
  // the weekly market run, the lunch bought at work and a delivery on Saturday, so at the end of the
  // month the biggest line in the statistics was the one that said the least. Each one keeps its
  // parent's colour, so the group still reads as one block on the charts, and the parent stays
  // usable as it was for anyone who does not want the detail.
  //
  // A category is left without children where the split would answer nothing: "Karburant" is one
  // kind of purchase however it is written, "Këste të Kartelës" is already the detail of a card,
  // and "Shpenzime të Tjera" is the bucket for what the list does not name - subdividing it would
  // only give the leftovers a filing system.
  //
  // Everything below is a starting point like the rest of this file: rename, recolour, re-file or
  // delete freely, and nothing brings a deleted one back.

  // Ushqim & Pije - what came home from a shop.
  { id: "cat_default_ushqim_market", emri: "Market & Supermarket", lloji: "shpenzim", prindi: "cat_default_ushqim", ngjyra: "#f59e0b", ikona: "ShoppingCart" },
  { id: "cat_default_ushqim_furra", emri: "Furra & Ëmbëltore", lloji: "shpenzim", prindi: "cat_default_ushqim", ngjyra: "#f59e0b", ikona: "Utensils" },
  { id: "cat_default_ushqim_mish", emri: "Mish & Peshk", lloji: "shpenzim", prindi: "cat_default_ushqim", ngjyra: "#f59e0b", ikona: "Utensils" },
  { id: "cat_default_ushqim_fruta", emri: "Fruta & Perime", lloji: "shpenzim", prindi: "cat_default_ushqim", ngjyra: "#f59e0b", ikona: "ShoppingCart" },
  { id: "cat_default_ushqim_pije", emri: "Pije & Ujë", lloji: "shpenzim", prindi: "cat_default_ushqim", ngjyra: "#f59e0b", ikona: "Coffee" },

  // Kafe & Restorant - what was eaten or drunk out.
  { id: "cat_default_restorant_kafe", emri: "Kafe", lloji: "shpenzim", prindi: "cat_default_restorant", ngjyra: "#f97316", ikona: "Coffee" },
  { id: "cat_default_restorant_dreka", emri: "Drekë në Punë", lloji: "shpenzim", prindi: "cat_default_restorant", ngjyra: "#f97316", ikona: "Briefcase" },
  { id: "cat_default_restorant_ushqim", emri: "Restorant", lloji: "shpenzim", prindi: "cat_default_restorant", ngjyra: "#f97316", ikona: "Utensils" },
  { id: "cat_default_restorant_fast", emri: "Fast Food & Porosi Online", lloji: "shpenzim", prindi: "cat_default_restorant", ngjyra: "#f97316", ikona: "Smartphone" },
  { id: "cat_default_restorant_dalje", emri: "Dalje & Bar", lloji: "shpenzim", prindi: "cat_default_restorant", ngjyra: "#f97316", ikona: "Music" },

  // Transport - fuel keeps its own category, so what is left here is everything else.
  { id: "cat_default_transport_publik", emri: "Transport Publik", lloji: "shpenzim", prindi: "cat_default_transport", ngjyra: "#3b82f6", ikona: "Bus" },
  { id: "cat_default_transport_taksi", emri: "Taksi", lloji: "shpenzim", prindi: "cat_default_transport", ngjyra: "#3b82f6", ikona: "Car" },
  { id: "cat_default_transport_parkim", emri: "Parkim & Rrugë", lloji: "shpenzim", prindi: "cat_default_transport", ngjyra: "#3b82f6", ikona: "Car" },
  { id: "cat_default_transport_servis", emri: "Servis & Gomat", lloji: "shpenzim", prindi: "cat_default_transport", ngjyra: "#3b82f6", ikona: "Wrench" },

  // Fatura & Shërbime - one line per household bill, because they rise separately.
  { id: "cat_default_fatura_rryme", emri: "Rrymë", lloji: "shpenzim", prindi: "cat_default_fatura", ngjyra: "#06b6d4", ikona: "Zap" },
  { id: "cat_default_fatura_uje", emri: "Ujë", lloji: "shpenzim", prindi: "cat_default_fatura", ngjyra: "#06b6d4", ikona: "Zap" },
  { id: "cat_default_fatura_ngrohje", emri: "Ngrohje", lloji: "shpenzim", prindi: "cat_default_fatura", ngjyra: "#06b6d4", ikona: "Zap" },
  { id: "cat_default_fatura_mbeturina", emri: "Mbeturina & Komunale", lloji: "shpenzim", prindi: "cat_default_fatura", ngjyra: "#06b6d4", ikona: "Receipt" },

  // Blerje Shtëpiake.
  { id: "cat_default_shtepi_pastrim", emri: "Pastrim & Detergjentë", lloji: "shpenzim", prindi: "cat_default_shtepi", ngjyra: "#84cc16", ikona: "Sparkles" },
  { id: "cat_default_shtepi_ene", emri: "Enë & Vegla", lloji: "shpenzim", prindi: "cat_default_shtepi", ngjyra: "#84cc16", ikona: "Wrench" },
  { id: "cat_default_shtepi_mobilje", emri: "Mobilje & Dekor", lloji: "shpenzim", prindi: "cat_default_shtepi", ngjyra: "#84cc16", ikona: "Home" },

  // Shëndetësi.
  { id: "cat_default_shendet_vizita", emri: "Vizita & Analiza", lloji: "shpenzim", prindi: "cat_default_shendetesi", ngjyra: "#f43f5e", ikona: "HeartPulse" },
  { id: "cat_default_shendet_dentist", emri: "Dentist", lloji: "shpenzim", prindi: "cat_default_shendetesi", ngjyra: "#f43f5e", ikona: "HeartPulse" },
  { id: "cat_default_shendet_optike", emri: "Syze & Optikë", lloji: "shpenzim", prindi: "cat_default_shendetesi", ngjyra: "#f43f5e", ikona: "HeartPulse" },

  // Veshje.
  { id: "cat_default_veshje_rroba", emri: "Rroba", lloji: "shpenzim", prindi: "cat_default_veshje", ngjyra: "#a855f7", ikona: "Shirt" },
  { id: "cat_default_veshje_kepuce", emri: "Këpucë", lloji: "shpenzim", prindi: "cat_default_veshje", ngjyra: "#a855f7", ikona: "Shirt" },
  { id: "cat_default_veshje_aksesore", emri: "Aksesorë", lloji: "shpenzim", prindi: "cat_default_veshje", ngjyra: "#a855f7", ikona: "Gift" },

  // Argëtim.
  { id: "cat_default_argetim_kinema", emri: "Kinema & Teatër", lloji: "shpenzim", prindi: "cat_default_argetim", ngjyra: "#ec4899", ikona: "Film" },
  { id: "cat_default_argetim_ngjarje", emri: "Koncerte & Ngjarje", lloji: "shpenzim", prindi: "cat_default_argetim", ngjyra: "#ec4899", ikona: "Music" },
  { id: "cat_default_argetim_lojera", emri: "Lojëra & Hobi", lloji: "shpenzim", prindi: "cat_default_argetim", ngjyra: "#ec4899", ikona: "Laptop" },

  // Qira / Banesa - the monthly rent is one line, but what a flat costs is not only the rent: the
  // building's own bill arrives separately, and moving costs land in a single month.
  { id: "cat_default_qira_mujore", emri: "Qira Mujore", lloji: "shpenzim", prindi: "cat_default_qira", ngjyra: "#8b5cf6", ikona: "Home" },
  { id: "cat_default_qira_pallati", emri: "Shpenzimet e Pallatit", lloji: "shpenzim", prindi: "cat_default_qira", ngjyra: "#8b5cf6", ikona: "Landmark" },
  { id: "cat_default_qira_zhvendosje", emri: "Zhvendosje & Depozitë", lloji: "shpenzim", prindi: "cat_default_qira", ngjyra: "#8b5cf6", ikona: "Receipt" },

  // Telefon & Internet - usually three contracts with three different renewal dates.
  { id: "cat_default_telefon_mobil", emri: "Telefoni Mobil", lloji: "shpenzim", prindi: "cat_default_telefon", ngjyra: "#0ea5e9", ikona: "Smartphone" },
  { id: "cat_default_telefon_internet", emri: "Internet Shtëpiak", lloji: "shpenzim", prindi: "cat_default_telefon", ngjyra: "#0ea5e9", ikona: "Laptop" },
  { id: "cat_default_telefon_tv", emri: "TV Kabllor", lloji: "shpenzim", prindi: "cat_default_telefon", ngjyra: "#0ea5e9", ikona: "Film" },

  // Edukim - a semester, a weekend course and a stack of books are not the same decision.
  { id: "cat_default_edukim_shkollim", emri: "Shkollim & Universitet", lloji: "shpenzim", prindi: "cat_default_edukim", ngjyra: "#14b8a6", ikona: "GraduationCap" },
  { id: "cat_default_edukim_kurse", emri: "Kurse & Trajnime", lloji: "shpenzim", prindi: "cat_default_edukim", ngjyra: "#14b8a6", ikona: "BookOpen" },
  { id: "cat_default_edukim_libra", emri: "Libra & Materiale", lloji: "shpenzim", prindi: "cat_default_edukim", ngjyra: "#14b8a6", ikona: "BookOpen" },

  // Udhëtime - one trip is booked in pieces, weeks apart, and the pieces are what gets compared
  // with the next trip.
  { id: "cat_default_udhetime_bileta", emri: "Bileta & Fluturime", lloji: "shpenzim", prindi: "cat_default_udhetime", ngjyra: "#22c55e", ikona: "Plane" },
  { id: "cat_default_udhetime_fjetje", emri: "Fjetje & Hotel", lloji: "shpenzim", prindi: "cat_default_udhetime", ngjyra: "#22c55e", ikona: "Home" },
  { id: "cat_default_udhetime_makine", emri: "Qira Makine & Transferë", lloji: "shpenzim", prindi: "cat_default_udhetime", ngjyra: "#22c55e", ikona: "Car" },
  { id: "cat_default_udhetime_vizita", emri: "Vizita & Aktivitete", lloji: "shpenzim", prindi: "cat_default_udhetime", ngjyra: "#22c55e", ikona: "Sparkles" },

  // Sport & Fitnes - the membership repeats every month, the shoes do not.
  { id: "cat_default_sport_palester", emri: "Palestër & Anëtarësi", lloji: "shpenzim", prindi: "cat_default_sport", ngjyra: "#10b981", ikona: "Dumbbell" },
  { id: "cat_default_sport_pajisje", emri: "Pajisje Sportive", lloji: "shpenzim", prindi: "cat_default_sport", ngjyra: "#10b981", ikona: "Shirt" },
  { id: "cat_default_sport_aktivitete", emri: "Aktivitete & Terrene", lloji: "shpenzim", prindi: "cat_default_sport", ngjyra: "#10b981", ikona: "Dumbbell" },

  // Dhurata - a wedding season and a birthday are different sizes of the same month.
  { id: "cat_default_dhurata_familje", emri: "Dhurata Familjare", lloji: "shpenzim", prindi: "cat_default_dhurata", ngjyra: "#ef4444", ikona: "Gift" },
  { id: "cat_default_dhurata_dasma", emri: "Dasma & Festa", lloji: "shpenzim", prindi: "cat_default_dhurata", ngjyra: "#ef4444", ikona: "Sparkles" },
  { id: "cat_default_dhurata_bamiresi", emri: "Bamirësi & Ndihmë", lloji: "shpenzim", prindi: "cat_default_dhurata", ngjyra: "#ef4444", ikona: "HeartPulse" },

  // Higjienë & Kozmetikë - the drugstore basket holds both the shampoo that runs out and the
  // perfume that does not.
  { id: "cat_default_higjiene_personale", emri: "Higjienë Personale", lloji: "shpenzim", prindi: "cat_default_higjiene", ngjyra: "#ec4899", ikona: "Sparkles" },
  { id: "cat_default_higjiene_kozmetike", emri: "Kozmetikë & Parfum", lloji: "shpenzim", prindi: "cat_default_higjiene", ngjyra: "#ec4899", ikona: "Gift" },

  // Barna & Farmaci.
  { id: "cat_default_barna_recete", emri: "Barna me Recetë", lloji: "shpenzim", prindi: "cat_default_barna", ngjyra: "#14b8a6", ikona: "Pill" },
  { id: "cat_default_barna_vitamina", emri: "Vitamina & Suplemente", lloji: "shpenzim", prindi: "cat_default_barna", ngjyra: "#14b8a6", ikona: "Pill" },
  { id: "cat_default_barna_materiale", emri: "Materiale Mjekësore", lloji: "shpenzim", prindi: "cat_default_barna", ngjyra: "#14b8a6", ikona: "HeartPulse" },

  // Fëmijët - the one category that otherwise swallows food, clothes and school in a single line.
  { id: "cat_default_femijet_shkolla", emri: "Kopsht & Shkollë", lloji: "shpenzim", prindi: "cat_default_femijet", ngjyra: "#f97316", ikona: "GraduationCap" },
  { id: "cat_default_femijet_veshje", emri: "Veshje & Këpucë", lloji: "shpenzim", prindi: "cat_default_femijet", ngjyra: "#f97316", ikona: "Shirt" },
  { id: "cat_default_femijet_lodra", emri: "Lodra & Aktivitete", lloji: "shpenzim", prindi: "cat_default_femijet", ngjyra: "#f97316", ikona: "Gift" },
  { id: "cat_default_femijet_pelena", emri: "Pelena & Ushqim për Bebe", lloji: "shpenzim", prindi: "cat_default_femijet", ngjyra: "#f97316", ikona: "Baby" },

  // Kafshët Shtëpiake - the food repeats, the vet does not.
  { id: "cat_default_kafshet_ushqim", emri: "Ushqim për Kafshë", lloji: "shpenzim", prindi: "cat_default_kafshet", ngjyra: "#84cc16", ikona: "PawPrint" },
  { id: "cat_default_kafshet_veteriner", emri: "Veteriner", lloji: "shpenzim", prindi: "cat_default_kafshet", ngjyra: "#84cc16", ikona: "HeartPulse" },
  { id: "cat_default_kafshet_aksesore", emri: "Aksesorë & Higjienë", lloji: "shpenzim", prindi: "cat_default_kafshet", ngjyra: "#84cc16", ikona: "Scissors" },

  // Abonime & Aplikacione - small amounts that only look small until they are counted apart.
  { id: "cat_default_abonime_streaming", emri: "Streaming & Video", lloji: "shpenzim", prindi: "cat_default_abonime", ngjyra: "#8b5cf6", ikona: "Film" },
  { id: "cat_default_abonime_muzike", emri: "Muzikë & Podkaste", lloji: "shpenzim", prindi: "cat_default_abonime", ngjyra: "#8b5cf6", ikona: "Music" },
  { id: "cat_default_abonime_softuer", emri: "Cloud & Softuer", lloji: "shpenzim", prindi: "cat_default_abonime", ngjyra: "#8b5cf6", ikona: "Laptop" },

  // Bukuri & Parukeri.
  { id: "cat_default_bukuri_parukeri", emri: "Parukeri & Berber", lloji: "shpenzim", prindi: "cat_default_bukuri", ngjyra: "#a855f7", ikona: "Scissors" },
  { id: "cat_default_bukuri_manikyr", emri: "Manikyr & Pedikyr", lloji: "shpenzim", prindi: "cat_default_bukuri", ngjyra: "#a855f7", ikona: "Sparkles" },
  { id: "cat_default_bukuri_trajtime", emri: "Trajtime Estetike", lloji: "shpenzim", prindi: "cat_default_bukuri", ngjyra: "#a855f7", ikona: "Sparkles" },

  // Riparime & Mirëmbajtje - the flat and the things inside it break on different schedules.
  { id: "cat_default_riparime_shtepi", emri: "Riparime në Shtëpi", lloji: "shpenzim", prindi: "cat_default_riparime", ngjyra: "#eab308", ikona: "Home" },
  { id: "cat_default_riparime_pajisje", emri: "Riparime Pajisjesh", lloji: "shpenzim", prindi: "cat_default_riparime", ngjyra: "#eab308", ikona: "Wrench" },

  // Teknologji & Pajisje.
  { id: "cat_default_teknologji_telefon", emri: "Telefon & Tablet", lloji: "shpenzim", prindi: "cat_default_teknologji", ngjyra: "#3b82f6", ikona: "Smartphone" },
  { id: "cat_default_teknologji_kompjuter", emri: "Kompjuter & Aksesorë", lloji: "shpenzim", prindi: "cat_default_teknologji", ngjyra: "#3b82f6", ikona: "Laptop" },
  { id: "cat_default_teknologji_shtepiake", emri: "Pajisje Shtëpiake", lloji: "shpenzim", prindi: "cat_default_teknologji", ngjyra: "#3b82f6", ikona: "Home" },

  // Sigurime - four policies that renew on four different dates and are compared one by one.
  { id: "cat_default_sigurime_shendet", emri: "Sigurim Shëndetësor", lloji: "shpenzim", prindi: "cat_default_sigurime", ngjyra: "#0ea5e9", ikona: "HeartPulse" },
  { id: "cat_default_sigurime_makine", emri: "Sigurim i Makinës", lloji: "shpenzim", prindi: "cat_default_sigurime", ngjyra: "#0ea5e9", ikona: "Car" },
  { id: "cat_default_sigurime_banese", emri: "Sigurim i Banesës", lloji: "shpenzim", prindi: "cat_default_sigurime", ngjyra: "#0ea5e9", ikona: "Home" },
  { id: "cat_default_sigurime_jete", emri: "Sigurim Jete", lloji: "shpenzim", prindi: "cat_default_sigurime", ngjyra: "#0ea5e9", ikona: "Shield" },

  // Taksa & Tatime.
  { id: "cat_default_taksa_tatim", emri: "Tatimi në të Ardhura", lloji: "shpenzim", prindi: "cat_default_taksa", ngjyra: "#64748b", ikona: "Landmark" },
  { id: "cat_default_taksa_komunale", emri: "Taksa Komunale", lloji: "shpenzim", prindi: "cat_default_taksa", ngjyra: "#64748b", ikona: "Home" },
  { id: "cat_default_taksa_tarifa", emri: "Tarifa Administrative", lloji: "shpenzim", prindi: "cat_default_taksa", ngjyra: "#64748b", ikona: "Receipt" },

  // Kredi & Kamata - the instalment is the plan, the interest and the fees are what it really cost.
  { id: "cat_default_kredi_kesti", emri: "Kësti i Kredisë", lloji: "shpenzim", prindi: "cat_default_kredi", ngjyra: "#64748b", ikona: "Landmark" },
  { id: "cat_default_kredi_kamata", emri: "Kamata & Tarifa Bankare", lloji: "shpenzim", prindi: "cat_default_kredi", ngjyra: "#64748b", ikona: "Receipt" },

  // ── Hyrjet ──────────────────────────────────────────────────
  { id: "cat_default_rroga", emri: "Rroga", lloji: "hyrje", ngjyra: "#10b981", ikona: "Briefcase" },
  { id: "cat_default_bonus", emri: "Bonus & Shpërblime", lloji: "hyrje", ngjyra: "#22c55e", ikona: "Coins" },
  { id: "cat_default_freelance", emri: "Punë e Lirë (Freelance)", lloji: "hyrje", ngjyra: "#06b6d4", ikona: "Laptop" },
  { id: "cat_default_investime", emri: "Investime & Dividendë", lloji: "hyrje", ngjyra: "#8b5cf6", ikona: "TrendingUp" },
  { id: "cat_default_qira_marre", emri: "Qira e Marrë", lloji: "hyrje", ngjyra: "#f59e0b", ikona: "Landmark" },
  { id: "cat_default_dhurata_hyrje", emri: "Dhurata të Marra", lloji: "hyrje", ngjyra: "#ec4899", ikona: "Gift" },
  // A refund booked as income is what keeps a returned purchase from looking like money spent, and
  // selling something second-hand is not a salary, a gift or an investment.
  { id: "cat_default_rimbursim", emri: "Rimbursim & Kthim Parash", lloji: "hyrje", ngjyra: "#14b8a6", ikona: "Receipt" },
  { id: "cat_default_shitje", emri: "Shitje (dorë e dytë)", lloji: "hyrje", ngjyra: "#06b6d4", ikona: "Banknote" },
  { id: "cat_default_tjera_hyrje", emri: "Hyrje të Tjera", lloji: "hyrje", ngjyra: "#94a3b8", ikona: "MoreHorizontal" },
  // Ana tjetër e barazimit - kur llogaria ka më shumë se sa thotë aplikacioni. Shih shënimin te
  // `cat_default_barazim_shp`.
  { id: "cat_default_barazim_hyrje", emri: "Barazim i Bilancit", lloji: "hyrje", ngjyra: "#64748b", ikona: "Scale" },

  // Investime & Dividendë - three sources that arrive at different times and behave differently;
  // counted as one line they say only "the investments brought something in this year".
  { id: "cat_default_investime_dividende", emri: "Dividendë", lloji: "hyrje", prindi: "cat_default_investime", ngjyra: "#8b5cf6", ikona: "TrendingUp" },
  { id: "cat_default_investime_interes", emri: "Interes Bankar", lloji: "hyrje", prindi: "cat_default_investime", ngjyra: "#8b5cf6", ikona: "Landmark" },
  { id: "cat_default_investime_tregu", emri: "Aksione & Kripto", lloji: "hyrje", prindi: "cat_default_investime", ngjyra: "#8b5cf6", ikona: "Coins" },
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

/** The same seven, short enough to label a column in a weekly chart. Sunday first, as `getDay()`
 * counts them. */
export const DAYS_SHORT = ["Die", "Hën", "Mar", "Mër", "Enj", "Pre", "Sht"];
