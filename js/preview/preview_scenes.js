class PreviewScene {
	constructor(id, data) {
		PreviewScene.scenes[id] = this;
		this.id = id;

		this.name = tl(data.name || `preview_scene.${id}`);
		this.light_color = data.light_color || {r: 1, g: 1, b: 1};
		this.condition = data.condition;
	}
	select() {
		console.log(this.light_color)
		Canvas.global_light_color.copy(this.light_color);
		updateShading();
	}
	unselect() {
		Canvas.global_light_color.set(0xffffff);
		updateShading();
	}
}
PreviewScene.scenes = {};
PreviewScene.active = null;



new PreviewScene('minecraft_nether', {
	light_color: {r: 0.68, g: 0.61, b: 0.49}
});
new PreviewScene('minecraft_end', {
	light_color: {r: 0.45, g: 0.52, b: 0.48}
});


BARS.defineActions(function() {
	new BarSelect('preview_scene', {
		category: 'view',
		condition: () => Format && Format.preview_scenes,
		value: 'none',
		options: {
			none: tl('generic.none'),
			minecraft_nether: 'Nether',
			minecraft_end: 'The End'
		},
		/*
		options() {
			let opts = {
				none: tl('generic.none')
			}
			for (let id in PreviewScene.scenes) {
				let scene = PreviewScene.scenes[id];
				opts[id] = scene.name;
			}
			return opts;
		},*/
		onChange() {
			let scene = PreviewScene.scenes[this.value];
			if (scene) {
				scene.select();
			} else if (PreviewScene.active) {
				PreviewScene.active.unselect();
			}
		}
	})
})
