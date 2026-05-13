import type { CategoryStat } from "../../lib/mapDashboard";

type CategoryStatsProps = {
  categories: CategoryStat[];
};

export function CategoryStats({ categories }: CategoryStatsProps) {
  return (
    <section className="category-stats">
      <div className="analytics-section-title">
        <span>Топ категорий</span>
      </div>
      <div className="category-stats__list">
        {categories.length > 0 ? (
          categories.map((category) => (
            <div key={category.key} className="category-stats__item">
              <div>
                <strong>{category.label}</strong>
                <span>{category.count} заявок</span>
              </div>
              <div className="category-stats__bar" aria-hidden="true">
                <span style={{ width: `${Math.max(category.percent, 6)}%` }} />
              </div>
            </div>
          ))
        ) : (
          <p className="analytics-empty">Нет категорий для анализа</p>
        )}
      </div>
    </section>
  );
}
