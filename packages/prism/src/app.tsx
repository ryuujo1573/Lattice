import { Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { Suspense } from "solid-js";

import "./app.css";

export default function App() {
  return (
    <Router
      root={(props) => (
        <>
          <nav class="navbar navbar-center gap-4">
            <a class="link link-primary no-underline" href="/">
              Index
            </a>
            <a class="link link-secondary no-underline" href="/about">
              About
            </a>
          </nav>
          <main>
            <Suspense>{props.children}</Suspense>
          </main>
        </>
      )}
    >
      <FileRoutes />
    </Router>
  );
}
