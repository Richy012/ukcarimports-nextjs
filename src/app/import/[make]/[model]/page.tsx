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
