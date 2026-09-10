import { NextResponse, type NextRequest } from "next/server";

/**
 * Legacy URL redirects — the old SPA's location and brand pages.
 *
 * Found 10 Sep 2026 in Search Console: 4,542 URLs that Google was showing a
 * month earlier and shows nowhere now — 66,000 impressions and 1,400 clicks
 * per 28 days. Not lost rankings: dead addresses. The old site had
 *
 *   /used-cars/ireland/<make>/<model>/      (Cloudflare 301s these already)
 *   /used-cars/<County>/                    capitalised — our county route is
 *                                           case-sensitive, so 404
 *   /used-cars/<town>/                      tullamore, mullingar, drogheda,
 *                                           naas, balbriggan… no town route
 *   /used-cars/<place>/<make>/[<model>/]    "toyota tullamore", "tesla cork"
 *
 * and Google kept sending people to them. This maps every one of those shapes
 * onto the page that exists today. It is purely a function of the URL — no
 * cookies, no country, no user — so the edge may cache the redirect per URL
 * (that is what we want; per-visitor logic here is forbidden, see the 13 Aug
 * cache-poisoning incident in the deploy notes).
 *
 * The matcher is /used-cars/<something>. The listing itself (/used-cars with
 * its query string) never comes through here.
 */

const COUNTIES = new Set([
  "carlow", "cavan", "clare", "cork", "donegal", "dublin", "galway", "kerry",
  "kildare", "kilkenny", "laois", "leitrim", "limerick", "longford", "louth", "mayo",
  "meath", "monaghan", "offaly", "roscommon", "sligo", "tipperary", "waterford",
  "westmeath", "wexford", "wicklow",
]);

