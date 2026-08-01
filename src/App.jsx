import { Routes, Route } from "react-router-dom";
import "./Pages/Styles/PremiumTheme.css";
import "./Pages/Styles/DizajniPergjithshem.css";
import Dashboard from "./Pages/Dashboard";
import Transaksionet from "./Pages/Transaksionet";
import Llogarite from "./Pages/Llogarite";
import Borxhet from "./Pages/Borxhet";
import Kategorite from "./Pages/Kategorite";
import Buxhetet from "./Pages/Buxhetet";
import Qellimet from "./Pages/Qellimet";
import TePerseritura from "./Pages/TePerseritura";
import Statistika from "./Pages/Statistika";
import Cilesimet from "./Pages/Cilesimet";
import TeDhena from "./Pages/TeDhena";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/transaksionet" element={<Transaksionet />} />
      <Route path="/llogarite" element={<Llogarite />} />
      <Route path="/borxhet" element={<Borxhet />} />
      <Route path="/kategorite" element={<Kategorite />} />
      <Route path="/buxhetet" element={<Buxhetet />} />
      <Route path="/qellimet" element={<Qellimet />} />
      <Route path="/te-perseritura" element={<TePerseritura />} />
      <Route path="/statistikat" element={<Statistika />} />
      <Route path="/cilesimet" element={<Cilesimet />} />
      <Route path="/te-dhena" element={<TeDhena />} />
    </Routes>
  );
}

export default App;
