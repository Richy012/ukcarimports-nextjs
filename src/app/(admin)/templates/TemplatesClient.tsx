"use client";

import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import { staffAuthHeaders } from "@/lib/auth";
import styles from "./page.module.css";

interface Template {
  template_key: string;
  name: string;
  subject: string;
  body: string;
  updated_at: string;
}

export default function TemplatesClient() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { subject: string; body: string }>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/staff-email-templates", { headers: staffAuthHeaders() })
      .then((res) => res.json())
      .then((data) => setTemplates(data?.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  function openTemplate(tpl: Template) {
    setOpenKey((prev) => (prev === tpl.template_key ? null : tpl.template_key));
    setDrafts((prev) => ({
      ...prev,
      [tpl.template_key]: prev[tpl.template_key] ?? { subject: tpl.subject, body: tpl.body },
    }));
  }

  function save(key: string) {
    const draft = drafts[key];
    if (!draft) return;
    setSaving(key);
    fetch(`/api/staff-email-template/${key}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...staffAuthHeaders() },
      body: JSON.stringify(draft),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data?.ResponseCode == 1) {
          setTemplates((prev) =>
            prev.map((t) => (t.template_key === key ? { ...t, ...draft } : t))
          );
          setSavedKey(key);
          setTimeout(() => setSavedKey(null), 2500);
        } else {
          alert(data?.ResponseText || "Save failed");
        }
      })
      .finally(() => setSaving(null));
  }

  return (
    <>
      <h1 className={styles.heading}>Email templates</h1>
      <p className={styles.introText}>
        These templates drive the &quot;Generate email&quot; buttons on the Cars page. Anything inside{" "}
        <code>{"{{double_braces}}"}</code> becomes a fill-in field when generating — keep the braces intact
        when editing the wording around them.
      </p>

      {loading && <p>Loading...</p>}

      {templates.map((tpl) => {
        const isOpen = openKey === tpl.template_key;
        const draft = drafts[tpl.template_key];
        return (
          <div key={tpl.template_key} className={styles.tplCard}>
            <button type="button" className={styles.tplHeader} onClick={() => openTemplate(tpl)}>
              <span className={styles.tplName}>{tpl.name}</span>
              <span className={styles.tplMeta}>
                last edited {tpl.updated_at?.slice(0, 10) ?? "-"} {isOpen ? "▴" : "▾"}
              </span>
            </button>

            {isOpen && draft && (
              <div className={styles.tplEditor}>
                <label className={styles.tplField}>
                  <span>Subject</span>
                  <input
                    type="text"
                    value={draft.subject}
                    onChange={(e) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [tpl.template_key]: { ...draft, subject: e.target.value },
                      }))
                    }
                  />
                </label>
                <label className={styles.tplField}>
                  <span>Body</span>
                  <textarea
                    rows={16}
                    value={draft.body}
                    onChange={(e) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [tpl.template_key]: { ...draft, body: e.target.value },
                      }))
                    }
                  />
                </label>
                <button
                  type="button"
                  className={styles.tplSave}
                  disabled={saving === tpl.template_key}
                  onClick={() => save(tpl.template_key)}
                >
                  {saving === tpl.template_key
                    ? "Saving..."
                    : savedKey === tpl.template_key
                      ? <><Check size={14} strokeWidth={2} aria-hidden="true" style={{ verticalAlign: "-2px" }} /> Saved</>
                      : "Save template"}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
