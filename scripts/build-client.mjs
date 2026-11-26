#!/usr/bin/env node
// Bundles the browser app (app/client.tsx) into public/dist/, which Workers static
// assets then serve. Mirrors the options hosted PartyKit's `serve.build` used.
//
//   node scripts/build-client.mjs          # one-off production build
//   node scripts/build-client.mjs --watch  # rebuild on change (dev)

import { rm } from "node:fs/promises";
import * as esbuild from "esbuild";

const watch = process.argv.includes("--watch");

const options = {
  entryPoints: ["app/client.tsx"],
  outdir: "public/dist",
  bundle: true,
  splitting: true,
  format: "esm",
  minify: !watch,
  sourcemap: true,
  define: {
    "process.env.PARTYKIT_SUPABASE_URL": JSON.stringify("https://cufrmdhkoabpwilwztym.supabase.co"),
    "process.env.PARTYKIT_SUPABASE_ANON_KEY": JSON.stringify("sb_publishable_HoNA1ULIi6X_bW9-4UJOMQ_zUuNogkJ"),
    PARTYKIT_EVENT_BUILD: process.env.EVENT_BUILD === "true" ? "true" : "false",
    APP_TITLE: JSON.stringify("Whispering Gallery"),
  },
  logLevel: "info",
};

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
} else {
  // Clear old hashed chunks so stale files don't get uploaded with each deploy.
  await rm(options.outdir, { recursive: true, force: true });
  await esbuild.build(options);
}
