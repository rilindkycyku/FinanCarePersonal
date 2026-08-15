import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import PageLoading from "./Components/PageLoading";
import "./Pages/Styles/PremiumTheme.css";
import "./Pages/Styles/DizajniPergjithshem.css";

// One chunk per page: opening the dashboard no longer downloads the statistics charts, the
// budgets or the export tooling, which is most of what the bundle weighed.
const Dashboard = lazy(() => import("./Pages/Dashboard"));
const Transaksionet = lazy(() => import("./Pages/Transaksionet"));
const Llogarite = lazy(() => import("./Pages/Llogarite"));
const Borxhet = lazy(() => import("./Pages/Borxhet"));
const Kategorite = lazy(() => import("./Pages/Kategorite"));
const Buxhetet = lazy(() => import("./Pages/Buxhetet"));
const Qellimet = lazy(() => import("./Pages/Qellimet"));
const Planifikuara = lazy(() => import("./Pages/Planifikuara"));
const TePerseritura = lazy(() => import("./Pages/TePerseritura"));
const Statistika = lazy(() => import("./Pages/Statistika"));
const Cilesimet = lazy(() => import("./Pages/Cilesimet"));
// Both addresses are the same page - syncing and exporting are two halves of one question, and
// `/sinkronizimi` stays a real address because the sync indicator, the home-screen warning and
// `?konfiguro=1` all point at it.
const TeDhena = lazy(() => import("./Pages/TeDhena"));
const ImportoCsv = lazy(() => import("./Pages/ImportoCsv"));
// Udhëzimet janë tekst i pandryshueshëm dhe i gjatë - pjesa e vetme e aplikacionit që shumica e
// hap një herë - prandaj rri në një copë të vetën dhe nuk shkarkohet derisa të kërkohet.
const Udhezuesi = lazy(() => import("./Pages/Udhezuesi"));

function App() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/transaksionet" element={<Transaksionet />} />
        <Route path="/llogarite" element={<Llogarite />} />
        <Route path="/borxhet" element={<Borxhet />} />
        <Route path="/kategorite" element={<Kategorite />} />
        <Route path="/buxhetet" element={<Buxhetet />} />
        <Route path="/qellimet" element={<Qellimet />} />
        <Route path="/planifikuara" element={<Planifikuara />} />
        <Route path="/te-perseritura" element={<TePerseritura />} />
        <Route path="/statistikat" element={<Statistika />} />
        <Route path="/cilesimet" element={<Cilesimet />} />
        <Route path="/te-dhena" element={<TeDhena />} />
        <Route path="/sinkronizimi" element={<TeDhena />} />
        <Route path="/importo-csv" element={<ImportoCsv />} />
        {/* Skeda e hapur qëndron te adresa, që një udhëzim të jetë i dërgueshëm dhe që butoni
            «Si përdoret» te çdo faqe të hapë pikërisht të vetin. */}
        <Route path="/udhezuesi" element={<Udhezuesi />} />
        <Route path="/udhezuesi/:faqja" element={<Udhezuesi />} />
      </Routes>
    </Suspense>
  );
}

export default App;
