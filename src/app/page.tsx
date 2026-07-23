import type { Metadata } from "next";
import SearchWidget from "./SearchWidget";
import styles from "./page.module.css";

const API_BASE = "https://api.ukcarimports.ie/public";

export const metadata: Metadata = {
  title: "Leading Irish Importer of Quality UK Used Cars - UK Car Imports",
  description:
    "Safe and easy way to buy UK used cars from Ireland - VRT & NOx fees due per car. Optional mechanical & condition inspection reports. Optional warranty cover & VRT processing. Let our professionals do the work - UK Car Imports",
};

const DEFAULT_FILTER_BODY = {
  is_manheim_car: "0",
  premium_car: 0,
  minPrice: "",
  maxPrice: "",
  minYear: "",
  maxYear: "",
  Make: "",
  Model: "",
  Fuel: "",
  seats: "",
  body_style: "",
  Condition: "",
  minMileage: "",
  maxMileage: "",
  minEnginesize: "",
  maxEnginesize: "",
  transmission_type: "",
  engine: "",
  color: "",
  vrtFilter: "Yes",
};

async function postFilter(path: string) {
  const res = await fetch(`${API_BASE}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(DEFAULT_FILTER_BODY),
    cache: "no-store",
  });
  return res.json();
}

interface HomepageContent {
  data: {
    aboutus: string;
    howitworks: string;
    ourtrade: string;
    whyus: string;
  };
}

async function getHomepageContent(): Promise<HomepageContent> {
  const res = await fetch(`${API_BASE}/get-homepage-content`, {
    cache: "no-store",
  });
  return res.json();
}

export default async function HomePage() {
  const [homepage, makesData, fuelsData, bodyStylesData, transmissionsData] =
    await Promise.all([
      getHomepageContent(),
      postFilter("makes"),
      postFilter("fuel-types"),
      postFilter("body-styles"),
      postFilter("transmission-types"),
    ]);

  const makes = (makesData.make || [])
    .filter((m: { make: string }) => m.make)
    .map((m: { make: string; total: number }) => ({ label: m.make, total: m.total }));
  const fuels = (fuelsData.fuel_type || [])
    .filter((f: { fuel_type: string }) => f.fuel_type)
    .map((f: { fuel_type: string; total: number }) => ({ label: f.fuel_type, total: f.total }));
  const bodyStyles = (bodyStylesData.body_style || [])
    .filter((b: { body_style: string }) => b.body_style)
    .map((b: { body_style: string; total: number }) => ({ label: b.body_style, total: b.total }));
  const transmissions = (transmissionsData.transmission || [])
    .filter((t: { car_transmission: string }) => t.car_transmission)
    .map((t: { car_transmission: string; total: number }) => ({
      label: t.car_transmission,
      total: t.total,
    }));

  const { aboutus, howitworks, ourtrade, whyus } = homepage.data;

  return (
    <main>
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <h1 className={styles.heroTitle}>Let&apos;s Find A Car For You</h1>
          <SearchWidget
            initialMakes={makes}
            initialFuels={fuels}
            initialBodyStyles={bodyStyles}
            initialTransmissions={transmissions}
          />
        </div>
      </section>

      {aboutus && (
        <div dangerouslySetInnerHTML={{ __html: aboutus }} />
      )}

      {howitworks && (
        <section className={styles.contentSection}>
          <h2 className={styles.contentHeading}>HOW IT WORKS?</h2>
          <div dangerouslySetInnerHTML={{ __html: howitworks }} />
        </section>
      )}

      {ourtrade && (
        <section className={styles.contentSection}>
          <h2 className={styles.contentHeading}>Our Trade In Service</h2>
          <div dangerouslySetInnerHTML={{ __html: ourtrade }} />
        </section>
      )}

      {whyus && <div dangerouslySetInnerHTML={{ __html: whyus }} />}

      <div className={styles.reviews}>
        <img
          src="https://ukcarimports.ie/assets/images/Reviewsicon.webp"
          alt="Reviews"
          width={200}
          height={60}
        />
        <span>See what others are saying about us on Google</span>
      </div>

      <div className={styles.footer}>
        <div className={styles.footerLeft}>
          <h2>OUR OFFICES</h2>
          <div className={styles.footerBox}>
            <img
              src="https://ukcarimports.ie/assets/images/icon-4.png"
              alt=""
              width={60}
              height={60}
            />
            <div>
              <h5>ADDRESS</h5>
              <p>51 Bracken Rd, Sandyford Business Park, Sandyford, Dublin, D18 CV48, Ireland</p>
            </div>
          </div>
          <div className={styles.footerBox}>
            <img
              src="https://ukcarimports.ie/assets/images/icon-5.png"
              alt=""
              width={60}
              height={60}
            />
            <div>
              <h5>EMAIL</h5>
              <p>info@ukcarimports.ie</p>
            </div>
          </div>
        </div>
        <div className={styles.footerRight}>
          <iframe
            style={{ border: 0 }}
            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2385.907439518616!2d-6.218018634164293!3d53.27327807996377!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x4867054677fba92f%3A0x23d83dd2dc00eb6e!2sUK%20Car%20Imports!5e0!3m2!1sen!2sin!4v1589012063630!5m2!1sen!2sin"
            width="100%"
            height="400"
            loading="lazy"
            title="UK Car Imports office location"
          />
        </div>
      </div>
    </main>
  );
}
