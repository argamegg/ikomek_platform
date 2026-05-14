import type { RequestCategory } from "../types/platform";

export function getCategoryName(
  categoryId: string,
  categories: RequestCategory[],
  lang: string,
): string {
  const category = categories.find((item) => item.id === categoryId);

  if (!category) {
    return categoryId;
  }

  if (lang.startsWith("ru")) {
    return category.nameRu || category.name;
  }

  if (lang.startsWith("kk") || lang.startsWith("kz")) {
    return category.nameKz || category.name;
  }

  return category.name || categoryId;
}
