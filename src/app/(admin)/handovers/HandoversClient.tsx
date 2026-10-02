"use client";

import { useEffect, useRef, useState } from "react";
import { staffAuthHeaders } from "@/lib/auth";
import styles from "./page.module.css";

// Owner, 2 Oct 2026: "a sign off app/page ... take a picture of the car and
// person I hand over to and for them to sign". Built for a phone at the
// handover: two camera shots, a signature on the screen, saved with the
// server's time. Records are never edited or deleted from here.

interface Handover {
  id: string;
  createdAt: string;
  customerName: string;
  reg: string;
  car: string;
  mileage: string;
  notes: string;
  declaration: string;
}

const DECLARATION =
  "I confirm I have taken delivery of the vehicle above, with its keys and documents, on the date and time shown.";

function when(iso: string): string {
  return new Date(iso).toLocaleString("en-IE", {
    timeZone: "Europe/Dublin",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Shrink a camera photo to 1600px and re-encode as JPEG. Re-encoding through a
// canvas also drops the EXIF block, GPS included.
async function shrink(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("could not read that photo"));
      i.src = url;
    });
    const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * scale);
    c.height = Math.round(img.naturalHeight * scale);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return await new Promise<Blob>((resolve, reject) =>
      c.toBlob((b) => (b ? resolve(b) : reject(new Error("could not encode photo"))), "image/jpeg", 0.85),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

function PhotoField({ label, blob, onPick }: { label: string; blob: Blob | null; onPick: (b: Blob) => void }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    if (!blob) return setPreview(null);
    const u = URL.createObjectURL(blob);
    setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return (
    <div className={styles.field}>
      <span className={styles.label}>{label}</span>
      <label className={styles.photoBox}>
        {preview ? <img src={preview} alt={label} className={styles.photoPreview} /> : <span>Tap to take photo</span>}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className={styles.hiddenInput}
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            try {
              setErr("");
              onPick(await shrink(f));
            } catch (x) {
              setErr((x as Error).message);
            }
          }}
        />
      </label>
      {preview && <span className={styles.sub}>Tap the photo to retake it.</span>}
      {err && <span className={styles.error}>{err}</span>}
    </div>
  );
}

function SignaturePad({ onChange }: { onChange: (has: boolean) => void; }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const c = ref.current!;
    const ratio = window.devicePixelRatio || 1;
    c.width = c.offsetWidth * ratio;
    c.height = c.offsetHeight * ratio;
    const ctx = c.getContext("2d")!;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111";
  }, []);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const r = ref.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function clear() {
    const c = ref.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    onChange(false);
  }

  return (
    <div className={styles.field}>
      <span className={styles.label}>Customer signature</span>
      <canvas
        ref={ref}
        id="handover-signature"
        className={styles.sigPad}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drawing.current = true;
          last.current = pos(e);
          const ctx = ref.current!.getContext("2d")!;
          ctx.beginPath();
          ctx.arc(last.current.x, last.current.y, 1.2, 0, Math.PI * 2);
          ctx.fillStyle = "#111";
          ctx.fill();
          onChange(true);
        }}
        onPointerMove={(e) => {
          if (!drawing.current || !last.current) return;
          const p = pos(e);
          const ctx = ref.current!.getContext("2d")!;
          ctx.beginPath();
          ctx.moveTo(last.current.x, last.current.y);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
          last.current = p;
        }}
        onPointerUp={() => {
          drawing.current = false;
          last.current = null;
        }}
        onPointerCancel={() => {
          drawing.current = false;
          last.current = null;
        }}
      />
      <button type="button" className={styles.linkBtn} onClick={clear}>
        Clear signature
      </button>
    </div>
  );
}

