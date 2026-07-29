"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clearToken } from "@/lib/auth";
import styles from "./layout.module.css";

const NAV_ITEMS = [
  { href: "/my-account/saved-cars", label: "Saved Cars", icon: "♡" },
  { href: "/my-account/saved-searches", label: "Saved Searches", icon: "🔍" },
  { href: "/my-account/notifications", label: "Notifications", icon: "🔔" },
];

export default function MyAccountLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  function handleLogout() {
    clearToken();
    window.location.href = "/";
  }

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <h2 className={styles.sidebarHeading}>My Account</h2>
        <nav className={styles.nav}>
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={pathname === item.href ? styles.navLinkActive : styles.navLink}
            >
              <span className={styles.navIcon} aria-hidden="true">{item.icon}</span>
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
