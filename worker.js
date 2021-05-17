const version = '1.0';
self.addEventListener('install', e =>
{
	e.waitUntil(
		caches.open(`biz-cache-${ version }`).then(cache =>
		{
			return cache.addAll([
				`./`,
				`./index.html`,
				`./Enum.js`,
				`./Event.js`,
				`./Command.js`,
				`./Observable.js`,
				`./Util.js`,
				`./main.js`,
				`./style.css`,
			]);
		}));
});

self.addEventListener('fetch', e =>
{
	console.log(e.request.url);
	e.respondWith(
		caches.match(e.request).then(response =>
		{
			return response || fetch(e.request);
		}));
});