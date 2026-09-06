/**
 * Live alignment check for the trade-in camera. STAGING ONLY.
 *
 * Decides whether what the camera sees is actually lined up with the framing
 * wireframe, so the shutter only goes green on a usable photo. No model, no
 * server round trip - it runs on the video frame in the browser at a few frames
 * a second.
 *
 * How it scores, and why it takes TWO measurements rather than one:
 *
 *   coverage  - of the wireframe's own strokes, what fraction has a real image
 *               edge sitting under it. This is what catches a car that is too
 *               far away, off to one side, or photographed from the wrong angle:
 *               the outline is there but nothing in the picture follows it.
 *
 *   lift      - of the strong edges in the picture, how many land on the
 *               wireframe COMPARED WITH how many would land there by chance.
 *               Raw precision does not work: the band covers a fixed share of
 *               the frame, so a busy scene puts that share of its edges on it
 *               whatever is in shot. Dividing by the chance rate makes 1.0 mean
 *               "no better than noise" regardless of scene or band size.
 *
 * Both have to clear their threshold, and they have to stay clear for a few
 * consecutive frames, so a momentary wobble does not trigger a green.
 *
 * MEASURED BEHAVIOUR (align_test.html, run in real Chromium against all 16
 * overlays): 16/16 correctly-lined-up frames pass; 0/90 wrong-angle, 0/30
 * shifted-or-too-distant and 0/10 no-car-at-all frames pass. The one known hole
 * is "far too close" - about 1 in 10 of those still pass, because a car
 * overflowing the frame still crosses most of the strokes.
 *
 * Deliberately NOT claimed: this is a framing gate, not the trained model the
 * reference flow uses. It rejects badly framed shots. It will not judge fine
 * pose error, and it is softer on body shapes that differ from the wireframe -
 * which is exactly why the wireframe should be chosen from the seller's own reg
 * rather than always being the minivan.
 */

/** Analysis runs on a small greyscale copy - full resolution buys nothing and
 *  costs frame rate on a mid-range phone. */
const ANALYSIS_W = 256;

/** How far from a stroke an image edge still counts as "on" it, in analysis
 *  pixels - about 1% of frame width. This started at 7 and a self-test showed
 *  that was catastrophic: dilating by 7 on a 256px frame put an "edge" near
 *  every stroke, coverage saturated at 1.00, and the check passed a frame with
 *  no car in it at all. Keep this tight. */
const BAND = 3;

export interface AlignmentScore {
  coverage: number;   // 0..1
  /** how much MORE of the image's edges land on the wireframe than chance alone
   *  would put there. 1.0 = no better than random. */
  lift: number;
  aligned: boolean;
}

export interface Thresholds {
  coverage: number;
  lift: number;
  /** consecutive passing frames required before it goes green */
  stableFrames: number;
}

/**
 * Calibrated against the self-test, not guessed. The lift value sits in the
 * measured gap between the two populations: in that test,
 * wrong-angle frames peaked at 1.58 lift and correctly-lined-up ones bottomed
 * out at 1.70, so 1.64 splits them. That gap is narrow, and real photographs
 * will be noisier than the synthetic frames - expect to revisit this after
 * trying it on actual cars in daylight.
 */
export const DEFAULT_THRESHOLDS: Thresholds = {
  coverage: 0.55,
  lift: 1.64,
  stableFrames: 3,
};

/**
 * The wireframe, prepared once per shot: a boolean mask of "within BAND of a
 * stroke", plus how many stroke pixels there were. Rebuilding this per frame
 * would dominate the cost, and it never changes while a shot is open.
 */
export interface OutlineMask {
  w: number;
  h: number;
  /** 1 where a stroke is, 0 elsewhere */
  stroke: Uint8Array;
  /** 1 within BAND of a stroke */
  band: Uint8Array;
  strokeCount: number;
  /** how many pixels the band covers - needed to work out how many edges would
   *  land on it by chance, which is what "lift" is measured against */
  bandCount: number;
}

/**
 * Rasterise the overlay to the analysis size and grow it into a tolerance band.
 * The image must already be loaded (naturalWidth > 0).
 */
export function buildOutlineMask(img: HTMLImageElement, frameW: number, frameH: number): OutlineMask {
  const w = ANALYSIS_W;
  const h = Math.max(1, Math.round((frameH / frameW) * ANALYSIS_W));
  void frameW;

  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("no canvas");

  // Draw it exactly as the overlay is displayed: contained and centred, so the
  // mask lines up with what the seller is looking at.
  const scale = Math.min(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);

  const data = ctx.getImageData(0, 0, w, h).data;
  const stroke = new Uint8Array(w * h);
  let strokeCount = 0;
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    // the overlays are white line art on transparent
    if (data[i + 3] > 60 && data[i] > 120) {
      stroke[p] = 1;
      strokeCount++;
    }
  }

  // Grow the strokes by BAND. Two 1-D passes rather than a circular kernel:
  // same effect for our purposes and far cheaper.
  const band = dilate(stroke, w, h, BAND);
  let bandCount = 0;
  for (let i = 0; i < band.length; i++) if (band[i]) bandCount++;
  return { w, h, stroke, band, strokeCount, bandCount };
}

