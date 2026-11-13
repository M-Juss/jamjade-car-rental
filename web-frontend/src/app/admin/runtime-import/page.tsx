"use client";

import { useState } from "react";
import { apiGet } from "@/services/http";
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
    </form><button type="button" onClick={async () => { try { const result = await apiGet("/admin/rc-research/runtime-import"); setMessage(result.message); } catch { setMessage("Model is unavailable."); } }}>Check model</button><p role="status">{message}</p></main>;
}
