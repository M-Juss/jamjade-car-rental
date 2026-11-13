"use client";

import { useState } from "react";
import { importRuntimeModel } from "@/services/research/runtime-import.service";

export default function RuntimeImportPage() {
  const [model, setModel] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  return <main style={{ padding: 32 }}><h1>Install RC model</h1>
    <form onSubmit={async event => {
      event.preventDefault();
      if (!model || busy) return;
      setBusy(true); setMessage("");
      try { await importRuntimeModel(model); setMessage("Model installed."); }
      catch (error) { setMessage(error instanceof Error ? error.message : "Import failed."); }
      finally { setBusy(false); }
    }}>
      <label htmlFor="runtime-model">Runtime model JSON</label>{" "}
      <input id="runtime-model" type="file" accept=".json,application/json" required onChange={event => setModel(event.target.files?.[0] ?? null)} />{" "}
      <button type="submit" disabled={busy}>Install model</button>
    </form><p role="status">{message}</p></main>;
}
