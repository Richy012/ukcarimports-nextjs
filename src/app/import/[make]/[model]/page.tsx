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
  // CTR overrides (2026-08-29, owner-approved): these pages rank top-10 with
  // sub-1% CTR (xc90 ~2,000 impr/28d on its queries, i8 ~300) while a twin
  // /used-cars/ireland/ URL splits their impressions. Lead with the landed
  // price and the saving - the one thing marketplace results cannot say.
  const CTR_OVERRIDES = new Set(["volvo/xc90", "bmw/i8"]);
  if (CTR_OVERRIDES.has(`${make}/${model}`)) {
    return {
      title: bs
        ? `${subject} for Sale in Ireland from ${priceFrom} \u2014 Save up to \u20ac${bs.max_saving_eur.toLocaleString()} vs Irish Prices`
        : `${subject} for Sale in Ireland from ${priceFrom} \u2014 Fully Landed, VRT Included`,
      description: `${data.count.toLocaleString()} used ${subject} cars priced fully landed for Ireland \u2014 VRT, VAT, customs and delivery all in the price you see, from ${priceFrom}. Checked against real Irish asking prices weekly.`,
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
