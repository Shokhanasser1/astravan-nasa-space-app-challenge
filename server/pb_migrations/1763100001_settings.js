/// <reference path="../pb_data/types.d.ts" />

// Server settings: real client IP from Caddy, and a rate limit on anonymous writes.
// The limit is generous on purpose: a whole class plays behind one school Wi-Fi IP.
migrate((app) => {
  const settings = app.settings();
  settings.meta.appName = 'HOME BY SEVEN';
  settings.trustedProxy.headers = ['X-Forwarded-For'];
  settings.trustedProxy.useLeftmostIP = false;
  settings.rateLimits.enabled = true;
  settings.rateLimits.rules = [
    { label: '*:create', audience: '', duration: 60, maxRequests: 600 },
    { label: '/api/', audience: '', duration: 10, maxRequests: 300 },
  ];
  app.save(settings);
});