function NewHandover({ onDone, onCancel }: { onDone: (h: Handover) => void; onCancel: () => void }) {
  const [customerName, setCustomerName] = useState("");
  const [reg, setReg] = useState("");
  const [car, setCar] = useState("");
  const [mileage, setMileage] = useState("");
  const [notes, setNotes] = useState("");
  const [carPhoto, setCarPhoto] = useState<Blob | null>(null);
  const [personPhoto, setPersonPhoto] = useState<Blob | null>(null);
  const [signed, setSigned] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const missing = [
    !customerName.trim() && "customer name",
    !carPhoto && "photo of the car",
    !personPhoto && "photo of the customer",
    !signed && "signature",
  ].filter(Boolean) as string[];

  async function save() {
    if (missing.length) return setErr("Still needed: " + missing.join(", ") + ".");
    setSaving(true);
    setErr("");
    try {
      const sig = await new Promise<Blob>((resolve, reject) =>
        (document.getElementById("handover-signature") as HTMLCanvasElement).toBlob(
          (b) => (b ? resolve(b) : reject(new Error("could not read the signature"))),
          "image/png",
        ),
      );
      const fd = new FormData();
      fd.append("customerName", customerName);
      fd.append("reg", reg);
      fd.append("car", car);
      fd.append("mileage", mileage);
      fd.append("notes", notes);
      fd.append("carPhoto", carPhoto!, "car.jpg");
      fd.append("personPhoto", personPhoto!, "person.jpg");
      fd.append("signature", sig, "signature.png");
      const res = await fetch("/api/staff-handovers", { method: "POST", headers: staffAuthHeaders(), body: fd });
      const data = await res.json().catch(() => null);
      if (!data?.ok) throw new Error(data?.error || "Save failed - check signal and press Save again.");
      onDone(data.handover);
    } catch (x) {
      setErr((x as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.form}>
      <div className={styles.field}>
        <span className={styles.label}>Customer name *</span>
        <input className={styles.input} value={customerName} onChange={(e) => setCustomerName(e.target.value)} autoComplete="off" />
      </div>
      <div className={styles.row2}>
        <div className={styles.field}>
          <span className={styles.label}>Registration</span>
          <input className={styles.input} value={reg} onChange={(e) => setReg(e.target.value)} autoComplete="off" />
        </div>
        <div className={styles.field}>
          <span className={styles.label}>Mileage</span>
          <input className={styles.input} value={mileage} onChange={(e) => setMileage(e.target.value)} inputMode="numeric" />
        </div>
      </div>
      <div className={styles.field}>
        <span className={styles.label}>Car (make and model)</span>
        <input className={styles.input} value={car} onChange={(e) => setCar(e.target.value)} autoComplete="off" />
      </div>
      <div className={styles.field}>
        <span className={styles.label}>Notes</span>
        <textarea className={styles.input} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <div className={styles.row2}>
        <PhotoField label="Photo of the car *" blob={carPhoto} onPick={setCarPhoto} />
        <PhotoField label="Photo of the customer *" blob={personPhoto} onPick={setPersonPhoto} />
      </div>

      <p className={styles.declaration}>{DECLARATION}</p>
      <SignaturePad onChange={setSigned} />

      {err && <p className={styles.error}>{err}</p>}
      <div className={styles.actions}>
        <button type="button" className={styles.primaryBtn} onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save handover"}
        </button>
        <button type="button" className={styles.secondaryBtn} onClick={onCancel} disabled={saving}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function StaffImage({ id, f, alt, className }: { id: string; f: string; alt: string; className: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let url: string | null = null;
    fetch(`/api/staff-handover-file?id=${encodeURIComponent(id)}&f=${f}`, { headers: staffAuthHeaders() })
      .then((r) => (r.ok ? r.blob() : null))
      .then((b) => {
        if (b) {
          url = URL.createObjectURL(b);
          setSrc(url);
        }
      });
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [id, f]);
  return src ? <img src={src} alt={alt} className={className} /> : <div className={className} />;
}

function HandoverRecord({ h, onBack }: { h: Handover; onBack: () => void }) {
  return (
    <div>
      <div className={`${styles.actions} ${styles.noPrint}`}>
        <button type="button" className={styles.secondaryBtn} onClick={onBack}>
          ← All handovers
        </button>
        <button type="button" className={styles.primaryBtn} onClick={() => window.print()}>
          Print / save as PDF
        </button>
      </div>
      <div className={styles.printArea}>
        <h2 className={styles.recordTitle}>UK Car Imports — vehicle handover</h2>
        <dl className={styles.facts}>
          <dt>Date and time</dt>
          <dd>{when(h.createdAt)}</dd>
          <dt>Customer</dt>
          <dd>{h.customerName}</dd>
          {h.reg && (<><dt>Registration</dt><dd>{h.reg}</dd></>)}
          {h.car && (<><dt>Car</dt><dd>{h.car}</dd></>)}
          {h.mileage && (<><dt>Mileage</dt><dd>{h.mileage}</dd></>)}
          {h.notes && (<><dt>Notes</dt><dd>{h.notes}</dd></>)}
        </dl>
        <div className={styles.recordPhotos}>
          <StaffImage id={h.id} f="car" alt="The car" className={styles.recordPhoto} />
          <StaffImage id={h.id} f="person" alt="The customer" className={styles.recordPhoto} />
        </div>
        <p className={styles.declaration}>{h.declaration}</p>
        <StaffImage id={h.id} f="signature" alt="Signature" className={styles.recordSig} />
        <p className={styles.sub}>{`Signed by ${h.customerName} · ${when(h.createdAt)} · ref ${h.id}`}</p>
      </div>
    </div>
  );
}

export default function HandoversClient() {
  const [rows, setRows] = useState<Handover[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"list" | "new" | "view">("list");
  const [current, setCurrent] = useState<Handover | null>(null);

  function load() {
    setLoading(true);
    fetch("/api/staff-handovers", { headers: staffAuthHeaders() })
      .then((r) => r.json())
      .then((d) => setRows(d?.handovers ?? []))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  if (mode === "new")
    return (
      <div>
        <h1 className={styles.heading}>New handover</h1>
        <NewHandover
          onCancel={() => setMode("list")}
          onDone={(h) => {
            setCurrent(h);
            setMode("view");
            load();
          }}
        />
      </div>
    );

  if (mode === "view" && current) return <HandoverRecord h={current} onBack={() => setMode("list")} />;

  return (
    <div>
      <div className={styles.headerRow}>
        <h1 className={styles.heading}>Handovers</h1>
        <button type="button" className={styles.primaryBtn} onClick={() => setMode("new")}>
          + New handover
        </button>
      </div>
      {loading ? (
        <p className={styles.sub}>Loading…</p>
      ) : rows.length === 0 ? (
        <p className={styles.sub}>No handovers yet.</p>
      ) : (
        <div className={styles.list}>
          {rows.map((h) => (
            <button
              type="button"
              key={h.id}
              className={styles.listRow}
              onClick={() => {
                setCurrent(h);
                setMode("view");
              }}
            >
              <strong>{h.customerName}</strong>
              <span>{[h.reg, h.car].filter(Boolean).join(" · ") || "—"}</span>
              <span className={styles.sub}>{when(h.createdAt)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
