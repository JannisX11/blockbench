if (Blockbench.Cube !== Cube || Blockbench.Project !== Project) {
	throw new Error('Live Blockbench globals are not connected')
}

Undo.initEdit({outliner: true, elements: [], selection: true})
const cube = new Cube({
	name: args[0] || 'headless_cube',
	from: [0, 0, 0],
	to: [2, 3, 4],
}).init()
Undo.finishEdit('Add headless test cube', {outliner: true, elements: [cube], selection: true})
Canvas.updateAll()

console.log('created', cube.name)
return {
	name: cube.name,
	from: cube.from,
	to: cube.to,
	undoEntries: Undo.history.length,
}
