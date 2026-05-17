# News Workflow Notes

News content supports public reading and admin publishing.

## Public Reading

- `/api/news` returns the news list.
- `/api/news/{news_id}` returns one news item.
- Web and mobile clients should handle an empty news list gracefully.

## Admin Publishing

- Admin users create news through `/api/admin/news`.
- Admin users update news through `/api/admin/news/{news_id}`.
- Admin users delete news through `/api/admin/news/{news_id}`.
- Translation previews are available through `/api/admin/news/translate-preview`.

## Content Checks

- Title and content should be present in the default language.
- Category should map to a known client badge or fallback.
- Date formatting should be stable across web and mobile clients.
- Deleted news should disappear from list and detail views.
