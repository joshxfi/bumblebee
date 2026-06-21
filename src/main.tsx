import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./index.css";
import { ThemeProvider } from "@/components/theme-provider.tsx";
import { TooltipProvider } from "@/components/ui/tooltip.tsx";
import App from "./App.tsx";

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error('Root element "#root" not found.');
}

createRoot(rootEl).render(
  <StrictMode>
    <ThemeProvider defaultTheme="dark">
      <TooltipProvider>
        <App />
      </TooltipProvider>
    </ThemeProvider>
  </StrictMode>,
);
