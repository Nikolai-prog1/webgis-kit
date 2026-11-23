export default {
  id: 'city-popup',
  setup(ctx) {
    ctx.ui.popup.registerFormatter('cityCard', ({ properties }) => ({
      title: properties.name,
      rows: [
        [ctx.localized({ en: 'Country', bg: 'Държава' }), properties.country],
        [
          ctx.t('demo.population'),
          new Intl.NumberFormat(ctx.locale).format(properties.population),
        ],
      ],
    }));
  },
};
