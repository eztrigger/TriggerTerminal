# Bilingual Interface

- Every new or changed user-facing feature must support both Simplified Chinese and English.
- Use `tr()` from `web/lib/i18n.ts` for visible copy, accessibility labels, tooltips, notifications, and system-generated messages. Add a matching entry to `web/lib/translations/en.ts`.
- Keep API values, enum comparisons, symbols, contract identifiers, stored records, user notes, strategy names, and external article content untranslated. Translate only presentation.
- Use `uiLocale()` for user-facing dates. Do not change fixed market-calendar calculation locales.
- Run the translation coverage test and web build after UI changes. Check English labels in narrow windows as well as Chinese labels.
- Keep native desktop menus and alerts bilingual when changing them.
