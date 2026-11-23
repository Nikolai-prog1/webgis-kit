type AppContext = {
  config: any;
  map?: import('ol/Map.js').default;
  view?: import('ol/View.js').default;
  locale: string;
  t: (key: string, params?: Record<string, any>) => string;
  localized: (value: any) => string;
  hooks: any;
  storage: any;
  ui: any;
  services?: any;
  layers?: any;
  query?: any;
  tools?: any;
  clicks?: any;
  crs?: any;
  [key: string]: any;
};
