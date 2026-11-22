// Image colour-vision preview: a PNG or JPEG is decoded, simulated in a web worker and shown next to
// the original. Nothing leaves the browser. Large images are scaled to at most 16 megapixels.
import { useEffect, useRef, useState } from "react";
import { Download, ImageUp } from "lucide-react";
import { isIdentity, type Vision } from "../../core/cvd";
import { t, useLang } from "../../i18n/i18n";
import { visionLabel, Compared } from "../Stage";
import { slug } from "../../core/export";

const MAX_PIXELS = 16_000_000;
interface Loaded { name: string; width: number; height: number; pixels: ImageData; url: string }

export default function ImageTool({ vision, compare }: { vision: Vision; compare: boolean }) {
  useLang();
  const [img, setImg] = useState<Loaded | null>(null);
  const [simUrl, setSimUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const worker = useRef<Worker | null>(null);
  const job = useRef(0);

  useEffect(() => () => { worker.current?.terminate(); }, []);
  useEffect(() => () => { if (img) URL.revokeObjectURL(img.url); }, [img]);
  useEffect(() => () => { if (simUrl) URL.revokeObjectURL(simUrl); }, [simUrl]);

  const load = async (file: File | undefined) => {
    setError(null);
    if (!file) return;
    if (!/^image\/(png|jpeg)$/.test(file.type)) { setError(t("Choose a PNG or JPEG image.")); return; }
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, Math.sqrt(MAX_PIXELS / (bitmap.width * bitmap.height)));
      const w = Math.max(1, Math.round(bitmap.width * scale)), h = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      ctx.drawImage(bitmap, 0, 0, w, h);
      bitmap.close();
      const pixels = ctx.getImageData(0, 0, w, h);
      const url = URL.createObjectURL(await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("encode"))), "image/png")));
      setImg({ name: file.name, width: w, height: h, pixels, url });
    } catch { setError(t("This image could not be read.")); }
  };

  // (re)simulate when the image or the vision changes
  useEffect(() => {
    if (!img || isIdentity(vision)) { setSimUrl(null); setProgress(null); return; }
    const id = ++job.current;
    worker.current?.terminate();
    const w = new Worker(new URL("./simulate.worker.ts", import.meta.url), { type: "module" });
    worker.current = w;
    const copy = new Uint8ClampedArray(img.pixels.data);
    setProgress(0);
    w.onmessage = async (e: MessageEvent<{ id: number; progress?: number; done?: boolean; width: number; height: number; buffer: ArrayBuffer }>) => {
      if (e.data.id !== job.current) return;
      if (e.data.progress !== undefined) { setProgress(e.data.progress); return; }
      const canvas = document.createElement("canvas");
      canvas.width = e.data.width; canvas.height = e.data.height;
      canvas.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(e.data.buffer), e.data.width, e.data.height), 0, 0);
      canvas.toBlob((b) => { if (b && id === job.current) { setSimUrl(URL.createObjectURL(b)); setProgress(null); } }, "image/png");
      w.terminate();
    };
    w.postMessage({ id, width: img.width, height: img.height, buffer: copy.buffer, vision }, [copy.buffer]);
  }, [img, vision]);

  const download = () => {
    if (!simUrl || !img) return;
    const a = document.createElement("a");
    a.href = simUrl;
    a.download = `${slug(img.name.replace(/\.[^.]+$/, ""))}-${vision.type}-${vision.severity.toFixed(2)}-simulated.png`;
    a.click();
  };

  return (
    <div className="image-tool" data-testid="image-tool">
      <div className="it-bar">
        <label className="btn file-btn">
          <ImageUp size={16} aria-hidden="true" />{img ? t("Choose another image") : t("Choose an image")}
          <input type="file" accept="image/png,image/jpeg" onChange={(e) => { void load(e.target.files?.[0]); e.target.value = ""; }} data-testid="image-input" />
        </label>
        {img && <span className="it-meta">{img.name} · {img.width} × {img.height}</span>}
        {progress !== null && <span className="it-meta" role="status">{t("Simulating… {n}%", { n: Math.round(progress * 100) })}</span>}
        <button className="btn" onClick={download} disabled={!simUrl} data-tip={t("Download the simulated image as PNG")} data-testid="image-download"><Download size={16} />{t("Download PNG")}</button>
      </div>
      {error && <p className="banner inline" role="alert">{error}</p>}
      {!img ? (
        <div className="it-empty">
          <ImageUp size={28} aria-hidden="true" />
          <strong>{t("Preview an image with simulated colour vision")}</strong>
          <span>{t("PNG or JPEG. The image is processed in this browser and never uploaded.")}</span>
        </div>
      ) : (
        <Compared vision={vision} compare={compare}
          original={<img className="it-img" src={img.url} alt={t("Original image")} />}
          simulated={isIdentity(vision) ? null : simUrl ? <img className="it-img" src={simUrl} alt={t("Simulated image: {mode}", { mode: visionLabel(vision) })} data-testid="image-simulated" /> : <div className="it-empty">{t("Simulating…")}</div>} />
      )}
    </div>
  );
}
