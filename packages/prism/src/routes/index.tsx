import type { RouteDefinition } from "@solidjs/router";

export const route = {
  preload() {},
} satisfies RouteDefinition;

export default function Home() {
  return <main class="w-full p-4 space-y-2">Prism - Start.</main>;
}
