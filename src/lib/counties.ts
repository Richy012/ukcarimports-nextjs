// The 26 Republic counties that have a /used-cars/<county> landing page
// (src/app/used-cars/[county]/page.tsx keeps its own copy because a page file
// cannot export anything but its page). NI counties must never appear here.
export const COUNTIES: { slug: string; name: string }[] = [
  { slug: "carlow", name: "Carlow" }, { slug: "cavan", name: "Cavan" },
  { slug: "clare", name: "Clare" }, { slug: "cork", name: "Cork" },
  { slug: "donegal", name: "Donegal" }, { slug: "dublin", name: "Dublin" },
  { slug: "galway", name: "Galway" }, { slug: "kerry", name: "Kerry" },
  { slug: "kildare", name: "Kildare" }, { slug: "kilkenny", name: "Kilkenny" },
  { slug: "laois", name: "Laois" }, { slug: "leitrim", name: "Leitrim" },
  { slug: "limerick", name: "Limerick" }, { slug: "longford", name: "Longford" },
  { slug: "louth", name: "Louth" }, { slug: "mayo", name: "Mayo" },
  { slug: "meath", name: "Meath" }, { slug: "monaghan", name: "Monaghan" },
  { slug: "offaly", name: "Offaly" }, { slug: "roscommon", name: "Roscommon" },
  { slug: "sligo", name: "Sligo" }, { slug: "tipperary", name: "Tipperary" },
  { slug: "waterford", name: "Waterford" }, { slug: "westmeath", name: "Westmeath" },
  { slug: "wexford", name: "Wexford" }, { slug: "wicklow", name: "Wicklow" },
];
