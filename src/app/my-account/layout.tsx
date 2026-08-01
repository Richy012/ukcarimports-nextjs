"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BellRing, Heart, LogOut, Search, type LucideIcon } from "lucide-react";
import { clearToken } from "@/lib/auth";
import styles from "./layout.module.css";

// Same Lucide icon family as the How It Works journey (site-wide icon language).
const NAV_ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/my-account/saved-cars", label: "Saved Cars", icon: Heart },
  { href: "/my-account/saved-searches", label: "Saved Searches", icon: Search },
  { href: "/my-account/notifications", label: "Notifications", icon: BellRing },
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
              <span className={styles.navIcon} aria-hidden="true">
                <item.icon size={16} strokeWidth={1.75} style={{ verticalAlign: "-3px" }} />
              </span>
              {item.label}
            </Link>
          ))}
        </nav>
        <button type="button" className={styles.logoutBtn} onClick={handleLogout}>
          <LogOut size={15} strokeWidth={1.75} aria-hidden="true" style={{ verticalAlign: "-3px", marginRight: 8 }} />
          Log out
        </button>
      </aside>
      <div className={styles.content}>{children}</div>
    </div>
  );
}
