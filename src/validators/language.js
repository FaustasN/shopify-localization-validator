export const LOCALIZED_COLORS = {
  lt: {
    black: "Juoda",
    white: "Balta",
    gray: "Pilka",
    graphite: "Grafito",
    anthracite: "Antracito",
    brown: "Ruda",
    blue: "M\u0117lyna",
    red: "Raudona",
    green: "\u017dalia",
    yellow: "Geltona",
    orange: "Oran\u017ein\u0117",
    pink: "Ro\u017ein\u0117",
    purple: "Violetin\u0117",
    beige: "Sm\u0117lio",
    silver: "Sidabrin\u0117",
    gold: "Auksin\u0117",
    natural: "Nat\u016brali",
    oak: "\u0104\u017euolas",
    walnut: "Rie\u0161utas"
  },
  lv: {
    black: "Melna",
    white: "Balta",
    gray: "Pel\u0113ka",
    graphite: "Graf\u012bta",
    anthracite: "Antrac\u012bta",
    brown: "Br\u016bna",
    blue: "Zila",
    red: "Sarkana",
    green: "Za\u013ca",
    yellow: "Dzeltena",
    orange: "Oran\u017ea",
    pink: "Roz\u0101",
    purple: "Violeta",
    beige: "B\u0113\u0161a",
    silver: "Sudraba",
    gold: "Zelta",
    natural: "Dab\u012bga",
    oak: "Ozols",
    walnut: "Valrieksts"
  },
  ee: {
    black: "Must",
    white: "Valge",
    gray: "Hall",
    graphite: "Grafiit",
    anthracite: "Antratsiit",
    brown: "Pruun",
    blue: "Sinine",
    red: "Punane",
    green: "Roheline",
    yellow: "Kollane",
    orange: "Oran\u017e",
    pink: "Roosa",
    purple: "Lilla",
    beige: "Bee\u017e",
    silver: "H\u00f5bedane",
    gold: "Kuldne",
    natural: "Naturaalne",
    oak: "Tamm",
    walnut: "P\u00e4hkel"
  },
  cz: {
    black: "\u010cern\u00e1",
    white: "B\u00edl\u00e1",
    gray: "\u0160ed\u00e1",
    graphite: "Grafitov\u00e1",
    anthracite: "Antracitov\u00e1",
    brown: "Hn\u011bd\u00e1",
    blue: "Modr\u00e1",
    red: "\u010cerven\u00e1",
    green: "Zelen\u00e1",
    yellow: "\u017dlut\u00e1",
    orange: "Oran\u017eov\u00e1",
    pink: "R\u016f\u017eov\u00e1",
    purple: "Fialov\u00e1",
    beige: "B\u00e9\u017eov\u00e1",
    silver: "St\u0159\u00edbrn\u00e1",
    gold: "Zlat\u00e1",
    natural: "P\u0159\u00edrodn\u00ed",
    oak: "Dub",
    walnut: "O\u0159ech"
  },
  pl: {
    black: "Czarny",
    white: "Bia\u0142y",
    gray: "Szary",
    graphite: "Grafitowy",
    anthracite: "Antracytowy",
    brown: "Br\u0105zowy",
    blue: "Niebieski",
    red: "Czerwony",
    green: "Zielony",
    yellow: "\u017b\u00f3\u0142ty",
    orange: "Pomara\u0144czowy",
    pink: "R\u00f3\u017cowy",
    purple: "Fioletowy",
    beige: "Be\u017cowy",
    silver: "Srebrny",
    gold: "Z\u0142oty",
    natural: "Naturalny",
    oak: "D\u0105b",
    walnut: "Orzech"
  }
};

const ENGLISH_COLOR_TERMS = {
  black: ["Black"],
  white: ["White"],
  gray: ["Light Grey", "Dark Grey", "Light Gray", "Dark Gray", "Grey", "Gray"],
  graphite: ["Graphite"],
  anthracite: ["Anthracite"],
  brown: ["Brown"],
  blue: ["Blue", "Navy"],
  red: ["Red"],
  green: ["Green"],
  yellow: ["Yellow"],
  orange: ["Orange"],
  pink: ["Pink"],
  purple: ["Purple", "Violet"],
  beige: ["Beige", "Cream", "Sand"],
  silver: ["Silver"],
  gold: ["Gold"],
  natural: ["Natural"],
  oak: ["Oak"],
  walnut: ["Walnut"]
};

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildEnglishColorDictionary(locale) {
  const localizedColors = LOCALIZED_COLORS[locale] ?? {};
  const dictionary = {};

  for (const [colorKey, wrongTerms] of Object.entries(ENGLISH_COLOR_TERMS)) {
    const expectedTerm = localizedColors[colorKey];

    if (!expectedTerm) {
      continue;
    }

    for (const wrongTerm of wrongTerms) {
      dictionary[wrongTerm] = expectedTerm;
    }
  }

  return dictionary;
}

function findKeywordMatch(dictionary, value) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  for (const [wrongTerm, expectedTerm] of Object.entries(dictionary)) {
    const pattern = new RegExp(`\\b${escapeRegExp(wrongTerm)}\\b`, "i");

    if (pattern.test(value)) {
      return {
        wrongTerm,
        expectedTerm
      };
    }
  }

  return null;
}

export function findEnglishColor(locale, value) {
  return findKeywordMatch(buildEnglishColorDictionary(locale), value);
}
