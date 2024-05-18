const workbox = require('workbox-build');
const fs = require('fs');

let bundle_file = fs.readFileSync('./js/webpack/bundle.js', 'utf-8');
if (bundle_file.match(/</)) {
	console.error('\x1b[31m', 'Invalid symbol detected in bundle');
	process.exit(1);
}

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
