import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ImportLanding, { getLanding, titleCase, displayModel } from "../../ImportLanding";

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ make: string; model: string }>;
}): Promise<Metadata> {
  const { make, model } = await params;
  const data = await getLanding(make, model);
  if (!data || !data.model) return { title: "Import from the UK" };
  const subject = `${titleCase(data.make)} ${displayModel(data.make, data.model)}`;
  const bs = data.bestseller && data.bestseller.count > 0 ? data.bestseller : null;
  const priceFrom = `€${Math.round(data.price_min ?? 0).toLocaleString()}`;
  // CTR_V2 (2026-09-10, owner: "rewrite the titles and descriptions on the
  // XC90, XC60 and i8 pages"). Measured before changing: the 29 Aug version
  // moved the i8 from 0.6% to 1.1% and the XC90 not at all (0.4% -> 0.5%);
  // the XC60 sat at 0.3% on the default template. So this is a deliberately
  // different shape for all three - the searcher's words first, then the two
  // facts a marketplace result cannot show (stock count, landed from-price),
  // and a description that opens with the measured under-Irish count. The
  // weekly report compares click rate from this date.
  const CTR_V2 = new Set(["volvo/xc90", "volvo/xc60", "bmw/i8"]);
  if (CTR_V2.has(`${make}/${model}`)) {
    const under = bs ? bs.count.toLocaleString() : null;
    return {
      title: `${subject} for Sale in Ireland \u2014 ${data.count.toLocaleString()} Cars from ${priceFrom}, VRT Included`,
      description: bs
        ? `${under} of our ${data.count.toLocaleString()} ${subject} are priced at least \u20ac750 under the same car on Irish forecourts today, the best by \u20ac${bs.max_saving_eur.toLocaleString()}. Every price is fully landed: VRT, VAT, customs and delivery in. Independent inspection, Irish plates in about two weeks.`
        : `${data.count.toLocaleString()} used ${subject} from ${priceFrom}, every one priced fully landed for Ireland: VRT, VAT, customs and delivery in the price you see. Independent inspection before you commit, Irish plates in about two weeks.`,
      alternates: { canonical: `https://ukcarimports.ie/import/${make}/${model}` },
    };
  }
  // Bestseller ladder (owner 2026-09-03): where ten or more of the model sit
  // €750+ under the Irish market, lead with that count — the one line a
  // marketplace result cannot say. Same move as the XC90/i8 test above.
  if (bs && bs.count >= 10) {
    return {
      title: `${subject} for Sale Ireland — ${bs.count.toLocaleString()} Cars Under Irish Prices, from ${priceFrom}`,
      description: `${bs.count.toLocaleString()} of our ${data.count.toLocaleString()} used ${subject} cars are measured €750+ under the Irish market, the best by €${bs.max_saving_eur.toLocaleString()}. Priced fully landed — VRT, VAT, customs & delivery included. Benchmarked against real Irish ads weekly.`,
      alternates: { canonical: `https://ukcarimports.ie/import/${make}/${model}` },
    };
  }
  return {
    // Query-shaped: "{model} for sale ireland" is the search these pages
    // exist to win (GSC 2026-08-05: big impressions, pos 8-15, sub-1% CTR).
    title: `${subject} for Sale in Ireland — ${data.count.toLocaleString()} Available, VRT Included`,
    description: bs
      ? `Up to €${bs.max_saving_eur.toLocaleString()} under Irish asking prices: ${data.count.toLocaleString()} used ${subject} cars from ${priceFrom}, priced fully landed — VRT, VAT, customs & delivery included. Benchmarked against real Irish ads weekly.`
      : `${data.count.toLocaleString()} used ${subject} cars for sale from ${priceFrom}, priced fully landed for Ireland — VRT, VAT, customs & delivery included. Benchmarked against Irish prices weekly.`,
    alternates: { canonical: `https://ukcarimports.ie/import/${make}/${model}` },
  };
}

export default async function ModelImportPage({
  params,
}: {
  params: Promise<{ make: string; model: string }>;
}) {
  const { make, model } = await params;
  const data = await getLanding(make, model);
  if (!data || !data.model) notFound();
  return <ImportLanding data={data} makeSlug={make} />;
}
