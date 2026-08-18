// Bootstrap's stylesheet only. Its JavaScript bundle used to be imported next to it and was never
// once asked for anything: react-bootstrap implements the dropdowns, modals and offcanvas itself in
// React, and nothing in this app carries a `data-bs-*` attribute for Bootstrap's own scripts to
// pick up. It was Popper and the whole widget library parsed on the critical path to do nothing.
import "bootstrap/dist/css/bootstrap.min.css";
import ReactDOM from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import "./index.css";
import App from "./App";
import GabimIPapritur from "./Components/GabimIPapritur";
import ImportoNgaLinku from "./Components/ImportoNgaLinku";
import RaportiAutomatik from "./Components/RaportiAutomatik";
import { BrowserRouter } from "react-router-dom";
import { ThemeProvider } from "./Context/ThemeContext";
import { DialogProvider } from "./Context/DialogContext";
import { DataProvider } from "./Context/DataContext";
import { SyncProvider } from "./Context/SyncContext";

const root = ReactDOM.createRoot(document.getElementById("root"));

root.render(
  // Outermost, so that a page whose chunk never arrives - or a provider that throws while setting
  // itself up - meets a message and a way back instead of emptying `#root` and leaving the phone
  // on a black screen.
  <GabimIPapritur>
    <BrowserRouter>
      <ThemeProvider>
        <DialogProvider>
          <DataProvider>
            {/* Inside the data provider because it reloads the ledger after pulling changes down,
                and does nothing at all until the user connects a Supabase project of their own. */}
            <SyncProvider>
              <App />
              {/* A transfer that arrived as a link is offered as soon as the app opens. */}
              <ImportoNgaLinku />
              {/* The first opening of a new month is the only schedule a browser can keep, so the
                  monthly report is checked here rather than by anything resembling a cron. */}
              <RaportiAutomatik />
              {/* Page views only - no financial data leaves the browser, since every figure lives in
                  IndexedDB and none of it is passed to the tracker. Inside the router so client-side
                  navigations between the pages are counted too. */}
              <Analytics />
            </SyncProvider>
          </DataProvider>
        </DialogProvider>
      </ThemeProvider>
    </BrowserRouter>
  </GabimIPapritur>
);
