const cacheName = 'blockbench_3.2.0';
const staticAssets = [
	'./',
	'./index.html',
	'./css/',
	'./js',
	'./lib',
	'./font',
	'./lang',
	'./assets',
	'./favicon.png',
	'./manifest.json',
];

self.addEventListener('install', async (event) => {
	var cache = await caches.open(cacheName);
	await cache.addAll(staticAssets);
	return self.skipWaiting();
})

self.addEventListener('activate', (event) => {
	self.clients.claim();
})

self.addEventListener('fetch', async (event) => {
	var req = event.request;
	var url = new URL(req.url);

	if (url.origin == 'location.origin') {
		event.respondWith(cacheFirst(req));
	} else {
		event.respondWith(networkAndCache(req));
	}
})

async function cacheFirst(req) {
	var cache = await caches.open(cacheName);
	var cached = await cache.match(req);
	return cached || fetch(req);
}
async function networkAndCache(req) {
	var cache = await caches.open(cacheName);
	try {
		var fresh = await fetch(req);
		await cache.put(req, fresh.clone());
		return fresh;
	} catch (err) {
		var cached = await cache.match(req);
		return cached;
	}
}