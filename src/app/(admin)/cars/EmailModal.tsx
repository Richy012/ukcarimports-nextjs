"use client";

import { useEffect, useMemo, useState } from "react";
import { staffAuthHeaders } from "@/lib/auth";
import styles from "./page.module.css";

interface Template {
  template_key: string;
  name: string;
  subject: string;
  body: string;
}

// Turns {{placeholders}} into their current values for the live preview;
// unfilled fields render as [field_name] so gaps are visible at a glance.
function render(text: string, values: Record<string, string>): string {
  return text.replace(/\{\{([a-z0-9_]+)\}\}/g, (_, key) => {
    const v = values[key];
    return v && v.trim() !== "" ? v : `[${key}]`;
  });
}

function extractFields(template: Template): string[] {
  const found = new Set<string>();
  for (const match of (template.subject + " " + template.body).matchAll(/\{\{([a-z0-9_]+)\}\}/g)) {
    found.add(match[1]);
  }
  return Array.from(found);
}

export default function EmailModal({
  carId,
  templateKey,
  onClose,
}: {
  carId: string;
  templateKey: string;
  onClose: () => void;
}) {
  const [template, setTemplate] = useState<Template | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetch("/api/staff-email-templates", { headers: staffAuthHeaders() }).then((r) => r.json()),
      fetch(`/api/staff-email-merge/${carId}`, { headers: staffAuthHeaders() }).then((r) => r.json()),
    ])
      .then(([tplData, mergeData]) => {
        if (cancelled) return;
        const tpl = (tplData?.data ?? []).find((t: Template) => t.template_key === templateKey) ?? null;
        setTemplate(tpl);
        if (tpl) {
          const merge = mergeData?.data ?? {};
          const initial: Record<string, string> = {};
          for (const field of extractFields(tpl)) {
            initial[field] = merge[field] ?? "";
          }
          setValues(initial);
        }
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [carId, templateKey]);

  const fields = useMemo(() => (template ? extractFields(template) : []), [template]);

  function copyAll() {
    if (!template) return;
    const text = `Subject: ${render(template.subject, values)}\n\n${render(template.body, values)}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
        {loading && <p>Loading template...</p>}
        {!loading && !template && <p>Template not found.</p>}
        {!loading && template && (
          <>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>{template.name}</h2>
              <button type="button" className={styles.modalClose} onClick={onClose} aria-label="Close">
                &times;
              </button>
            </div>

            <div className={styles.modalColumns}>
              <div className={styles.modalFields}>
                <p className={styles.detailLabel}>Fill in the details</p>
                {fields.map((field) => (
                  <label key={field} className={styles.modalField}>
                    <span>{field.replace(/_/g, " ")}</span>
                    {field.includes("notes") || field.includes("findings") || field.includes("description") ? (
                      <textarea
                        rows={3}
                        value={values[field] ?? ""}
                        onChange={(e) => setValues((prev) => ({ ...prev, [field]: e.target.value }))}
                      />
                    ) : (
                      <input
                        type="text"
                        value={values[field] ?? ""}
                        onChange={(e) => setValues((prev) => ({ ...prev, [field]: e.target.value }))}
                      />
                    )}
                  </label>
                ))}
              </div>

              <div className={styles.modalPreview}>
                <p className={styles.detailLabel}>Preview</p>
                <p className={styles.previewSubject}>{render(template.subject, values)}</p>
                <pre className={styles.previewBody}>{render(template.body, values)}</pre>
              </div>
            </div>

            <div className={styles.modalActions}>
              <button type="button" className={styles.actionBtn} onClick={copyAll}>
                {copied ? "✓ Copied to clipboard" : "Copy email to clipboard"}
              </button>
              <span className={styles.modalHint}>
                Edit the template wording itself under Admin &rarr; Templates.
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
