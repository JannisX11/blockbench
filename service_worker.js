const cacheName = 'blockbench_3.8.0';
const staticAssets = [
	'./index.html',
	'./lang/de.json',
	'./lang/en.json',
	'./lang/es.json',
	'./lang/fr.json',
	'./lang/it.json',
	'./lang/ja.json',
	'./lang/ko.json',
	'./lang/nl.json',
	'./lang/pl.json',
	'./lang/pt.json',
	'./lang/ru.json',
	'./lang/sv.json',
	'./lang/zh.json',
	'./assets/armor_stand.png',
	'./assets/brush.png',
	'./assets/hud.png',
	'./assets/inventory_full.png',
	'./assets/inventory_nine.png',
	'./assets/item_frame.png',
	'./assets/logo_cutout.svg',
	'./assets/missing.png',
	'./assets/north.png',
	'./assets/player_skin.png',
	'./assets/zombie.png',
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

	if (url.origin == location.origin) {
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
