
//FIXME - This file should be deleted before the PR is merged!
(() => {
	Blockbench.on('all_plugins_loaded', () => {
		Blockbench.log('All plugins loaded!')
	})
	const plugin = BBPlugin.register('test-plugin', {
		name: 'Test Plugin',
		icon: 'extension',
		description: 'A test plugin',
		author: 'SnaveSutit',
		onload() {
			debugger
			plugin.log('Test Plugin registered!')
		}
	})
})()