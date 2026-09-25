// src/modules/base-module/utils/searchUtils.ts

export interface SearchableObject {
  id: string;
  label: string;
}

export interface SearchFilterResult<T extends SearchableObject> {
  exactMatches: T[];
  prefixMatches: T[];
  containsMatches: T[];
  wildcardMatches: T[];
  allOrdered: T[];
}

/**
 * Zet een zoekterm met '%' wildcards om naar een veilige Case-Insensitive RegExp.
 * Bijv: "Te%st" -> /^te.*st$/i
 */
function wildcardToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const regexString = '^' + escaped.replace(/%/g, '.*') + '$';
  return new RegExp(regexString, 'i');
}

/**
 * Filtert en sorteert objecten op basis van de syntaxis: "Zoekterm##exclusie1|exclusie2"
 */
export function filterAndRankObjects<T extends SearchableObject>(
  items: T[],
  rawQuery: string
): T[] {
  if (!rawQuery || !rawQuery.trim()) return items;

  // 1. Splits de query in een inclusie-deel en exclusie-deel via '##'
  const parts = rawQuery.split('##');
  const includeRaw = parts[0];
  const excludeRaw = parts.length > 1 ? parts.slice(1).join('##') : ''; // Vang eventuele extra '##' op

  const searchTerm = includeRaw ? includeRaw.trim().toLowerCase() : '';
  const excludeTerms = excludeRaw
    ? excludeRaw
        .split('|')
        .map((term) => term.trim().toLowerCase())
        .filter((term) => term.length > 0)
    : [];

  // 2. Stap 1: Filter uit wat uitgesloten moet worden (case-insensitive)
  const filteredList = items.filter((item) => {
    if (excludeTerms.length === 0) return true;
    const labelLower = item.label.toLowerCase();
    return !excludeTerms.some((exTerm) => labelLower.includes(exTerm));
  });

  // Als er geen zoekterm is ingevoerd (bijv. "##foto" of alleen "##"), geef de geschoonde lijst direct terug
  if (!searchTerm) {
    return filteredList;
  }

  // 3. Stap 2: Als er een wildcard '%' in de zoekterm zit -> Groep 4 (Pattern match)
  if (searchTerm.includes('%')) {
    const regex = wildcardToRegExp(searchTerm);
    const wildcardMatches = filteredList.filter((item) => regex.test(item.label));
    return wildcardMatches.sort((a, b) => a.label.localeCompare(b.label));
  }

  // 4. Stap 3: Standaard zoekterm -> Verdeel in 3 relevantie-groepen
  const exactMatches: T[] = [];
  const prefixMatches: T[] = [];
  const containsMatches: T[] = [];

  for (const item of filteredList) {
    const labelLower = item.label.toLowerCase();

    if (labelLower === searchTerm) {
      exactMatches.push(item);
    } else if (labelLower.startsWith(searchTerm)) {
      prefixMatches.push(item);
    } else if (labelLower.includes(searchTerm)) {
      containsMatches.push(item);
    }
  }

  const sortByLabel = (a: T, b: T) => a.label.localeCompare(b.label);
  exactMatches.sort(sortByLabel);
  prefixMatches.sort(sortByLabel);
  containsMatches.sort(sortByLabel);

  // Combineer in de gewenste volgorde: Exact -> Prefix -> Contains
  return [...exactMatches, ...prefixMatches, ...containsMatches];
}