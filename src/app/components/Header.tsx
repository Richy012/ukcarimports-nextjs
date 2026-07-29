"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { clearToken, isTokenValid } from "@/lib/auth";
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

export default function Header() {
    const [open, setOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [resourcesOpen, setResourcesOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    setIsLoggedIn(isTokenValid());
  }, []);

  function logout() {
    clearToken();
    setIsLoggedIn(false);
    setAccountOpen(false);
    setOpen(false);
    window.location.href = "/";
  }

  return (
    <header className={styles.header}>
      <div className={styles.bar}>
        <Link href="/" className={styles.brand} onClick={() => setOpen(false)}>
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

        <nav className={`${styles.nav} ${open ? styles.navOpen : ""}`}>
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
                aria-expanded={resourcesOpen}
                onClick={() => setResourcesOpen((v) => !v)}
              >
                More ▾
              </button>
              <ul className={`${styles.accountMenu} ${resourcesOpen ? styles.accountMenuOpen : ""}`}>
                {RESOURCE_LINKS.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className={styles.accountMenuLink}
                      onClick={() => {
                        setResourcesOpen(false);
                        setOpen(false);
                      }}
                    >
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
                  aria-expanded={accountOpen}
                  onClick={() => setAccountOpen((v) => !v)}
                >
                  My Account ▾
                </button>
                <ul className={`${styles.accountMenu} ${accountOpen ? styles.accountMenuOpen : ""}`}>
                  {ACCOUNT_LINKS.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className={styles.accountMenuLink}
                        onClick={() => {
                          setAccountOpen(false);
                          setOpen(false);
                        }}
                      >
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
                  aria-expanded={authOpen}
                  onClick={() => setAuthOpen((v) => !v)}
                >
                  Login ▾
                </button>
                <ul className={`${styles.accountMenu} ${authOpen ? styles.accountMenuOpen : ""}`}>
                  <li>
                    <Link
                      href="/sign-in"
                      className={styles.accountMenuLink}
                      onClick={() => {
                        setAuthOpen(false);
                        setOpen(false);
                      }}
                    >
                      Login
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/sign-up"
                      className={styles.accountMenuLink}
                      onClick={() => {
                        setAuthOpen(false);
                        setOpen(false);
                      }}
                    >
                      Register
                    </Link>
                  </li>
                </ul>
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