/** Separable box dilation - horizontal then vertical. */
function dilate(src: Uint8Array, w: number, h: number, r: number): Uint8Array {
  const tmp = new Uint8Array(w * h);
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      let v = 0;
      const a = Math.max(0, x - r);
      const b = Math.min(w - 1, x + r);
      for (let i = a; i <= b; i++) if (src[row + i]) { v = 1; break; }
      tmp[row + x] = v;
    }
  }
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      let v = 0;
      const a = Math.max(0, y - r);
      const b = Math.min(h - 1, y + r);
      for (let i = a; i <= b; i++) if (tmp[i * w + x]) { v = 1; break; }
      out[y * w + x] = v;
    }
  }
  return out;
}

/** Scratch canvas reused across frames - allocating one per frame is what makes
 *  this kind of loop stutter. */
let scratch: HTMLCanvasElement | null = null;

/**
 * Score one video frame against a prepared mask.
 *
 * Edges come from a Sobel magnitude with an adaptive threshold: a fixed
 * threshold fails outdoors, where a car in bright sun has far stronger gradients
 * than the same car under cloud. Taking the top slice of gradients instead keeps
 * the measure comparable between a dull yard and a sunny forecourt.
 */
export function scoreFrame(
  video: HTMLVideoElement,
  mask: OutlineMask,
  t: Thresholds = DEFAULT_THRESHOLDS,
): AlignmentScore {
  const { w, h } = mask;
  if (!scratch) scratch = document.createElement("canvas");
  if (scratch.width !== w || scratch.height !== h) {
    scratch.width = w;
    scratch.height = h;
  }
  const ctx = scratch.getContext("2d", { willReadFrequently: true });
  if (!ctx) return { coverage: 0, lift: 0, aligned: false };

  ctx.drawImage(video, 0, 0, w, h);
  const px = ctx.getImageData(0, 0, w, h).data;

  // greyscale
  const grey = new Float32Array(w * h);
  for (let i = 0, p = 0; i < px.length; i += 4, p++) {
    grey[p] = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
  }

  // Sobel magnitude
  const mag = new Float32Array(w * h);
  let maxMag = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx =
        -grey[i - w - 1] - 2 * grey[i - 1] - grey[i + w - 1] +
        grey[i - w + 1] + 2 * grey[i + 1] + grey[i + w + 1];
      const gy =
        -grey[i - w - 1] - 2 * grey[i - w] - grey[i - w + 1] +
        grey[i + w - 1] + 2 * grey[i + w] + grey[i + w + 1];
      const m = Math.abs(gx) + Math.abs(gy);
      mag[i] = m;
      if (m > maxMag) maxMag = m;
    }
  }
  if (maxMag <= 0) return { coverage: 0, lift: 0, aligned: false };

  // Adaptive threshold: keep roughly the strongest 5% of gradients. This was
  // 12%, which on a textured scene marked so much of the frame as "edge" that
  // every stroke had one under it.
  const hist = new Int32Array(64);
  for (let i = 0; i < mag.length; i++) hist[Math.min(63, (mag[i] / maxMag * 63) | 0)]++;
  const target = Math.round(mag.length * 0.05);
  let acc = 0;
  let cut = 63;
  for (let b = 63; b >= 0; b--) {
    acc += hist[b];
    if (acc >= target) { cut = b; break; }
  }
  const thresh = (cut / 63) * maxMag;

  let edgeCount = 0;
  let edgeOnBand = 0;
  const edge = new Uint8Array(w * h);
  for (let i = 0; i < mag.length; i++) {
    if (mag[i] >= thresh) {
      edge[i] = 1;
      edgeCount++;
      if (mask.band[i]) edgeOnBand++;
    }
  }

  // Coverage: how much of the wireframe has an edge near it. Only ONE of the two
  // is dilated - dilating both, as the first version did, doubled the effective
  // tolerance and was a large part of why everything passed.
  const edgeBand = dilate(edge, w, h, BAND);
  let strokeCovered = 0;
  for (let i = 0; i < mask.stroke.length; i++) {
    if (mask.stroke[i] && edgeBand[i]) strokeCovered++;
  }
  const coverage = mask.strokeCount ? strokeCovered / mask.strokeCount : 0;

  // Lift, not raw precision. The band covers some fraction of the frame, so even
  // random noise puts that same fraction of its edges on it. Dividing by the
  // chance rate makes 1.0 mean "no better than noise" regardless of how big the
  // band is or how busy the scene is - which is the property raw precision
  // lacked, and why a frame with no car in it used to pass.
  const chance = mask.bandCount / (w * h);
  const onBand = edgeCount ? edgeOnBand / edgeCount : 0;
  const lift = chance > 0 ? onBand / chance : 0;

  return {
    coverage,
    lift,
    aligned: coverage >= t.coverage && lift >= t.lift,
  };
}

/**
 * Wraps scoreFrame with the "must hold for N frames" rule, so a green tick means
 * the shot was steady and lined up rather than momentarily lucky.
 */
export class AlignmentTracker {
  private run = 0;
  constructor(private t: Thresholds = DEFAULT_THRESHOLDS) {}

  push(s: AlignmentScore): boolean {
    this.run = s.aligned ? this.run + 1 : 0;
    return this.run >= this.t.stableFrames;
  }

  reset() {
    this.run = 0;
  }
}
