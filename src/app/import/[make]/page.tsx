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
  return {
    title: `${makeT} Imports Ireland — ${data.count.toLocaleString()} UK ${makeT}s, VRT Included`,
    description: `Import a ${makeT} from the UK: ${data.count.toLocaleString()} cars priced fully landed for Ireland (VRT, VAT, customs & delivery included), from €${Math.round(data.price_min ?? 0).toLocaleString()}. Independent inspection, Irish plates in ~2 weeks.`,
    alternates: { canonical: `https://ukcarimports.ie/import/${make}` },
  };
}

export default async function MakeImportPage({ params }: { params: Promise<{ make: string }> }) {
  const { make } = await params;
  const data = await getLanding(make);
  if (!data) notFound();
  return <ImportLanding data={data} makeSlug={make} />;
}
