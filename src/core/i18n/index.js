import en from './locales/en.json';
import bg from './locales/bg.json';
export function localized(value, locale = 'en') {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'object') return String(value);
  return String(value[locale] ?? value.en ?? Object.values(value)[0] ?? '');
}
export function createI18n(locale, messages = {}) {
  const dictionaries = { en, bg };
  const dictionary = {
    ...dictionaries.en,
    ...dictionaries[locale],
    ...messages[locale],
  };
  const plural = new Intl.PluralRules(locale);
  return {
    locale,
    localized: (value) => localized(value, locale),
    t(key, params = {}) {
      const pluralKey =
        'count' in params
          ? `${key}_${plural.select(Number(params.count))}`
          : '';
      const value = dictionary[pluralKey] ?? dictionary[key] ?? key;
      return value.replace(/\{(\w+)\}/g, (_, name) =>
        String(params[name] ?? `{${name}}`),
      );
    },
  };
}
