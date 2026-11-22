// Image simulation off the main thread. Uses the same simulatePixels() as the tests and swatches.
import { cvdMatrix, simulatePixels, type Vision } from "../../core/cvd";

interface Job { id: number; width: number; height: number; buffer: ArrayBuffer; vision: Vision }
self.onmessage = (e: MessageEvent<Job>) => {
  const { id, width, height, buffer, vision } = e.data;
  const data = new Uint8ClampedArray(buffer);
  const m = cvdMatrix(vision);
  const total = width * height, chunk = 1 << 18;
  for (let start = 0; start < total; start += chunk) {
    simulatePixels(data, m, start, Math.min(total, start + chunk));
    (self as unknown as Worker).postMessage({ id, progress: Math.min(1, (start + chunk) / total) });
  }
  (self as unknown as Worker).postMessage({ id, done: true, width, height, buffer }, [buffer]);
};
