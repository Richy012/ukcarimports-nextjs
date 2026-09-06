"use client";

/**
 * Trade-in photo capture. STAGING ONLY.
 *
 * This replaces the static tiles that used to sit in step 2 and do nothing.
 * What it actually does now:
 *
 *  - Guided slots open a live in-page camera with a framing outline drawn over
 *    it. Damage close-ups and any device that refuses camera access fall back
 *    to <input type="file" accept="image/*" capture="environment">. No app to
 *    install - nobody installs an app to sell one car.
 *  - The photo is resized to 1,600px on its long edge and re-encoded as JPEG
 *    0.82 IN THE BROWSER before it is sent. Raw phone photos are 4-8MB and a
 *    seller on mobile data will not wait. It also means EXIF - including GPS -
 *    never leaves the handset, because a canvas re-encode carries no metadata.
 *  - Each shot uploads the moment it is taken, against a draft id kept in
 *    localStorage. Lose signal at shot 19 and you keep the first 18.
 *  - Reloading the page restores the ticks from the server, not from memory.
 *  - Every shot can be retaken. Damage close-ups are unlimited and separate.
 *
 * The framing outline is now built (2026-08-17). It could not be done with
 * <input capture>, because that hands the whole screen to the operating
 * system's camera app and nothing can be painted on top of it. So the guided
 * shots open a live in-page camera and draw the outline over the video feed.
 * The usual objection to an in-page camera is image quality, and it does not
 * apply here: every shot is downscaled to 1,600px before upload anyway, so the
 * native camera's extra resolution was being discarded regardless.
 *
 * Still not built, deliberately: the automatic alignment check. That needs a
 * model trained on our own photo library. The outline carries the framing until
 * then, and the flow works without it.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlignmentTracker,
  buildOutlineMask,
  scoreFrame,
  type AlignmentScore,
  type OutlineMask,
} from "./alignment";
import {
  DEFAULT_SET,
  loadLookup,
  overlayUrl,
  setForVehicle,
  type BodyTypeLookup,
  type WireframeSet,
} from "./bodyType";

/**
 * Which slots have a framing overlay.
 *
 * The overlay files are the genuine capture wireframes published by Monk in
 * @monkvision/sights (BSD-3-Clause-Clear) - the same artwork their own capture
 * flow renders, taken from the package unmodified. Earlier attempts recovered
 * these from photographs of a phone screen and were never going to be right:
 * the app's own buttons sit on top of the drawing, so parts of every outline
 * were simply absent. Do not go back to extracting from screenshots.
 *
 * Exterior sights are the Toyota Sienna set (tsienna20), which is the silhouette
 * the flow uses; interior sights are vehicle-agnostic. Each file is named for the
 * slot it serves, so the filename IS the slot id.
 *
 * The overlays do NOT share one aspect ratio - the full-side views are 2048x850
 * while most others are 4:3 - so each is drawn with object-fit: contain and the
 * saved photo is the whole camera frame, exactly as the source flow does it.
 *
 * Ireland is right-hand drive, so the DRIVER side is the car's RIGHT and the
 * PASSENGER side is its LEFT. Reversing these would send every seller round the
 * wrong side of their own car.
 *
 * Slots with no entry (the four wheels, keys, service book, tax discs, seat
 * bolster and the damage close-ups) have no published sight and get no overlay.
 */
const OUTLINE = new Set([
  "out_front",
  "out_front_pass",
  "out_roof",
  "out_front_pass_close",
  "out_side_pass",
  "out_rear_pass",
  "out_rear",
  "out_rear_driver",
  "out_side_driver",
  "out_front_driver",
  "in_front_seats",
  "in_dash",
  "in_rear_seats",
  "in_screen",
  "in_boot",
  "in_console",
]);

/**
 * Bumped whenever the outline images are regenerated. It is part of the path,
 * not a query string, so a phone that cached a previous version cannot serve it:
 * the URL itself is different. A stale overlay is not a cosmetic problem - the
 * first version shipped inverted, and browsers kept showing a white sheet over
 * the camera long after the files on disk were correct.
 */
const OUTLINE_VERSION = "v6";

export interface Shot {
  id: string;
  label: string;
  hint: string;
}
export interface ShotGroup {
  name: string;
  shots: Shot[];
}