// Towns the old site had pages for, mapped to the county page we have now.
const TOWN_TO_COUNTY: Record<string, string> = {
  tullamore: "offaly", mullingar: "westmeath", athlone: "westmeath", drogheda: "louth",
  dundalk: "louth", naas: "kildare", newbridge: "kildare", balbriggan: "dublin",
  swords: "dublin", tallaght: "dublin", blanchardstown: "dublin", arklow: "wicklow",
  bray: "wicklow", templemore: "tipperary", clonmel: "tipperary", thurles: "tipperary",
  nenagh: "tipperary", navan: "meath", ashbourne: "meath", portlaoise: "laois",
  ennis: "clare", tralee: "kerry", killarney: "kerry", castlebar: "mayo",
  ballina: "mayo", letterkenny: "donegal", carrick: "leitrim", longford: "longford",
  wexford: "wexford", waterford: "waterford", kilkenny: "kilkenny", sligo: "sligo",
  galway: "galway", limerick: "limerick", cork: "cork", dublin: "dublin",
  "carrick-on-shannon": "leitrim", tuam: "galway", dungarvan: "waterford",
  enniscorthy: "wexford", gorey: "wexford", cavan: "cavan", monaghan: "monaghan",
  roscommon: "roscommon", birr: "offaly", edenderry: "offaly", trim: "meath",
  celbridge: "kildare", maynooth: "kildare", leixlip: "kildare", greystones: "wicklow",
  wicklow: "wicklow", carlow: "carlow", portarlington: "laois", mallow: "cork",
  bandon: "cork", midleton: "cork", cobh: "cork", youghal: "cork", fermoy: "cork",
  shannon: "clare", kilrush: "clare", listowel: "kerry", dingle: "kerry",
  westport: "mayo", claremorris: "mayo", ballinasloe: "galway", loughrea: "galway",
  athenry: "galway", boyle: "roscommon", ballyshannon: "donegal", buncrana: "donegal",
  donegal: "donegal", bundoran: "donegal", clones: "monaghan", carrickmacross: "monaghan",
  castleblayney: "monaghan", bailieborough: "cavan", virginia: "cavan", kells: "meath",
  laytown: "meath", bettystown: "meath", ardee: "louth", dunleer: "louth",
  skerries: "dublin", malahide: "dublin", lucan: "dublin", clondalkin: "dublin",
  "dun-laoghaire": "dublin", dunlaoghaire: "dublin", sandyford: "dublin",
  tramore: "waterford", "new-ross": "wexford", newross: "wexford", thomastown: "kilkenny",
  callan: "kilkenny", tipperary: "tipperary", cashel: "tipperary", roscrea: "tipperary",
  carrigaline: "cork", ballincollig: "cork", kinsale: "cork", clonakilty: "cork",
  skibbereen: "cork", bantry: "cork", macroom: "cork", charleville: "cork",
  mitchelstown: "cork", kanturk: "cork", newcastlewest: "limerick", "newcastle-west": "limerick",
  abbeyfeale: "limerick", kilmallock: "limerick", "ballymote": "sligo", tubbercurry: "sligo",
  manorhamilton: "leitrim", granard: "longford", ballymahon: "longford", moate: "westmeath",
  kilbeggan: "westmeath", castlepollard: "westmeath", clara: "offaly", banagher: "offaly",
  mountmellick: "laois", abbeyleix: "laois", rathdowney: "laois", stradbally: "laois",
  athy: "kildare", kildare: "kildare", kilcock: "kildare", monasterevin: "kildare",
  baltinglass: "wicklow", blessington: "wicklow", rathdrum: "wicklow", tullow: "carlow",
  bagenalstown: "carlow", muinebheag: "carlow", "muine-bheag": "carlow",
  // the rest of the towns that appeared in the dead-URL list, 10 Sep 2026
  "carrick-on-suir": "tipperary", carrickonsuir: "tipperary", lismore: "waterford",
  castleisland: "kerry", cahir: "tipperary", carlingford: "louth", oldcastle: "meath",
  dunshaughlin: "meath", ratoath: "meath", rush: "dublin", donabate: "dublin",
  portmarnock: "dublin", howth: "dublin", dalkey: "dublin", bailieboro: "cavan",
  cootehill: "cavan", belturbet: "cavan", ballyjamesduff: "cavan", kingscourt: "cavan",
  ballybofey: "donegal", stranorlar: "donegal", carndonagh: "donegal", moville: "donegal",
  gort: "galway", clifden: "galway", oranmore: "galway", headford: "galway",
  swinford: "mayo", belmullet: "mayo", ballinrobe: "mayo", kiltimagh: "mayo",
  strokestown: "roscommon", castlerea: "roscommon", ballaghaderreen: "roscommon",
  enniskerry: "wicklow", kilcoole: "wicklow", newtownmountkennedy: "wicklow",
  ferns: "wexford", bunclody: "wexford", rosslare: "wexford", kilmore: "wexford",
  graiguenamanagh: "kilkenny", castlecomer: "kilkenny", urlingford: "kilkenny",
  kilmacthomas: "waterford", cappoquin: "waterford", portlaw: "waterford",
  borrisokane: "tipperary", killenaule: "tipperary", fethard: "tipperary",
  ballybunion: "kerry", kenmare: "kerry", cahersiveen: "kerry", killorglin: "kerry",
  croom: "limerick", adare: "limerick", rathkeale: "limerick", askeaton: "limerick",
  lahinch: "clare", ennistymon: "clare", scariff: "clare", sixmilebridge: "clare",
  ferbane: "offaly", daingean: "offaly", tullamoore: "offaly", kinnegad: "westmeath",
  rochfortbridge: "westmeath", delvin: "westmeath", edgeworthstown: "longford",
  lanesborough: "longford", drumshanbo: "leitrim", mohill: "leitrim", ballinamore: "leitrim",
  enniscrone: "sligo", collooney: "sligo", ballaghaderrin: "roscommon",
};

function slug(s: string): string {
  let d = s;
  try {
    d = decodeURIComponent(s);
  } catch {
    // leave undecodable segments as they are
  }
  return d.trim().toLowerCase().replace(/[\s_]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith("/used-cars/")) return NextResponse.next();

  const parts = pathname.split("/").filter(Boolean).slice(1).map(slug).filter(Boolean);
  if (parts.length === 0) return NextResponse.next();
  const [first, ...rest] = parts;

  let dest: string | null = null;
  if (first === "ireland") {
    if (rest.length === 0) dest = "/used-cars";
    else if (rest.length === 1) dest = `/import/${rest[0]}`;
    else dest = `/import/${rest[0]}/${rest[1]}`;
  } else if (rest.length >= 1) {
    // place + make [+ model]: the closest page we have is the make (or model) page
    dest = rest.length >= 2 ? `/import/${rest[0]}/${rest[1]}` : `/import/${rest[0]}`;
  } else {
    const county = COUNTIES.has(first) ? first : TOWN_TO_COUNTY[first];
    if (county) dest = `/used-cars/${county}`;
  }

  if (!dest || dest === pathname) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = dest;
  url.search = "";
  return NextResponse.redirect(url, 308);
}

export const config = {
  matcher: ["/used-cars/:path+"],
};
