const defaults = {
  app: { locale: 'en', locales: ['en'] },
  branding: {},
  links: [],
  map: { center: [0, 0], zoom: 2, minZoom: 0, maxZoom: 22 },
  crs: [{ code: 'EPSG:4326', label: 'WGS84', kind: 'geographic', decimals: 5 }],
  services: {},
  basemaps: {
    default: 'none',
    allowNone: true,
    opacityControl: true,
    items: [],
  },
  layers: [],
  catalogs: [],
  sidebar: [],
  toolbar: [],
  statusBar: { coordinates: [], scaleLine: true },
  identify: { enabled: true, featureCount: 5, buffer: 12, hoverCursor: false },
  print: {
    defaultTitle: '',
    showLogo: true,
    northArrow: true,
    legend: true,
    filenamePrefix: 'map',
  },
  messages: {},
};
export function normalize(input, catalogs = {}) {
  const config = structuredClone({ ...defaults, ...input });
  for (const key of [
    'app',
    'map',
    'basemaps',
    'statusBar',
    'identify',
    'print',
  ])
    config[key] = { ...defaults[key], ...config[key] };
  function layer(def, extra = {}, inherited = {}) {
    const source = {
      type: 'wms',
      ...(inherited.service ? { service: inherited.service } : {}),
      ...def.source,
    };
    const query =
      def.query ||
      (['wms', 'wfs'].includes(source.type)
        ? {
            service: source.service,
            typeName: source.typeName || source.layers,
          }
        : undefined);
    return {
      visible: false,
      opacity: 1,
      queryable: true,
      table: true,
      geometry: 'raster',
      fields: {},
      ...inherited,
      ...def,
      source,
      query,
      ...extra,
    };
  }
  config.layers = config.layers.map((def) => layer(def));
  config.catalogs = config.catalogs.map((cat) => {
    const data = catalogs[cat.id] || cat;
    return {
      ...cat,
      groups: (data.groups || []).map((group) => ({
        ...group,
        layers: (group.layers || []).map((def) =>
          layer(
            def,
            {
              catalogId: cat.id,
              groupId: group.id,
              exclusive: !!group.exclusive,
              groupTitle: group.title,
              catalogTitle: cat.title,
            },
            {
              ...data.defaults,
              ...(group.opacity !== undefined
                ? { opacity: group.opacity }
                : {}),
            },
          ),
        ),
      })),
    };
  });
  return config;
}
export function allLayerDefs(config) {
  return [
    ...config.layers,
    ...config.catalogs.flatMap((cat) =>
      cat.groups.flatMap((group) => group.layers),
    ),
  ];
}
export function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}
