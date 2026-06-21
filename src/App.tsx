import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";

const ChatApp = lazy(() => import("./chat-app"));
const AboutPage = lazy(() => import("./pages/about-page"));

function AppFallback() {
  return (
    <div className="flex h-svh items-center justify-center bg-background px-6 text-center text-sm text-muted-foreground">
      <div className="space-y-3">
        <div className="mx-auto flex size-11 items-center justify-center border border-primary/30 bg-primary/10 text-lg text-primary">
          <span
            aria-hidden="true"
            className="animate-[pulse_1.2s_ease-in-out_infinite]"
          >
            🐝
          </span>
        </div>
        <div>Waking Bumblebee…</div>
      </div>
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<AppFallback />}>
        <Routes>
          <Route path="/" element={<ChatApp />} />
          <Route path="/about" element={<AboutPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
