"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { clearToken, isTokenValid, isAdminTokenValid } from "@/lib/auth";
import styles from "./Header.module.css";

const NAV_LINKS = [
  { href: "/", label: "HOME" },
  { href: "/used-cars", label: "USED CARS" },
  { href: "/car-sourcing", label: "Car Sourcing" },
  { href: "/how-it-works.html", label: "How It Works", external: true },
];

// Secondary/company pages grouped into one dropdown -- matches the standard
// industry pattern (a small set of primary nav items plus a lightweight
// "More"-style dropdown for company/support content), and reduces the
// top-level item count now that account links also live in their own
// dropdown.
const RESOURCE_LINKS = [
  { href: "/about-us", label: "About Us" },
  { href: "/contact", label: "Contact" },
  { href: "/blog", label: "Blog" },
  { href: "/faq", label: "FAQ" },
];

const ACCOUNT_LINKS = [
  { href: "/my-account/saved-cars", label: "Saved Cars" },
  { href: "/my-account/saved-searches", label: "Saved Searches" },
  { href: "/my-account/notifications", label: "Notifications" },
];

type MenuKey = "resources" | "account" | "auth" | null;

export default function Header() {
  const [open, setOpen] = useState(false);
  // Single source of truth for which dropdown is open -- three independent
  // booleans previously let "More" and "My Account" both be open at once
  // (confirmed live 2026-07-30), since toggling one never closed the others.
  const [openMenu, setOpenMenu] = useState<MenuKey>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isStaff, setIsStaff] = useState(false);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setIsLoggedIn(isTokenValid());
    setIsStaff(isAdminTokenValid());
  }, []);

  // The live legacy site's dropdowns never close on an outside click -- once
  // opened they sit there until you click the toggle again or pick a link
  // (confirmed live 2026-07-30). Only clicks on a real link or the toggle
  // itself close a menu without this; clicking anywhere else on the page
  // left it open indefinitely, same gap this is fixing.
  useEffect(() => {
    if (openMenu === null) return;
    function handleClickOutside(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openMenu]);

  function toggleMenu(key: MenuKey) {
    setOpenMenu((current) => (current === key ? null : key));
  }

  function closeAll() {
    setOpenMenu(null);
    setOpen(false);
  }

  function logout() {
    clearToken();
    setIsLoggedIn(false);
    closeAll();
    window.location.href = "/";
  }

  return (
    <header className={styles.header}>
      <div className={styles.bar}>
        <Link href="/" className={styles.brand} onClick={closeAll}>
          <img src="/assets/images/logo.png" alt="UK Car Imports" width={60} height={60} />
        </Link>

        <button
          type="button"
          className={styles.toggle}
          aria-label="Toggle navigation menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span />
          <span />
          <span />
        </button>

        <nav ref={navRef} className={`${styles.nav} ${open ? styles.navOpen : ""}`}>
          <ul className={styles.navList}>
            {NAV_LINKS.map((link) => (
              <li key={link.href} onClick={() => setOpen(false)}>
                {link.external ? (
                  <a href={link.href} target="_blank" rel="noopener noreferrer" className={styles.navLink}>
                    {link.label}
                  </a>
                ) : (
                  <Link href={link.href} className={styles.navLink}>
                    {link.label}
                  </Link>
                )}
              </li>
            ))}

            <li className={styles.accountItem}>
              <button
                type="button"
                className={styles.navLink}
                aria-expanded={openMenu === "resources"}
                onClick={() => toggleMenu("resources")}
              >
                More ▾
              </button>
              <ul className={`${styles.accountMenu} ${openMenu === "resources" ? styles.accountMenuOpen : ""}`}>
                {RESOURCE_LINKS.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className={styles.accountMenuLink} onClick={closeAll}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </li>

            {isLoggedIn ? (
              <li className={styles.accountItem}>
                <button
                  type="button"
                  className={styles.navLink}
                  aria-expanded={openMenu === "account"}
                  onClick={() => toggleMenu("account")}
                >
                  My Account ▾
                </button>
                <ul className={`${styles.accountMenu} ${openMenu === "account" ? styles.accountMenuOpen : ""}`}>
                  {ACCOUNT_LINKS.map((link) => (
                    <li key={link.href}>
                      <Link href={link.href} className={styles.accountMenuLink} onClick={closeAll}>
                        {link.label}
                      </Link>
                    </li>
                  ))}
                  <li>
                    <button type="button" className={styles.accountMenuLink} onClick={logout}>
                      Logout
                    </button>
                  </li>
                </ul>
              </li>
            ) : (
              <li className={styles.accountItem}>
                <button
                  type="button"
                  className={styles.navLink}
                  aria-expanded={openMenu === "auth"}
                  onClick={() => toggleMenu("auth")}
                >
                  Login ▾
                </button>
                <ul className={`${styles.accountMenu} ${openMenu === "auth" ? styles.accountMenuOpen : ""}`}>
                  <li>
                    <Link href="/sign-in" className={styles.accountMenuLink} onClick={closeAll}>
                      Login
                    </Link>
                  </li>
                  <li>
                    <Link href="/sign-up" className={styles.accountMenuLink} onClick={closeAll}>
                      Register
                    </Link>
                  </li>
                </ul>
              </li>
            )}

            {isStaff && (
              <li onClick={closeAll}>
                <Link href="/dashboard" className={styles.navLink}>
                  Dashboard
                </Link>
              </li>
            )}

            <li className={styles.phone}>
              <a href="tel:01-556 8261">01-556 8261</a>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