const LONG_EDGE = 1600;
const QUALITY = 0.82;

function newDraftId() {
  const s = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "td";
  const a = new Uint8Array(14);
  crypto.getRandomValues(a);
  for (const n of a) out += s[n % s.length];
  return out;
}

/** Resize + re-encode on the device. Returns a JPEG blob with no metadata. */
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, LONG_EDGE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/jpeg", QUALITY),
  );
}

/** Grab the whole current video frame, downscaled to LONG_EDGE and encoded as
 *  JPEG. Same output contract as shrink().
 *
 *  Not cropped to a fixed shape: the overlays have several different aspect
 *  ratios (the full-side sights are 2048x850, most others are 4:3), so each is
 *  drawn contained within the preview and the seller keeps everything the camera
 *  can see. Cropping to one shape would cut off part of what they lined up. */
async function grabFrame(video: HTMLVideoElement): Promise<Blob> {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) throw new Error("camera not ready");

  const scale = Math.min(1, LONG_EDGE / Math.max(vw, vh));
  const w = Math.round(vw * scale);
  const h = Math.round(vh * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  ctx.drawImage(video, 0, 0, vw, vh, 0, 0, w, h);
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/jpeg", QUALITY),
  );
}

/**
 * Full-screen live camera with the framing outline drawn over it.
 *
 * onCapture hands back a Blob; the caller uploads it through exactly the same
 * path a file-input photo takes, so there is one upload code path, not two.
 * onUnavailable fires when the browser refuses the camera - the caller then
 * falls back to the OS camera app rather than leaving the seller stuck.
 */
