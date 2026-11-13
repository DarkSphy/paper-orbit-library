import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Arquivo — Visualizador de documentos" },
      { name: "description", content: "Envie e visualize PDFs, imagens e textos guardados na nuvem." },
      { property: "og:title", content: "Arquivo — Visualizador de documentos" },
      { property: "og:description", content: "Envie e visualize PDFs, imagens e textos guardados na nuvem." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

type Doc = { name: string; size: number; created_at: string | null };
const BUCKET = "documents";

function kind(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "pdf";
  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) return "image";
  if (["txt", "md", "csv", "json", "log"].includes(ext)) return "text";
  return "other";
}
const displayName = (n: string) => n.replace(/^\d+-/, "");
const fmtSize = (b: number) => (b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.ceil(b / 1e3)} KB`);

function Index() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.storage.from(BUCKET).list("", { sortBy: { column: "created_at", order: "desc" } });
    if (error) return setError(error.message);
    setDocs((data ?? []).filter((f) => f.id).map((f) => ({ name: f.name, size: f.metadata?.size ?? 0, created_at: f.created_at })));
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    setUrl(null); setText(null);
    if (!selected) return;
    (async () => {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(selected, 3600);
      if (error) return setError(error.message);
      setUrl(data.signedUrl);
      if (kind(selected) === "text") setText(await (await fetch(data.signedUrl)).text());
    })();
  }, [selected]);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true); setError(null);
    for (const f of Array.from(files)) {
      const safe = f.name.replace(/[^\w.\-]/g, "_");
      const { error } = await supabase.storage.from(BUCKET).upload(`${Date.now()}-${safe}`, f);
      if (error) setError(error.message);
    }
    setBusy(false);
    if (input.current) input.current.value = "";
    load();
  }

  async function remove(name: string) {
    await supabase.storage.from(BUCKET).remove([name]);
    if (selected === name) setSelected(null);
    load();
  }

  return (
    <div className="grid min-h-screen md:grid-cols-[320px_1fr]">
      <aside className="flex flex-col border-r border-border bg-sidebar">
        <header className="border-b border-border p-6">
          <h1 className="font-display text-3xl text-foreground">Arquivo</h1>
          <p className="mt-1 text-sm text-muted-foreground">Seus documentos na nuvem</p>
          <button
            onClick={() => input.current?.click()}
            disabled={busy}
            className="mt-5 w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Enviando…" : "+ Enviar documento"}
          </button>
          <input ref={input} type="file" multiple hidden onChange={(e) => upload(e.target.files)} />
          {error && <p className="mt-3 text-xs text-destructive">{error}</p>}
        </header>
        <ul className="flex-1 overflow-y-auto p-3">
          {docs.length === 0 && <li className="p-4 text-sm text-muted-foreground">Nenhum documento ainda.</li>}
          {docs.map((d) => (
            <li key={d.name} className="group">
              <button
                onClick={() => setSelected(d.name)}
                className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition ${selected === d.name ? "bg-accent text-accent-foreground" : "hover:bg-muted"}`}
              >
                <span className="font-mono w-10 shrink-0 rounded bg-secondary py-1 text-center text-[10px] uppercase text-secondary-foreground">
                  {d.name.split(".").pop()?.slice(0, 4)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{displayName(d.name)}</span>
                  <span className="text-xs text-muted-foreground">{fmtSize(d.size)}</span>
                </span>
                <span
                  role="button"
                  aria-label="Excluir"
                  onClick={(e) => { e.stopPropagation(); remove(d.name); }}
                  className="text-xs text-muted-foreground opacity-0 transition hover:text-destructive group-hover:opacity-100"
                >✕</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <main className="flex min-h-[60vh] flex-col bg-background">
        {!selected ? (
          <div className="m-auto text-center">
            <p className="font-display text-4xl text-foreground">Escolha um documento</p>
            <p className="mt-2 text-sm text-muted-foreground">PDF, imagens e textos abrem aqui.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 className="truncate font-medium">{displayName(selected)}</h2>
              {url && <a href={url} target="_blank" rel="noreferrer" className="text-sm text-primary underline-offset-4 hover:underline">Abrir / baixar</a>}
            </div>
            <div className="flex-1 p-6">
              {!url ? <p className="text-sm text-muted-foreground">Carregando…</p>
                : kind(selected) === "pdf" ? <iframe src={url} title="PDF" className="h-[80vh] w-full rounded-md border border-border bg-card" />
                : kind(selected) === "image" ? <img src={url} alt={displayName(selected)} className="mx-auto max-h-[80vh] rounded-md shadow-lg" />
                : kind(selected) === "text" ? <pre className="font-mono max-h-[80vh] overflow-auto whitespace-pre-wrap rounded-md border border-border bg-card p-5 text-sm">{text ?? "Carregando…"}</pre>
                : <p className="text-sm text-muted-foreground">Pré-visualização indisponível para este formato. Use "Abrir / baixar".</p>}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
