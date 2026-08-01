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
const TeDhena = lazy(() => import("./Pages/TeDhena"));

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
      </Routes>
    </Suspense>
  );
}

export default App;
