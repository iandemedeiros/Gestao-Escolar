/* Read-only publication: never send API requests to GitHub Pages. */
window.addEventListener('load', () => {
  window.ui = SwaggerUIBundle({
    url: new URL('./openapi.json', window.location.href).href,
    dom_id: '#swagger-ui',
    deepLinking: true,
    supportedSubmitMethods: [],
    tryItOutEnabled: false,
    persistAuthorization: false,
    queryConfigEnabled: false,
    validatorUrl: null,
    presets: [SwaggerUIBundle.presets.apis],
    layout: 'BaseLayout',
  });
});
