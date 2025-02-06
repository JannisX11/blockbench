
//FIXME - This file should be deleted before the PR is merged!
(() => {
	console.log('Hello, World!')
	Blockbench.on('all_plugins_loaded', () => {
		console.log('All plugins loaded!')
	})
})()