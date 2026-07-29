import type { Metadata } from "next";
import SavedSearchesClient from "./SavedSearchesClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "My Saved Searches",
  description: "Searches you've saved on UK Car Imports.",
};

export default function SavedSearchesPage() {
  return <SavedSearchesClient />;
}
