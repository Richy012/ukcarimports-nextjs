"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { clearStaffToken, isAdminTokenValid } from "@/lib/auth";
import styles from "./layout.module.css";

// Only Dashboard is real so far -- more admin sections get added here as
// each one is actually built, same convention as MyAccountLayout's nav list.
const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/cars", label: "Cars" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!isAdminTokenValid()) {
      window.location.href = "/staff-login";
      return;
    }
    setChecked(true);
  }, []);

  function handleLogout() {
    clearStaffToken();
    window.location.href = "/staff-login";
  }

  // Avoid flashing real admin data before the redirect above fires.
  if (!checked) return null;

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <h2 className={styles.sidebarHeading}>Admin</h2>
        <nav className={styles.nav}>
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={pathname === item.href ? styles.navLinkActive : styles.navLink}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <button type="button" className={styles.logoutBtn} onClick={handleLogout}>
          Log out
        </button>
      </aside>
      <div className={styles.content}>{children}</div>
    </div>
  );
}
