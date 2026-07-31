"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CarFront,
  FileText,
  HandCoins,
  LayoutDashboard,
  LogOut,
  Scale,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import { clearStaffToken, isAdminTokenValid } from "@/lib/auth";
import styles from "./layout.module.css";

// Only Dashboard is real so far -- more admin sections get added here as
// each one is actually built, same convention as MyAccountLayout's nav list.
// Icons are the same Lucide family as the How It Works journey (owner:
// propagate that icon language everywhere, admin included).
const NAV_ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/cars", label: "Cars", icon: CarFront },
  { href: "/leads", label: "Leads", icon: UserPlus },
  { href: "/deposits", label: "Deposits", icon: HandCoins },
  { href: "/members", label: "Members", icon: Users },
  { href: "/comparisons", label: "Comparisons", icon: Scale },
  { href: "/templates", label: "Templates", icon: FileText },
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
              <item.icon size={16} strokeWidth={1.75} aria-hidden="true" style={{ verticalAlign: "-3px", marginRight: 8 }} />
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