function CameraModal({
  shot,
  wireframeSet,
  onCapture,
  onClose,
  onUnavailable,
}: {
  shot: Shot;
  /** chosen from the seller's own reg so the outline is their body shape */
  wireframeSet: WireframeSet;
  onCapture: (b: Blob) => void;
  onClose: () => void;
  onUnavailable: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  // The templates are landscape, because the reference flow is landscape-only.
  // Held upright, the guide would be a thin strip in the middle of a black
  // screen - so ask for the phone to be turned rather than pretend it works.
  const [portrait, setPortrait] = useState(false);
  const outline = OUTLINE.has(shot.id);

  // Live alignment. The mask is built once the overlay image has loaded and then
  // reused; scoring runs on a timer rather than every animation frame, because a
  // few checks a second is plenty and it leaves the phone responsive.
  const overlayRef = useRef<HTMLImageElement | null>(null);
  const maskRef = useRef<OutlineMask | null>(null);
  // Calibrated 4 Sep 2026 on 540 real photographs. The edge check separates a
  // genuine full-side profile from anything else (90.6% of real side shots pass
  // at these numbers, and the correct outline is the top match half the time).
  // On every other sight it is no better than a coin toss - front and rear
  // silhouettes are nearly identical - so the tick is not offered there at all
  // and the outline is presented purely as a framing guide.
  // Evidence: ALIGNMENT_CALIBRATION_4SEP.md.
  const SIDE_SIGHTS = useMemo(() => new Set(["out_side_driver", "out_side_pass"]), []);
  const canJudge = SIDE_SIGHTS.has(shot.id);
  const thresholds = useMemo(
    () => ({ coverage: 0.42, lift: 1.8, stableFrames: 3 }),
    [],
  );
  const trackerRef = useRef(new AlignmentTracker());
  const [score, setScore] = useState<AlignmentScore | null>(null);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    const check = () => setPortrait(window.innerHeight > window.innerWidth);
    check();
    window.addEventListener("resize", check);
    window.addEventListener("orientationchange", check);
    return () => {
      window.removeEventListener("resize", check);
      window.removeEventListener("orientationchange", check);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setReady(true);
      } catch {
        // No camera, no permission, or an insecure context. Hand back to the
        // OS camera app instead of showing a dead black screen.
        if (!cancelled) onUnavailable();
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [onUnavailable]);

  // Score the live frame a few times a second while the camera is open and
  // there is a wireframe to line up against.
  useEffect(() => {
    // Nothing to score on a sight the check cannot judge - saves the phone the
    // work as well as saving the seller a meaningless indicator.
    if (!ready || portrait || !outline || !canJudge) return;
    let stop = false;
    const id = window.setInterval(() => {
      if (stop) return;
      const v = videoRef.current;
      const img = overlayRef.current;
      if (!v || !img || !img.naturalWidth || !v.videoWidth) return;
      try {
        if (!maskRef.current) {
          maskRef.current = buildOutlineMask(img, v.videoWidth, v.videoHeight);
        }
        const s = scoreFrame(v, maskRef.current, thresholds);
        setScore(s);
        setLocked(trackerRef.current.push(s));
      } catch {
        /* a scoring hiccup must never block taking the photo */
      }
    }, 220);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, [ready, portrait, outline, canJudge, thresholds]);

  // A new shot means a new wireframe, so throw the old mask away.
  useEffect(() => {
    maskRef.current = null;
    trackerRef.current.reset();
    setScore(null);
    setLocked(false);
  }, [shot.id, wireframeSet]);

  async function take() {
    if (!videoRef.current || busy) return;
    setBusy(true);
    try {
      onCapture(await grabFrame(videoRef.current));
    } catch {
      setBusy(false);
    }
  }

  return (
    <div style={S.camWrap} role="dialog" aria-label={shot.label}>
      <div style={S.camStage}>
        <video ref={videoRef} playsInline muted autoPlay style={S.camVideo} />
        {portrait && (
          <div style={S.camRotate}>
            <div style={S.camRotateIcon}>⟲</div>
            <div style={S.camRotateTitle}>Turn your phone sideways</div>
            <div style={S.camRotateText}>
              Car photos are landscape. The guide appears once you rotate.
            </div>
          </div>
        )}
        {outline && !portrait && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            ref={overlayRef}
            src={overlayUrl(OUTLINE_VERSION, wireframeSet, shot.id)}
            alt=""
            crossOrigin="anonymous"
            onLoad={() => {
              maskRef.current = null;
            }}
            style={{
              ...S.camOutline,
              // green once it is lined up, so the seller sees the guide itself
              // confirm rather than having to watch a separate indicator
              filter: canJudge && locked
                ? "drop-shadow(0 0 2px rgba(0,0,0,.85)) drop-shadow(0 0 6px #35d07f)"
                : S.camOutline.filter,
            }}
          />
        )}
        {outline && !portrait && (canJudge ? score !== null : true) && (
          <div style={{ ...S.camAlign, ...(locked ? S.camAlignOk : {}) }}>
            {canJudge && locked ? "✓ Lined up" : "Line the car up with the guide"}
          </div>
        )}
        {!ready && <div style={S.camWaiting}>Starting camera…</div>}
      </div>

      <div style={S.camBar}>
        <button type="button" style={S.camClose} onClick={onClose} aria-label="Close camera">
          ✕
        </button>
        <div style={S.camText}>
          <div style={S.camLabel}>{shot.label}</div>
          <div style={S.camHint}>{shot.hint}</div>
        </div>
        <button
          type="button"
          style={{ ...S.camShutter, opacity: ready && !busy && !portrait ? 1 : 0.45 }}
          disabled={!ready || busy || portrait}
          onClick={take}
          aria-label="Take the photo"
        />
      </div>
    </div>
  );
}

type SlotState = {
  status: "idle" | "working" | "done" | "error";
  url?: string;
  error?: string;
  /** Result of the after-the-fact "is this the right part of the car" check.
   *  Advisory only - it never blocks a photo or the submission. */
  check?: { state: "checking" | "ok" | "wrong" | "unclear" | "off"; seen?: string; note?: string };
};

export default function PhotoCapture({
  groups,
  onProgress,
  vehicle,
}: {
  groups: ShotGroup[];
  onProgress?: (done: number, total: number) => void;
  /** make and model from the reg lookup, so the wireframe matches their car */
  vehicle?: { make?: string | null; model?: string | null } | null;
}) {
  const total = groups.reduce((n, g) => n + g.shots.length, 0);
  // slot id -> its label and hint, so the checker can tell the model what the
  // photo was supposed to be without duplicating the shot list.
  const ALL_SHOTS = useMemo(() => {
    const m = new Map<string, Shot>();
    for (const g of groups) for (const s of g.shots) m.set(s.id, s);
    return m;
  }, [groups]);
  const [draftId, setDraftId] = useState<string>("");
  const [slots, setSlots] = useState<Record<string, SlotState>>({});
  const [damage, setDamage] = useState<string[]>([]);
  const [restoring, setRestoring] = useState(true);
  // The guided shot currently open in the live camera, if any.
  const [camera, setCamera] = useState<Shot | null>(null);

  // Which body-shape wireframe to draw. Resolved from the reg the seller already
  // typed: make+model -> body type (our own Carzone capture) -> Monk set. Falls
  // back to a crossover, which is the least wrong single shape for Irish stock.
  const [wireframeSet, setWireframeSet] = useState<WireframeSet>(DEFAULT_SET);
  const [bodyType, setBodyType] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    loadLookup().then((lookup: BodyTypeLookup | null) => {
      if (!live) return;
      const r = setForVehicle(lookup, vehicle?.make, vehicle?.model);
      setWireframeSet(r.set);
      setBodyType(r.bodyType);
    });
    return () => {
      live = false;
    };
  }, [vehicle?.make, vehicle?.model]);
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  // One draft per seller, kept across reloads so a dropped connection or a
  // locked phone does not lose the shots already taken.
  useEffect(() => {
    let id = "";
    try {
      id = localStorage.getItem("tradein_draft") || "";
    } catch {}
    if (!id) {
      id = newDraftId();
      try {
        localStorage.setItem("tradein_draft", id);
      } catch {}
    }
    setDraftId(id);
  }, []);

  // Restore from the SERVER, not from local state - the question is what is
  // actually stored, not what this tab remembers.
  useEffect(() => {
    if (!draftId) return;
    (async () => {
      try {
        const r = await fetch(`/api/tradein-photo?draftId=${draftId}`);
        const j = await r.json();
        const next: Record<string, SlotState> = {};
        const dmg: string[] = [];
        for (const s of j.slots || []) {
          const url = `/api/tradein-photo?draftId=${draftId}&slot=${s.slot}&t=${Date.parse(s.takenAt)}`;
          next[s.slot] = { status: "done", url };
          if (s.slot.startsWith("damage")) dmg.push(s.slot);
        }
        setSlots(next);
        setDamage(dmg.sort());
      } catch {
        /* a failed restore must not block taking new photos */
      }
      setRestoring(false);
    })();
  }, [draftId]);

  const done = Object.entries(slots).filter(
    ([k, v]) => v.status === "done" && !k.startsWith("damage"),
  ).length;

  useEffect(() => {
    onProgress?.(done, total);
  }, [done, total, onProgress]);

  // One upload path for both sources. The live camera hands over an
  // already-sized JPEG; the file input hands over a raw phone photo that
  // shrink() has just processed. Everything after that is identical.
  const uploadBlob = useCallback(
    async (slotId: string, blob: Blob) => {
      setSlots((s) => ({ ...s, [slotId]: { status: "working" } }));
      try {
        const fd = new FormData();
        fd.append("draftId", draftId);
        fd.append("slot", slotId);
        fd.append("photo", new File([blob], `${slotId}.jpg`, { type: "image/jpeg" }));
        const r = await fetch("/api/tradein-photo", { method: "POST", body: fd });
        const j = await r.json();
        if (!j.ok) throw new Error(j.error || "upload failed");
        setSlots((s) => ({
          ...s,
          [slotId]: { status: "done", url: `${j.url}&t=${Date.now()}`, check: { state: "checking" } },
        }));
        // Judge the shot in the background. Deliberately not awaited: the seller
        // moves on to the next angle immediately, and the answer lands a second
        // or two later while they are still at the car. A failure here is
        // silent by design - the photo is already saved.
        void checkShot(slotId);
      } catch (e) {
        setSlots((s) => ({
          ...s,
          [slotId]: { status: "error", error: e instanceof Error ? e.message : "failed" },
        }));
      }
    },
    [draftId],
  );

  // Ask the server whether the photo actually shows the part of the car it is
  // meant to. The in-camera outline is a framing guide only - it was measured
  // on 540 real photographs (4 Sep 2026) and cannot tell a front from a rear,
  // because those silhouettes are nearly identical. This can, because it looks
  // at the picture rather than its edges.
  const checkShot = useCallback(
    async (slotId: string) => {
      const shot = ALL_SHOTS.get(slotId);
      try {
        const r = await fetch("/api/tradein-photo-check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            draftId,
            slot: slotId,
            label: shot?.label ?? slotId,
            hint: shot?.hint ?? "",
          }),
        });
        const j = await r.json();
        const v = j?.verdict;
        const state =
          v === "ok" ? "ok" : v === "wrong" ? "wrong" : v === "unclear" ? "unclear" : "off";
        setSlots((s) =>
          s[slotId]?.status === "done"
            ? { ...s, [slotId]: { ...s[slotId], check: { state, seen: j?.seen, note: j?.note } } }
            : s,
        );
      } catch {
        // Never turn a network hiccup into a complaint about the seller's photo.
        setSlots((s) =>
          s[slotId]?.status === "done"
            ? { ...s, [slotId]: { ...s[slotId], check: { state: "off" } } }
            : s,
        );
      }
    },
    [draftId, groups],
  );

  const upload = useCallback(
    async (slotId: string, file: File) => {
      setSlots((s) => ({ ...s, [slotId]: { status: "working" } }));
      try {
        await uploadBlob(slotId, await shrink(file));
      } catch (e) {
        setSlots((s) => ({
          ...s,
          [slotId]: { status: "error", error: e instanceof Error ? e.message : "failed" },
        }));
      }
    },
    [uploadBlob],
  );

  async function remove(slotId: string) {
    await fetch(`/api/tradein-photo?draftId=${draftId}&slot=${slotId}`, { method: "DELETE" });
    setSlots((s) => {
      const n = { ...s };
      delete n[slotId];
      return n;
    });
    if (slotId.startsWith("damage")) setDamage((d) => d.filter((x) => x !== slotId));
  }

  function Tile({ shot }: { shot: Shot }) {
    const st = slots[shot.id] || { status: "idle" as const };
    return (
      <div style={{ ...S.tile, ...(st.status === "done" ? S.tileDone : {}) }}>
        <input
          ref={(el) => {
            inputs.current[shot.id] = el;
          }}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(shot.id, f);
            e.target.value = "";
          }}
        />
        {st.status === "done" && st.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={st.url} alt={shot.label} style={S.thumb} />
        ) : (
          <div style={S.thumbEmpty}>{st.status === "working" ? "Uploading…" : "📷"}</div>
        )}
        <div style={S.tileBody}>
          <div style={S.tileLabel}>
            {st.status === "done" ? "✓ " : ""}
            {shot.label}
          </div>
          <div style={S.tileHint}>{shot.hint}</div>
          {st.status === "error" && <div style={S.err}>{st.error} — tap to try again</div>}
          {st.status === "done" && st.check && st.check.state !== "off" && (
            <div
              style={{
                ...S.checkChip,
                ...(st.check.state === "ok"
                  ? S.checkOk
                  : st.check.state === "wrong"
                    ? S.checkWrong
                    : st.check.state === "unclear"
                      ? S.checkUnclear
                      : {}),
              }}
            >
              {st.check.state === "checking" && "Checking the shot…"}
              {st.check.state === "ok" && `✓ Looks right${st.check.seen ? ` — ${st.check.seen}` : ""}`}
              {st.check.state === "wrong" &&
                `This looks like ${st.check.seen || "a different shot"}. Worth retaking.`}
              {st.check.state === "unclear" &&
                `Hard to tell${st.check.seen ? ` — ${st.check.seen}` : ""}. Retake if you can.`}
            </div>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: "auto", paddingTop: 8 }}>
            <button
              type="button"
              style={S.tileBtn}
              disabled={st.status === "working"}
              onClick={() => {
                // Guided shots get the live camera and its outline. Anything
                // without a fixed angle goes straight to the OS camera app.
                if (OUTLINE.has(shot.id)) setCamera(shot);
                else inputs.current[shot.id]?.click();
              }}
            >
              {st.status === "done" ? "Retake" : "Take photo"}
            </button>
            {st.status === "done" && (
              <button type="button" style={S.tileBtnGhost} onClick={() => remove(shot.id)}>
                Remove
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!draftId || restoring) return <div style={S.sm}>Loading your photos…</div>;

  return (
    <div>
      <div style={S.progressWrap}>
        <div style={S.progressBar}>
          <div style={{ ...S.progressFill, width: `${(done / total) * 100}%` }} />
        </div>
        <div style={S.progressText}>
          <strong>
            {done} of {total}
          </strong>{" "}
          guided shots done
          {done === total && " — that's the full set"}
        </div>
        {bodyType && (
          <div style={S.sm}>
            Guides are shaped for a {bodyType.toLowerCase()}, matched from your reg.
          </div>
        )}
      </div>

      {groups.map((g) => (
        <div key={g.name} style={S.group}>
          <div style={S.groupHead}>
            {g.name}
            <span style={S.groupCount}>
              {g.shots.filter((s) => slots[s.id]?.status === "done").length}/{g.shots.length}
            </span>
          </div>
          <div style={S.tiles}>
            {g.shots.map((s) => (
              <Tile key={s.id} shot={s} />
            ))}
          </div>
        </div>
      ))}

      <div style={S.group}>
        <div style={S.groupHead}>
          Damage, wear and warning lights
          <span style={S.groupCount}>{damage.length}</span>
        </div>
        <div style={S.sm}>
          Every scratch, dent, stone chip, kerbed wheel and warning light, photographed close.
          A dealer who has already seen the damage cannot use it to cut the price on the day.
          Add as many as you need.
        </div>
        <div style={S.tiles}>
          {damage.map((id) => (
            <Tile key={id} shot={{ id, label: "Damage close-up", hint: "Get close enough to judge it" }} />
          ))}
          <div style={{ ...S.tile, ...S.tileAdd }}>
            <button
              type="button"
              style={S.addBtn}
              onClick={() => {
                const id = `damage${String(Date.now()).slice(-9)}`;
                setDamage((d) => [...d, id]);
                setTimeout(() => inputs.current[id]?.click(), 50);
              }}
            >
              + Add a damage photo
            </button>
          </div>
        </div>
      </div>

      <p style={S.sm}>
        Photos upload as you take them, so you can stop and come back. Your phone&rsquo;s
        location data is never sent.
      </p>

      {camera && (
        <CameraModal
          shot={camera}
          wireframeSet={wireframeSet}
          onClose={() => setCamera(null)}
          onCapture={(blob) => {
            const id = camera.id;
            setCamera(null);
            uploadBlob(id, blob);
          }}
          onUnavailable={() => {
            // Camera refused. Close the modal and open the OS camera app so the
            // seller is never left staring at a dead screen.
            const id = camera.id;
            setCamera(null);
            setTimeout(() => inputs.current[id]?.click(), 60);
          }}
        />
      )}
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  sm: { fontSize: 13, color: "#666", lineHeight: 1.5, margin: "6px 0 10px" },
  progressWrap: { margin: "4px 0 18px" },
  progressBar: { height: 8, background: "#eee", borderRadius: 99, overflow: "hidden" },
  progressFill: { height: "100%", background: "#0a7d33", transition: "width .3s" },
  progressText: { fontSize: 13, color: "#444", marginTop: 6 },
  group: { margin: "18px 0" },
  groupHead: {
    fontSize: 12,
    letterSpacing: ".08em",
    textTransform: "uppercase",
    color: "#888",
    fontWeight: 700,
    marginBottom: 8,
    display: "flex",
    justifyContent: "space-between",
  },
  groupCount: { color: "#0a7d33" },
  tiles: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 10 },
  tile: { border: "1px solid #e2e2e2", borderRadius: 10, overflow: "hidden", background: "#fff", display: "flex", flexDirection: "column" },
  tileDone: { borderColor: "#0a7d33" },
  tileAdd: { display: "flex", alignItems: "center", justifyContent: "center", minHeight: 150, borderStyle: "dashed" },
  thumb: { width: "100%", height: 96, objectFit: "cover", display: "block", background: "#f4f4f4" },
  thumbEmpty: {
    height: 96,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f7f7f7",
    fontSize: 22,
    color: "#bbb",
  },
  tileBody: { padding: "8px 9px 10px", display: "flex", flexDirection: "column", flex: 1 },
  tileLabel: { fontSize: 13, fontWeight: 600, lineHeight: 1.25, minHeight: 33 },
  tileHint: { fontSize: 11.5, color: "#777", marginTop: 3, lineHeight: 1.35, minHeight: 63 },
  tileBtn: {
    fontSize: 12,
    padding: "6px 10px",
    borderRadius: 6,
    border: "1px solid #1a1a1a",
    background: "#1a1a1a",
    color: "#fff",
    cursor: "pointer",
  },
  tileBtnGhost: {
    fontSize: 12,
    padding: "6px 10px",
    borderRadius: 6,
    border: "1px solid #ccc",
    background: "#fff",
    color: "#555",
    cursor: "pointer",
  },
  addBtn: {
    fontSize: 13,
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid #1a1a1a",
    background: "#fff",
    cursor: "pointer",
  },
  checkChip: {
    marginTop: 6,
    padding: "5px 8px",
    borderRadius: 6,
    fontSize: 12,
    lineHeight: 1.35,
    background: "#eef1f4",
    color: "#41474d",
  } as const,
  checkOk: { background: "#e8f6ec", color: "#14612c" } as const,
  checkWrong: { background: "#fdeceb", color: "#8f0809" } as const,
  checkUnclear: { background: "#fdf4e3", color: "#7a5a12" } as const,
  err: { fontSize: 11.5, color: "#b30000", marginTop: 4 },

  // Live camera. Fixed and full-viewport: on a phone this is the whole screen,
  // which is what a camera should be.
  camWrap: {
    position: "fixed",
    inset: 0,
    zIndex: 9999,
    background: "#000",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
  },
  // Fills the screen rather than sitting in a letterbox. Held sideways, a phone
  // screen is about 1.78:1 and the templates are 1.785:1, so the guide lines up
  // with the frame that actually gets saved. Held upright it does not, which is
  // why the shutter is disabled and a rotate prompt appears instead.
  camStage: {
    position: "relative",
    flex: 1,
    width: "100%",
    background: "#000",
    overflow: "hidden",
  },
  camVideo: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
  camOutline: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "contain",
    pointerEvents: "none",
    opacity: 0.92,
    // A dark halo so white line work stays readable against a white car in
    // direct sun.
    filter: "drop-shadow(0 0 2px rgba(0,0,0,.85))",
  },
  camWaiting: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    fontSize: 14,
  },
  camRotate: {
    position: "absolute",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 24,
    textAlign: "center",
    color: "#fff",
    background: "rgba(0,0,0,.72)",
  },
  // Alignment readout. Sits at the top so it never fights the shot label or the
  // shutter for space.
  camAlign: {
    position: "absolute",
    top: 12,
    left: "50%",
    transform: "translateX(-50%)",
    padding: "6px 14px",
    borderRadius: 99,
    fontSize: 13,
    fontWeight: 600,
    color: "#fff",
    background: "rgba(0,0,0,.55)",
    border: "1px solid rgba(255,255,255,.25)",
    whiteSpace: "nowrap",
    pointerEvents: "none",
  },
  camAlignOk: {
    background: "rgba(20,120,60,.85)",
    borderColor: "#35d07f",
  },
  camRotateIcon: { fontSize: 46, lineHeight: 1 },
  camRotateTitle: { fontSize: 19, fontWeight: 700 },
  camRotateText: { fontSize: 13.5, opacity: 0.85, maxWidth: 320, lineHeight: 1.45 },
  camBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: "14px 16px calc(14px + env(safe-area-inset-bottom))",
    display: "flex",
    alignItems: "center",
    gap: 14,
    background: "linear-gradient(to top, rgba(0,0,0,.85), rgba(0,0,0,0))",
  },
  camClose: {
    flex: "0 0 auto",
    width: 42,
    height: 42,
    borderRadius: 99,
    border: "1px solid rgba(255,255,255,.35)",
    background: "rgba(0,0,0,.45)",
    color: "#fff",
    fontSize: 17,
    cursor: "pointer",
  },
  camText: { flex: 1, minWidth: 0, color: "#fff" },
  camLabel: { fontSize: 15, fontWeight: 700, lineHeight: 1.2 },
  camHint: { fontSize: 12, opacity: 0.82, marginTop: 2, lineHeight: 1.3 },
  camShutter: {
    flex: "0 0 auto",
    width: 68,
    height: 68,
    borderRadius: 99,
    border: "5px solid rgba(255,255,255,.9)",
    background: "#fff",
    cursor: "pointer",
  },
};
