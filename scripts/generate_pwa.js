const workbox = require('workbox-build');

workbox.generateSW({
	cacheId: 'blockbench',
	globDirectory: './',
	globPatterns: [
		'./index.html',
		'./favicon.png',
		'./service_worker.js',

		'./js/**/*',
		'./lib/**/*',
		'./css/**/*',
		'./assets/**/*',
		'./font/*',
		'./lang/*',
	],
	swDest: './service_worker.js',
	sourcemap: false
}).then(({count, size}) => {
	console.log(`Generated service-worker, which will precache ${count} files, totaling ${(size/1e6).toFixed(2)} MB.`);
});
