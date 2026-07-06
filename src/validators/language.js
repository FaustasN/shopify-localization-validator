export const LOCALIZED_COLORS = {
  lt: {
    black: "Juoda",
    white: "Balta",
    gray: "Pilka",
    brown: "Ruda",
    blue: "Mėlyna",
    red: "Raudona",
    green: "Žalia",
    yellow: "Geltona",
    orange: "Oranžinė",
    pink: "Rožinė",
    purple: "Violetinė",
    beige: "Smėlio",
    silver: "Sidabrinė",
    gold: "Auksinė",
    natural: "Natūrali",
    oak: "Ąžuolas",
    walnut: "Riešutas"
  },
  lv: {
    black: "Melna",
    white: "Balta",
    gray: "Pelēka",
    brown: "Brūna",
    blue: "Zila",
    red: "Sarkana",
    green: "Zaļa",
    yellow: "Dzeltena",
    orange: "Oranža",
    pink: "Rozā",
    purple: "Violeta",
    beige: "Bēša",
    silver: "Sudraba",
    gold: "Zelta",
    natural: "Dabīga",
    oak: "Ozols",
    walnut: "Valrieksts"
  },
  ee: {
    black: "Must",
    white: "Valge",
    gray: "Hall",
    brown: "Pruun",
    blue: "Sinine",
    red: "Punane",
    green: "Roheline",
    yellow: "Kollane",
    orange: "Oranž",
    pink: "Roosa",
    purple: "Lilla",
    beige: "Beež",
    silver: "Hõbedane",
    gold: "Kuldne",
    natural: "Naturaalne",
    oak: "Tamm",
    walnut: "Pähkel"
  }
};

const ENGLISH_COLOR_TERMS = {
  black: ["Black"],
  white: ["White"],
  gray: ["Light Grey", "Dark Grey", "Light Gray", "Dark Gray", "Grey", "Gray"],
  brown: ["Brown"],
  blue: ["Blue", "Navy"],
  red: ["Red"],
  green: ["Green"],
  yellow: ["Yellow"],
  orange: ["Orange"],
  pink: ["Pink"],
  purple: ["Purple", "Violet"],
  beige: ["Beige", "Cream"],
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
