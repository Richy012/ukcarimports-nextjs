import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ImportLanding, { getLanding, titleCase } from "../ImportLanding";

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ make: string }>;
}): Promise<Metadata> {
  const { make } = await params;
  const data = await getLanding(make);
  if (!data) return { title: "Import from the UK" };
  const makeT = titleCase(data.make);
  const bs = data.bestseller && data.bestseller.count > 0 ? data.bestseller : null;
  return {
    // 2026-08-11: searchers type "<make> for sale ireland" (GSC: 5 such queries,
    // 1,000+ impressions each, CTR under 1% against import-led titles). Lead
    // with their words; the import story stays in the description and the page.
    title: `${makeT} for Sale in Ireland — ${data.count.toLocaleString()} Available from the UK, VRT Included`,
    description: bs
      ? `Import a ${makeT} from the UK: ${data.count.toLocaleString()} cars priced fully landed for Ireland from €${Math.round(data.price_min ?? 0).toLocaleString()} — VRT, VAT, customs & delivery included. ${bs.count.toLocaleString()} currently €2,500+ under Irish asking prices (up to €${bs.max_saving_eur.toLocaleString()}).`
      : `Import a ${makeT} from the UK: ${data.count.toLocaleString()} cars priced fully landed for Ireland (VRT, VAT, customs & delivery included), from €${Math.round(data.price_min ?? 0).toLocaleString()}. Independent inspection, Irish plates in ~2 weeks.`,
    alternates: { canonical: `https://ukcarimports.ie/import/${make}` },
  };
}

export default async function MakeImportPage({ params }: { params: Promise<{ make: string }> }) {
  const { make } = await params;
  const data = await getLanding(make);
  if (!data) notFound();
  return <ImportLanding data={data} makeSlug={make} />;
}
