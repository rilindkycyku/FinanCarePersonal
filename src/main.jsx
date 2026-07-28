import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min";
import ReactDOM from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import "./index.css";
import App from "./App";
import { BrowserRouter } from "react-router-dom";
import { ThemeProvider } from "./Context/ThemeContext";
import { DialogProvider } from "./Context/DialogContext";
import { DataProvider } from "./Context/DataContext";

const root = ReactDOM.createRoot(document.getElementById("root"));

root.render(
  <BrowserRouter>
    <ThemeProvider>
      <DialogProvider>
        <DataProvider>
          <App />
          {/* Page views only - no financial data leaves the browser, since every figure lives in
              IndexedDB and none of it is passed to the tracker. Inside the router so client-side
              navigations between the pages are counted too. */}
          <Analytics />
        </DataProvider>
      </DialogProvider>
    </ThemeProvider>
  </BrowserRouter>
);
