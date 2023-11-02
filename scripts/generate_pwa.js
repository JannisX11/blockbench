const workbox = require('workbox-build');

workbox.generateSW({
	cacheId: 'blockbench',
	globDirectory: './',
	globPatterns: [
		'./index.html',
		'./favicon.png',

		'./js/**/*',
		'./lib/**/*',
		'./css/**/*',
		'./assets/**/*',
		'./font/*',
	],
	swDest: './service_worker.js',
	sourcemap: false
}).then(({count, size}) => {
	console.log(`Generated service-worker, which will precache ${count} files, totaling ${(size/1e6).toFixed(2)} MB.`);
});
