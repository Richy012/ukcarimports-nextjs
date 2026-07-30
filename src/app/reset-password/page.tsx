import type { Metadata } from "next";
import ResetPasswordForm from "./ResetPasswordForm";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Reset Password",
  description: "Choose a new password for your UK Car Imports account.",
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const u = typeof params.u === "string" ? params.u : "";
  const t = typeof params.t === "string" ? params.t : "";
  const e = typeof params.e === "string" ? params.e : "";

  return (
    <main className={`${styles.page} wm-light`}>
      <h1 className={styles.heading}>Choose a new password</h1>
      <ResetPasswordForm u={u} t={t} e={e} />
    </main>
  );
}
