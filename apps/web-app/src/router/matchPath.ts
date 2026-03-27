export function matchPath(pattern: string, pathname: string) {
  const patternParts = pattern.split("/").filter(Boolean);
  const pathnameParts = pathname.split("/").filter(Boolean);

  if (patternParts.length !== pathnameParts.length) {
    return null;
  }

  const params: Record<string, string> = {};

  for (const [index, patternPart] of patternParts.entries()) {
    const pathnamePart = pathnameParts[index];

    if (patternPart.startsWith(":")) {
      params[patternPart.slice(1)] = pathnamePart;
      continue;
    }

    if (patternPart !== pathnamePart) {
      return null;
    }
  }

  return params;
}
