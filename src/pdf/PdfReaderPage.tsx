import { useEffect, useMemo, useRef, useState } from "react";
import type { PdfSource } from "../types";
import {
  extractPdfText,
  loadPdfDocument,
  renderPdfPage,
  renderPdfThumbnail,
  type LoadedPdfDocument,
  type PdfRenderInfo,
} from "./pdf-engine";

type CachedSession = { bytes: Uint8Array; name: string; page: number; zoom: number };
const sessionCache = new Map<string, CachedSession>();
const MAX_CACHED_PDFS = 4;

function ensurePdfName(name: string) {
  const clean = (name || "documento.pdf").replace(/[\\/:*?"<>|]+/g, "-").trim() || "documento.pdf";
  return /\.pdf$/i.test(clean) ? clean : `${clean}.pdf`;
}

function formatError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function toUint8(value: Uint8Array | ArrayBuffer | number[]) {
  if (value instanceof Uint8Array) return Uint8Array.from(value);
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  return Uint8Array.from(value || []);
}

function cachePdfSession(tabId: string, value: CachedSession) {
  sessionCache.delete(tabId);
  sessionCache.set(tabId, value);
  while (sessionCache.size > MAX_CACHED_PDFS) {
    const oldest = sessionCache.keys().next().value as string | undefined;
    if (!oldest) break;
    sessionCache.delete(oldest);
  }
}

function PdfThumbnail({ document, page, active, onClick }: { document: LoadedPdfDocument; page: number; active: boolean; onClick(): void }) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(active);

  useEffect(() => {
    if (active) setVisible(true);
  }, [active]);

  useEffect(() => {
    const node = buttonRef.current;
    if (!node || visible) return;
    if (!("IntersectionObserver" in window)) { setVisible(true); return; }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: "240px 0px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [visible, page]);

  useEffect(() => {
    if (!visible) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const controller = new AbortController();
    void renderPdfThumbnail(document, page, canvas, controller.signal).catch((error) => {
      if (!controller.signal.aborted) canvas.dataset.failed = formatError(error);
    });
    return () => controller.abort();
  }, [document, page, visible]);

  return <button ref={buttonRef} className={`pdf-thumbnail ${active ? "active" : ""}`} onClick={onClick} title={`Página ${page}`}><canvas ref={canvasRef}/><span>{page}</span></button>;
}

export default function PdfReaderPage({ tabId, source }: { tabId: string; source?: PdfSource }) {
  const cached = sessionCache.get(tabId);
  const [bytes, setBytes] = useState<Uint8Array | null>(() => cached?.bytes || null);
  const [pdfDocument, setPdfDocument] = useState<LoadedPdfDocument | null>(null);
  const [name, setName] = useState(cached?.name || source?.name || "documento.pdf");
  const [page, setPage] = useState(cached?.page || 1);
  const [pageCount, setPageCount] = useState(0);
  const [zoom, setZoom] = useState(cached?.zoom || 1.15);
  const [renderInfo, setRenderInfo] = useState<PdfRenderInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(source?.url && !cached ? "Abrindo PDF da web…" : "");
  const [search, setSearch] = useState("");
  const [searchMatches, setSearchMatches] = useState<number[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasAreaRef = useRef<HTMLElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!bytes) return;
    cachePdfSession(tabId, { bytes, name, page, zoom });
  }, [tabId, bytes, name, page, zoom]);

  useEffect(() => {
    if (bytes || !source?.url) return;
    let alive = true;
    setBusy(true);
    void window.marshmallow.pdf.fetchUrl(source.url).then((result) => {
      if (!alive) return;
      if (!result.ok || !result.bytes) throw new Error(result.error || "Não foi possível carregar o PDF.");
      const loaded = toUint8(result.bytes);
      setBytes(loaded);
      setName(ensurePdfName(source.name || result.name || "documento.pdf"));
      setPage(1);
      setMessage("");
    }).catch((error) => { if (alive) setMessage(formatError(error)); }).finally(() => { if (alive) setBusy(false); });
    return () => { alive = false; };
  }, [source?.url, source?.name, bytes]);

  useEffect(() => {
    if (!bytes) { setPdfDocument(null); setPageCount(0); return; }
    let alive = true;
    let loaded: LoadedPdfDocument | null = null;
    setBusy(true);
    setMessage("");
    void loadPdfDocument(bytes).then((document) => {
      loaded = document;
      if (!alive) { void document.destroy(); return; }
      setPdfDocument(document);
      setPageCount(document.numPages);
      if (page > document.numPages) setPage(Math.max(1, document.numPages));
    }).catch((error) => {
      if (alive) {
        setPdfDocument(null);
        setPageCount(0);
        setMessage(formatError(error));
      }
    }).finally(() => { if (alive) setBusy(false); });
    return () => {
      alive = false;
      if (loaded) void loaded.destroy();
    };
  }, [bytes]);

  useEffect(() => {
    if (!pdfDocument || !canvasRef.current) return;
    let alive = true;
    const controller = new AbortController();
    setBusy(true);
    void renderPdfPage(pdfDocument, page, canvasRef.current, zoom, controller.signal).then((info) => {
      if (!alive) return;
      setRenderInfo(info);
    }).catch((error) => {
      if (alive && !controller.signal.aborted) setMessage(formatError(error));
    }).finally(() => { if (alive) setBusy(false); });
    return () => { alive = false; controller.abort(); };
  }, [pdfDocument, page, zoom]);

  const pages = useMemo(() => Array.from({ length: pageCount }, (_, index) => index + 1), [pageCount]);

  async function loadLocalFile(file?: File) {
    if (!file) return;
    if (file.type && file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) { setMessage("Selecione um arquivo PDF."); return; }
    setBusy(true);
    try {
      const data = new Uint8Array(await file.arrayBuffer());
      setBytes(data);
      setName(ensurePdfName(file.name));
      setPage(1);
      setSearch("");
      setSearchMatches([]);
      setMessage("");
    } catch (error) { setMessage(formatError(error)); } finally { setBusy(false); }
  }

  async function runSearch() {
    if (!pdfDocument || !search.trim()) { setSearchMatches([]); return; }
    setBusy(true);
    try {
      const needle = search.trim().toLocaleLowerCase("pt-BR");
      const text = await extractPdfText(pdfDocument);
      const matches = text.filter((item) => item.text.toLocaleLowerCase("pt-BR").includes(needle)).map((item) => item.page);
      setSearchMatches(matches);
      if (matches[0]) setPage(matches[0]);
      setMessage(matches.length ? `${matches.length} página(s) com resultado.` : "Texto não encontrado.");
    } catch (error) { setMessage(formatError(error)); } finally { setBusy(false); }
  }

  async function saveCopy() {
    if (!bytes) return;
    const result = await window.marshmallow.pdf.save(bytes, ensurePdfName(name));
    setMessage(result.ok ? `Cópia salva em ${result.path}` : result.canceled ? "Salvamento cancelado." : (result.error || "Falha ao salvar."));
  }

  function printPdf() {
    if (!bytes) return;
    const blob = new Blob([Uint8Array.from(bytes)], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const frame = document.createElement("iframe");
    frame.style.position = "fixed";
    frame.style.width = "1px";
    frame.style.height = "1px";
    frame.style.opacity = "0";
    frame.src = url;
    frame.onload = () => {
      setTimeout(() => {
        frame.contentWindow?.focus();
        frame.contentWindow?.print();
        setTimeout(() => { frame.remove(); URL.revokeObjectURL(url); }, 1500);
      }, 250);
    };
    document.body.appendChild(frame);
  }

  function fitWidth() {
    if (!renderInfo || !canvasAreaRef.current) return;
    const availableWidth = Math.max(240, canvasAreaRef.current.clientWidth - 72);
    setZoom(Math.max(.35, Math.min(3, availableWidth / renderInfo.pdfWidth)));
  }

  function fitPage() {
    if (!renderInfo || !canvasAreaRef.current) return;
    const availableWidth = Math.max(240, canvasAreaRef.current.clientWidth - 72);
    const availableHeight = Math.max(240, canvasAreaRef.current.clientHeight - 86);
    setZoom(Math.max(.35, Math.min(3, availableWidth / renderInfo.pdfWidth, availableHeight / renderInfo.pdfHeight)));
  }

  if (!bytes) {
    return <div className="pdf-reader pdf-empty" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void loadLocalFile(event.dataTransfer.files?.[0]); }}>
      <div className="pdf-empty-card">
        <div className="pdf-logo">PDF</div><h1>PDF Reader</h1><p>Leia documentos PDF localmente no MarshMallow, sem enviar o arquivo para um serviço externo.</p>
        <button className="pdf-upload-button" onClick={() => fileInputRef.current?.click()}>Faça upload do arquivo</button>
        <span>ou arraste um arquivo .pdf para esta área</span>
        <input ref={fileInputRef} type="file" accept="application/pdf,.pdf" hidden onChange={(event) => { void loadLocalFile(event.target.files?.[0]); event.currentTarget.value = ""; }}/>
        {busy && <b>Carregando…</b>}{message && <div className="pdf-message error">{message}</div>}
      </div>
    </div>;
  }

  return <div className="pdf-reader">
    <div className="pdf-toolbar">
      <div className="pdf-toolbar-group"><button onClick={() => fileInputRef.current?.click()}>Abrir PDF</button><button onClick={() => void saveCopy()}>Salvar cópia</button><button onClick={printPdf}>Imprimir</button></div>
      <div className="pdf-toolbar-group"><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>←</button><span>{page} / {pageCount || "…"}</span><button disabled={page >= pageCount} onClick={() => setPage((value) => value + 1)}>→</button></div>
      <div className="pdf-toolbar-group"><button onClick={() => setZoom((value) => Math.max(.35, value - .15))}>−</button><span>{Math.round(zoom * 100)}%</span><button onClick={() => setZoom((value) => Math.min(3, value + .15))}>＋</button><button onClick={fitWidth}>Ajustar largura</button><button onClick={fitPage}>Ajustar página</button></div>
      <div className="pdf-search"><input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void runSearch(); }} placeholder="Pesquisar no PDF"/><button onClick={() => void runSearch()}>⌕</button>{searchMatches.length > 0 && <span>{searchMatches.length}</span>}</div>
    </div>
    <div className="pdf-workspace">
      <aside className="pdf-thumbnails">{pdfDocument && pages.map((item) => <PdfThumbnail key={item} document={pdfDocument} page={item} active={item === page} onClick={() => setPage(item)}/>)}</aside>
      <main ref={canvasAreaRef} className="pdf-canvas-area"><div className="pdf-document-name">{name}{busy ? " · carregando…" : ""}</div><canvas ref={canvasRef}/>{message && <div className="pdf-message">{message}</div>}</main>
    </div>
    <input ref={fileInputRef} type="file" accept="application/pdf,.pdf" hidden onChange={(event) => { void loadLocalFile(event.target.files?.[0]); event.currentTarget.value = ""; }}/>
  </div>;
}
