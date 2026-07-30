import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ImportLanding, { getLanding, titleCase } from "../../ImportLanding";

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ make: string; model: string }>;
}): Promise<Metadata> {
  const { make, model } = await params;
  const data = await getLanding(make, model);
  if (!data || !data.model) return { title: "Import from the UK" };
  const subject = `${titleCase(data.make)} ${titleCase(data.model)}`;
  return {
    title: `${subject} Imports Ireland — ${data.count.toLocaleString()} Available, VRT Included`,
    description: `Import a ${subject} from the UK: ${data.count.toLocaleString()} cars priced fully landed for Ireland from €${Math.round(data.price_min ?? 0).toLocaleString()} — VRT, VAT, customs & delivery included. Benchmarked against Irish prices weekly.`,
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
