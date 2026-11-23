export function createServices(config, base = document.baseURI) {
  const get = (id) => {
    const service = config.services[id];
    if (!service) throw new Error(`Unknown service: ${id}`);
    return service;
  };
  const endpoint = (id, kind) => {
    const service = get(id);
    const url = new URL(service.url, base);
    if (service.type === 'geoserver') {
      let prefix = url.pathname
        .replace(/\/(ows|wms|wfs)\/?$/i, '')
        .replace(/\/$/, '');
      const workspace =
        service.workspace && encodeURIComponent(service.workspace);
      if (workspace && prefix.split('/').at(-1) !== workspace)
        prefix += `/${workspace}`;
      url.pathname = `${prefix}/${kind}`;
    }
    return url.href;
  };
  const qualified = (id, name) => {
    const workspace = get(id).workspace;
    return workspace && !name.includes(':') ? `${workspace}:${name}` : name;
  };
  return {
    get,
    wmsUrl: (id) => endpoint(id, 'wms'),
    wfsUrl: (id) => endpoint(id, 'wfs'),
    qualified,
  };
}
