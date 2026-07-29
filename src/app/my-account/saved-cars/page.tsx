import type { Metadata } from "next";
import SavedCarsClient from "./SavedCarsClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "My Saved Cars",
  description: "Cars you've saved on UK Car Imports.",
};

export default function SavedCarsPage() {
  return <SavedCarsClient />;
}
