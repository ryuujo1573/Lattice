import mdx from "@mdx-js/rollup";
import { solidStart } from "@solidjs/start/config";
import { nitroV2Plugin as nitro } from "@solidjs/vite-plugin-nitro-2";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    Object.assign(
      mdx({
        jsx: true,
        jsxImportSource: "solid-js",
        providerImportSource: "solid-mdx",
      }),
      {
        enforce: "pre",
      } as const,
    ),
    solidStart({
      extensions: ["mdx", "md"],
    }),
    tailwindcss() as never,
    nitro(),
  ],
});
