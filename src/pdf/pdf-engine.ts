import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export type PdfRenderInfo = {
  pageCount: number;
  width: number;
  height: number;
  pdfWidth: number;
  pdfHeight: number;
};

export type LoadedPdfDocument = Awaited<ReturnType<typeof getDocument>["promise"]>;

function copyBytes(bytes: Uint8Array) {
  return Uint8Array.from(bytes);
}

export async function loadPdfDocument(bytes: Uint8Array): Promise<LoadedPdfDocument> {
  return getDocument({ data: copyBytes(bytes) }).promise;
}

export async function renderPdfPage(
  document: LoadedPdfDocument,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  scale = 1.2,
  signal?: AbortSignal,
): Promise<PdfRenderInfo> {
  const safePage = Math.max(1, Math.min(document.numPages, pageNumber));
  const page = await document.getPage(safePage);
  const viewport = page.getViewport({ scale });
  const unitViewport = page.getViewport({ scale: 1 });
  const ratio = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = Math.ceil(viewport.width * ratio);
  canvas.height = Math.ceil(viewport.height * ratio);
  canvas.style.width = `${Math.ceil(viewport.width)}px`;
  canvas.style.height = `${Math.ceil(viewport.height)}px`;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D indisponível.");
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  const task = page.render({ canvasContext: context, viewport });
  const cancel = () => task.cancel();
  signal?.addEventListener("abort", cancel, { once: true });
  try {
    await task.promise;
  } finally {
    signal?.removeEventListener("abort", cancel);
  }
  return { pageCount: document.numPages, width: viewport.width, height: viewport.height, pdfWidth: unitViewport.width, pdfHeight: unitViewport.height };
}

export async function renderPdfThumbnail(document: LoadedPdfDocument, pageNumber: number, canvas: HTMLCanvasElement, signal?: AbortSignal) {
  return renderPdfPage(document, pageNumber, canvas, 0.18, signal);
}

export async function extractPdfText(document: LoadedPdfDocument): Promise<Array<{ page: number; text: string }>> {
  const out: Array<{ page: number; text: string }> = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items.map((item) => ("str" in item ? String(item.str || "") : "")).join(" ");
    out.push({ page: pageNumber, text });
  }
  return out;
}
