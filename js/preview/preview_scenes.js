class PreviewScene {
	constructor(id, data) {
		PreviewScene.scenes[id] = this;
		this.id = id;

		this.name = tl(data.name || `preview_scene.${id}`);
		if (data.description) {
			this.description = tl(data.description);
		} else {
			var key = `action.${this.id}.desc`;
			this.description = tl('action.'+this.id+'.desc')
			if (this.description == key) this.description = '';
		}
		this.light_color = data.light_color || {r: 1, g: 1, b: 1};
		this.light_side = data.light_side || 0;
		this.condition = data.condition;

		this.preview_models = (!data.preview_models) ? [] : data.preview_models.map(model => {
			if (typeof model == 'string') return PreviewModel.models[model];
			return model;
		})

		PreviewScene.select_options[id] = this.name;
	}
	select() {
		this.preview_models.forEach(model => {
			model.enable();
		})

		Canvas.global_light_color.copy(this.light_color);
		Canvas.global_light_side = this.light_side;
		PreviewScene.active = this;
		Canvas.updateShading();
	}
	unselect() {
		this.preview_models.forEach(model => {
			model.disable();
		})

		Canvas.global_light_color.set(0xffffff);
		Canvas.global_light_side = 0;
		Canvas.updateShading();
	}
}
PreviewScene.scenes = {};
PreviewScene.active = null;
PreviewScene.select_options = {
	none: tl('generic.none')
};

class PreviewModel {
	constructor(id, data) {
		PreviewModel.models[id] = this;
		this.condition = data.condition;
		this.model_3d = new THREE.Object3D();
		this.onUpdate = data.onUpdate;

		this.cubes = data.cubes;
		this.texture 
	}
	enable() {
		Canvas.scene.add(this.model_3d);
		this.update();
	}
	disable() {
		Canvas.scene.add(this.model_3d);
	}
	update() {
		if (typeof this.onUpdate == 'function') {
			this.onUpdate();
		}
		this.model_3d.visible = !!Condition(this.condition);
	}
	buildModel() {
		var scope = this;
		if (texture === 'black') {
			var mat = new THREE.MeshBasicMaterial({color: 0x101013});
		} else {
			var img = new Image();
			img.src = texture;
			var tex = new THREE.Texture(img);
			img.tex = tex;
			img.tex.magFilter = THREE.NearestFilter;
			img.tex.minFilter = THREE.NearestFilter;
			img.onload = function() {
				this.tex.needsUpdate = true;
			}
			img.crossOrigin = '';
			var mat = new THREE.MeshLambertMaterial({
				color: 0xffffff,
				map: tex,
				side: 2,
				alphaTest: 0.05
			});
		}

		scope.material = mat

		things.forEach(function(s) {
			var mesh = new THREE.Mesh(new THREE.BoxGeometry(s.size[0], s.size[1], s.size[2]), mat)
			if (s.origin) {
				mesh.position.set(s.origin[0], s.origin[1], s.origin[2])
				mesh.geometry.translate(-s.origin[0], -s.origin[1], -s.origin[2])
			}
			mesh.geometry.translate(s.pos[0], s.pos[1], s.pos[2])
			if (s.rotation) {
				mesh.rotation.setFromDegreeArray(s.rotation)
			}
			if (s.model) {
				mesh.r_model = s.model
			}
			mesh.name = s.name || '';

			function getUVArray(face) {
				var arr = [
					[face.uv[0]/16, 1-(face.uv[1]/16)],
					[face.uv[2]/16, 1-(face.uv[1]/16)],
					[face.uv[0]/16, 1-(face.uv[3]/16)],
					[face.uv[2]/16, 1-(face.uv[3]/16)]
				]
				var rot = (face.rotation+0)
				while (rot > 0) {
					let a = arr[0];
					arr[0] = arr[2];
					arr[2] = arr[3];
					arr[3] = arr[1];
					arr[1] = a;
					rot = rot-90;
				}
				return arr;
			}

			for (var face in s) {
				if (s.hasOwnProperty(face) && s[face].uv !== undefined) {
					var fIndex = 0;
					switch(face) {
						case 'north':   fIndex = 10;   break;
						case 'east':	fIndex = 0;	break;
						case 'south':   fIndex = 8;	break;
						case 'west':	fIndex = 2;	break;
						case 'up':	  fIndex = 4;	break;
						case 'down':	fIndex = 6;	break;
					}
					let uv_array = getUVArray(s[face]);
					mesh.geometry.attributes.uv.array.set(uv_array[0], fIndex*4 + 0);  //0,1
					mesh.geometry.attributes.uv.array.set(uv_array[1], fIndex*4 + 2);  //1,1
					mesh.geometry.attributes.uv.array.set(uv_array[2], fIndex*4 + 4);  //0,0
					mesh.geometry.attributes.uv.array.set(uv_array[3], fIndex*4 + 6);  //1,0
					mesh.geometry.attributes.uv.needsUpdate = true;
				}
			}

			scope.model.add(mesh);
		})
		scope.model.name = name;
		return this;
	}
}
PreviewModel.models = {};
PreviewModel.getActiveModels = function() {
	if (PreviewScene.active) {
		return PreviewScene.active.preview_models.filter(model => Condition(model.condition));
	}
	return [];
}


new PreviewModel('minecraft_overworld', {

})
new PreviewModel('minecraft_nether', {

})
new PreviewModel('minecraft_end', {

})
new PreviewScene('minecraft_overworld', {
	preview_models: ['minecraft_overworld']
});
new PreviewScene('minecraft_nether', {
	light_color: {r: 0.68, g: 0.61, b: 0.49},
	light_side: 1,
	preview_models: ['minecraft_nether']
});
new PreviewScene('minecraft_end', {
	light_color: {r: 0.45, g: 0.52, b: 0.48},
	preview_models: ['minecraft_overworld']
});


BARS.defineActions(function() {
	new BarSelect('preview_scene', {
		category: 'view',
		//condition: () => Format,
		value: 'none',
		options: PreviewScene.select_options,
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
