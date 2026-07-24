"use client";

import { useState } from "react";
import Link from "next/link";
import styles from "./Header.module.css";

const NAV_LINKS = [
  { href: "/", label: "HOME" },
  { href: "/used-cars", label: "USED CARS" },
  { href: "/car-sourcing", label: "Car Sourcing" },
  { href: "/how-it-works.html", label: "How It Works", external: true },
  { href: "/about-us", label: "ABOUT US" },
  { href: "/contact", label: "CONTACT" },
  { href: "/faq", label: "FAQ" },
  { href: "/blog", label: "BLOG" },
];

export default function Header() {
  const [open, setOpen] = useState(false);

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
            <li onClick={() => setOpen(false)}>
              <Link href="/sign-in" className={styles.navLink}>
                Login
              </Link>
            </li>
            <li onClick={() => setOpen(false)}>
              <Link href="/sign-up" className={styles.navLink}>
                Register
              </Link>
            </li>
            <li className={styles.phone}>
              <a href="tel:01-556 8261">01-556 8261</a>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
