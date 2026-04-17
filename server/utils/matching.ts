export function fuzzyNameMatch(cwName: string, platformName: string): boolean {
  const SUFFIXES = /\b(inc|llc|pllc|corp|ltd|co|group|services|solutions|tech|technologies|consulting|associates|management|systems|partners|company|international|properties|enterprises|law|legal|psc|pc|dds|cpa|md|dvm)\b/g;
  function norm(s: string): string {
    return s.toLowerCase()
      .replace(/&/g, " and ")
      .replace(SUFFIXES, " ")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ").trim();
  }
  const a = norm(cwName);
  const b = norm(platformName);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  const tokA = a.split(" ").filter(t => t.length > 2);
  const tokB = b.split(" ").filter(t => t.length > 2);
  if (tokA.length === 0 || tokB.length === 0) return false;
  const shorter = tokA.length <= tokB.length ? tokA : tokB;
  const longer  = tokA.length <= tokB.length ? tokB : tokA;
  const hits = shorter.filter(t => longer.some(lt => lt === t || lt.includes(t) || t.includes(lt))).length;
  return hits >= Math.ceil(shorter.length * 0.8);
}
