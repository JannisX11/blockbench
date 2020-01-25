var display = {}
Blockbench.display_settings = display
var ground_animation = false;
var ground_timer = 0
var display_slot;
var display_presets;
var display_preview;
var enterDisplaySettings, exitDisplaySettings;
const DisplayMode = {};


class DisplaySlot {
	constructor(id, data) {
		this.default()
		if (data) this.extend(data)
	}
	default() {
		this.rotation = [0, 0, 0];
		this.translation = [0, 0, 0];
		this.scale = [1, 1, 1];
		this.mirror = [false, false, false]
		return this;
	}
	copy() {
		return {
			rotation: this.rotation.slice(),
			translation: this.translation.slice(),
			scale: this.scale.slice(),
			mirror: this.mirror.slice()
		}
	}
	export() {
		var build = {}
		if (!this.rotation.allEqual(0)) build.rotation = this.rotation
		if (!this.translation.allEqual(0)) build.translation = this.translation
		if (!this.scale.allEqual(1) || !this.mirror.allEqual(false)) {
			build.scale = this.scale.slice()
			if (!this.mirror.allEqual(false)) {

				for (var i = 0; i < 3; i++) {
					build.scale[i] *= this.mirror[i] ? -1 : 1;
				}
			}
		}
		if (Object.keys(build).length) {
			return build;
		}
	}
	extend(data) {
		if (!data) return this;
		for (var i = 0; i < 3; i++) {
			if (data.rotation) Merge.number(this.rotation, data.rotation, i)
			if (data.translation) Merge.number(this.translation, data.translation, i)
			if (data.mirror) Merge.boolean(this.mirror, data.mirror, i)
			if (data.scale) Merge.number(this.scale, data.scale, i)
			this.scale[i] = Math.abs(this.scale[i])
			if (data.scale && data.scale[i] < 0) this.mirror[i] = true;
		}
		this.update()
		return this;
	}
	update() {
		if (display_mode && this === DisplayMode.slot) {
			DisplayMode.vue.$forceUpdate()
			DisplayMode.updateDisplayBase()
		}
		return this;
	}
}

(function() {


display_presets = [
	{id: 'item', fixed: true, areas: {
			ground: {
				rotation: [ 0, 0, 0 ],
				translation: [ 0, 2, 0],
				scale:[ 0.5, 0.5, 0.5 ]
			},
			head: {
				rotation: [ 0, 180, 0 ],
				translation: [ 0, 13, 7],
				scale:[ 1, 1, 1]
			},
			thirdperson_righthand: {
				rotation: [ 0, 0, 0 ],
				translation: [ 0, 3, 1 ],
				scale: [ 0.55, 0.55, 0.55 ]
			},
			thirdperson_lefthand: {
				rotation: [ 0, 0, 0 ],
				translation: [ 0, 3, 1 ],
				scale: [ 0.55, 0.55, 0.55 ]
			},
			firstperson_righthand: {
				rotation: [ 0, -90, 25 ],
				translation: [ 1.13, 3.2, 1.13],
				scale: [ 0.68, 0.68, 0.68 ]
			},
			firstperson_lefthand: {
				rotation: [ 0, -90, 25 ],
				translation: [ 1.13, 3.2, 1.13],
				scale: [ 0.68, 0.68, 0.68 ]
			},
			fixed: {
				rotation: [ 0, 180, 0 ],
				translation: [ 0, 0, 0 ],
				scale: [ 1, 1, 1 ],
			}
		}
	},
	{id: 'block', fixed: true, areas: {
		gui: {
			rotation: [ 30, 225, 0 ],
			translation: [ 0, 0, 0],
			scale:[ 0.625, 0.625, 0.625 ]
		},
		ground: {
			rotation: [ 0, 0, 0 ],
			translation: [ 0, 3, 0],
			scale:[ 0.25, 0.25, 0.25 ]
		},
		fixed: {
			rotation: [ 0, 0, 0 ],
			translation: [ 0, 0, 0],
			scale:[ 0.5, 0.5, 0.5 ]
		},
		thirdperson_righthand: {
			rotation: [ 75, 45, 0 ],
			translation: [ 0, 2.5, 0],
			scale: [ 0.375, 0.375, 0.375 ]
		},
		thirdperson_lefthand: {
			rotation: [ 75, 45, 0 ],
			translation: [ 0, 2.5, 0],
			scale: [ 0.375, 0.375, 0.375 ]
		},
		firstperson_righthand: {
			rotation: [ 0, 45, 0 ],
			translation: [ 0, 0, 0 ],
			scale: [ 0.40, 0.40, 0.40 ]
		},
		firstperson_lefthand: {
			rotation: [ 0, 225, 0 ],
			translation: [ 0, 0, 0 ],
			scale: [ 0.40, 0.40, 0.40 ]
		}
	}
	},
	{id: 'handheld', fixed: true, areas: {
		thirdperson_righthand: {
			rotation: [ 0, -90, 55 ],
			translation: [ 0, 4.0, 0.5 ],
			scale: [ 0.85, 0.85, 0.85 ]
		},
		thirdperson_lefthand: {
			rotation: [ 0, 90, -55 ],
			translation: [ 0, 4.0, 0.5 ],
			scale: [ 0.85, 0.85, 0.85 ]
		},
		firstperson_righthand: {
			rotation: [ 0, -90, 25 ],
			translation: [ 1.13, 3.2, 1.13 ],
			scale: [ 0.68, 0.68, 0.68 ]
		},
		firstperson_lefthand: {
			rotation: [ 0, 90, -25 ],
			translation: [ 1.13, 3.2, 1.13 ],
			scale: [ 0.68, 0.68, 0.68 ]
		}
	}
	},
	{id: 'rod', fixed: true, areas: {
		thirdperson_righthand: {
			rotation: [ 0, 90, 55 ],
			translation: [ 0, 4.0, 2.5 ],
			scale: [ 0.85, 0.85, 0.85 ]
		},
		thirdperson_lefthand: {
			rotation: [ 0, -90, -55 ],
			translation: [ 0, 4.0, 2.5 ],
			scale: [ 0.85, 0.85, 0.85 ]
		},
		firstperson_righthand: {
			rotation: [ 0, 90, 25 ],
			translation: [ 0, 1.6, 0.8 ],
			scale: [ 0.68, 0.68, 0.68 ]
		},
		firstperson_lefthand: {
			rotation: [ 0, -90, -25 ],
			translation: [ 0, 1.6, 0.8 ],
			scale: [ 0.68, 0.68, 0.68 ]
		}
	}
	}
]
if (localStorage.getItem('display_presets') != null) {
	var stored_display_presets = JSON.parse(localStorage.getItem('display_presets'))
	$.extend(display_presets, stored_display_presets)
}



class refModel {
	constructor(id) {
		var scope = this;
		this.model = new THREE.Object3D();
		this.name = tl('display.reference.'+id);
		this.id = id;
		this.icon = id;
		this.initialized = false;

		switch (id) {
			case 'player':
				this.onload = function() {
					let angle = Math.degToRad(scope.angle||22.5)
					let x = scope.variant === 'alex' ? 5.5 : 6
					let y = 22 - Math.cos(angle)*10 + Math.sin(angle)*2
					let z = 	 Math.sin(angle)*10 + Math.cos(angle)*2

					if (display_slot === 'thirdperson_righthand') {
						setDisplayArea(x, y, -z, -67.5,0,0, 1, 1, 1)
					} else if (display_slot === 'thirdperson_lefthand') {
						setDisplayArea(-x, y, -z, -67.5,0,0, 1, 1, 1)
					} else if (display_slot === 'head') {
						setDisplayArea(0, 28, 0, 0, 0, 0, 0.625, 0.625, 0.625)
					}
				}
				break;
			case 'armor_stand':
				this.onload = function() {
					if (display_slot === 'thirdperson_righthand') {
						setDisplayArea(-2, 6, -6, -90, 0, 90, 1, 1, 1)
					} else if (display_slot === 'thirdperson_lefthand') {
						setDisplayArea(-2, 6, 6, -90, 0, 90, 1, 1, 1)
					} else if (display_slot === 'head') {
						setDisplayArea(0, 21, 0, 0, 90, 0, 0.625, 0.625, 0.625)
					}
				}
				break;
			case 'armor_stand_small':
				this.onload = function() {
					if (display_slot === 'thirdperson_righthand') {
						setDisplayArea(-1, 0, -3, -90, 0, 90, 0.5, 0.5, 0.5)
					} else if (display_slot === 'thirdperson_lefthand') {
						setDisplayArea(-1, 0, 3, -90, 0, 90, 0.5, 0.5, 0.5)
					} else if (display_slot === 'head') {
						setDisplayArea(0, 8.5, 0, 0, 90, 0, 0.4635, 0.4635, 0.4635)
					}
				}
				break;
			case 'zombie':
				this.onload = function() {
					if (display_slot === 'thirdperson_righthand') {
						setDisplayArea(-10, 18, -6, -90, 90, 90, 1, 1, 1)
					} else if (display_slot === 'thirdperson_lefthand') {
						setDisplayArea(-10, 18, 6, -90, 90, 90, 1, 1, 1)
					} else if (display_slot === 'head') {
						setDisplayArea(0, 22, 0, 0, 90, 0, 0.625, 0.625, 0.625)
					}
				}
				break;
			case 'baby_zombie':
				this.onload = function() {
					if (display_slot === 'thirdperson_righthand') {
						setDisplayArea(-5, 6, -3, -90, 90, 90, 0.5, 0.5, 0.5)
					} else if (display_slot === 'thirdperson_lefthand') {
						setDisplayArea(-5, 6, 3, -90, 90, 90, 0.5, 0.5, 0.5)
					} else if (display_slot === 'head') {
						setDisplayArea(0, 8.5, 0, 0, 90, 0, 0.4635, 0.4635, 0.4635)
					}
				}
				break;
			case 'monitor':
				this.onload = function() {
					var side = display_slot.includes('left') ? -1 : 1;
					setDisplayArea(side*9, -8.4, 20.8, 0, 0, 0, 1,1,1)
				}
				break;
			case 'bow':
				this.onload = function() {
					var side = display_slot.includes('left') ? -1 : 1;
					setDisplayArea(side*4.2, -4.9, 25, -20, -19, -8, 1,1,1)
				}
				break;
			case 'crossbow':
				this.onload = function() {
					var side = display_slot.includes('left') ? -1 : 1;
					setDisplayArea(side*-1.2, -6.75, 23, 0, side*10, 0, 1, 1, 1)
				}
				break;
		}
	}
	buildModel(things, texture) {
		var scope = this;
		if (texture === 'black') {
			var mat = new THREE.MeshBasicMaterial({color: 0x000000});
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
				transparent: true,
				vertexColors: THREE.FaceColors,
				side: 2,
				alphaTest: 0.2
			});
		}

		scope.material = mat

		things.forEach(function(s) {
			var mesh = new THREE.Mesh(new THREE.CubeGeometry(s.size[0], s.size[1], s.size[2]), mat )
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
					mesh.geometry.faceVertexUvs[0][fIndex] = [ getUVArray(s[face])[0], getUVArray(s[face])[1], getUVArray(s[face])[3] ];
					mesh.geometry.faceVertexUvs[0][fIndex+1] = [ getUVArray(s[face])[1], getUVArray(s[face])[2], getUVArray(s[face])[3] ];
				}
			}
			mesh.geometry.elementsNeedUpdate = true;

			scope.model.add(mesh);
		})
		scope.model.name = name;
		return this;
	}
	setModelVariant(variant) {
		this.variant = variant;
		this.model.children.forEach((m) => {
			if (m.r_model) {
				m.visible = m.r_model === variant;
			}
		})
		if (display_mode && displayReferenceObjects.active === this) {
			this.onload()
		}
	}
	load(index) {
		displayReferenceObjects.ref_indexes[display_slot] = index || 0;
		displayReferenceObjects.clear()
		if (typeof this.onload === 'function') {
			this.onload()
		}
		//3D
		if (!this.initialized) {
			switch (this.id) {
				case 'player': this.buildPlayer(); break;
				case 'zombie': this.buildZombie(); break;
				case 'armor_stand': this.buildArmorStand(); break;
				case 'baby_zombie': this.buildBabyZombie(); break;
				case 'armor_stand_small': this.buildArmorStandSmall(); break;
				case 'monitor': this.buildMonitor(); break;
				case 'bow': this.buildMonitor(); break;
				case 'crossbow': this.buildMonitor(); break;
				case 'block': this.buildBlock(); break;
				case 'frame': this.buildFrame(); break;
			}
			this.initialized = true;
		}
		display_scene.add(this.model)
		displayReferenceObjects.active = this;
		
		display_preview.loadBackground()
	}
	buildPlayer(slim) {
		var scope = this;
		var cubes = [
			{
				//Head
				"size": [8, 8, 8],
				"pos": [0, 28, 0],
				"north": {"uv": [2.032, 2.032, 3.968, 3.968]},
				"east": {"uv": [0.032, 2.032, 1.968, 3.968]},
				"south": {"uv": [6.032, 2.032, 7.968, 3.968]},
				"west": {"uv": [4.032, 2.032, 5.968, 3.968]},
				"up": {"uv": [3.968, 1.968, 2.032, 0.032]},
				"down": {"uv": [5.968, 0.032, 4.032, 1.968]}
			},
			{
				//Head Layer
				"size": [9, 9, 9],
				"pos": [0, 28, 0],
				"north": {"uv": [10.032, 2.032, 11.968, 3.968]},
				"east": {"uv": [8.032, 2.032, 9.968, 3.968]},
				"south": {"uv": [14.032, 2.032, 15.968, 3.968]},
				"west": {"uv": [12.032, 2.032, 13.968, 3.968]},
				"up": {"uv": [11.968, 1.968, 10.032, 0.032]},
				"down": {"uv": [13.968, 0.032, 12.032, 1.968]}
			},
			{
				//Body
				"size": [8, 12, 4],
				"pos": [0, 18, 0],
				"north": {"uv": [5.032, 5.032, 6.968, 7.968]},
				"east": {"uv": [4.032, 5.032, 4.968, 7.968]},
				"south": {"uv": [8.032, 5.032, 9.968, 7.968]},
				"west": {"uv": [7.032, 5.032, 7.968, 7.968]},
				"up": {"uv": [5.032, 4.968, 6.968, 4.032]},
				"down": {"uv": [7.032, 4.032, 8.968, 4.968]}
			},
			{
				//Body Layer
				"size": [8.5, 12.5, 4.5],
				"pos": [0, 18, 0],
				"north": {"uv": [5.032, 9.032, 6.968, 11.968]},
				"east": {"uv": [4.032, 9.032, 4.968, 11.968]},
				"south": {"uv": [8.032, 9.032, 9.968, 11.968]},
				"west": {"uv": [7.032, 9.032, 7.968, 11.968]},
				"up": {"uv": [5.032, 8.968, 6.968, 8.032]},
				"down": {"uv": [7.032, 8.032, 8.968, 8.968]}
			},
			{
				//R Leg
				"size": [4, 12, 4],
				"pos": [1.95, 6, 0],
				"origin": [0, 12, 0],
				"rotation": [-1, 0, 0],
				"north": {"uv": [1.032, 5.032, 1.968, 7.968]},
				"east": {"uv": [0.032, 5.032, 0.968, 7.968]},
				"south": {"uv": [3.032, 5.032, 3.968, 7.968]},
				"west": {"uv": [2.032, 5.032, 2.968, 7.968]},
				"up": {"uv": [1.968, 4.968, 1.032, 4.032]},
				"down": {"uv": [2.968, 4.032, 2.032, 4.968]}
			},
			{
				//R Leg Layer
				"size": [4.5, 12.5, 4.5],
				"pos": [1.95, 6, 0],
				"origin": [0, 12, 0],
				"rotation": [-1, 0, 0],
				"north": {"uv": [1.032, 9.032, 1.968, 11.968]},
				"east": {"uv": [0.032, 9.032, 0.968, 11.968]},
				"south": {"uv": [3.032, 9.032, 3.968, 11.968]},
				"west": {"uv": [2.032, 9.032, 2.968, 11.968]},
				"up": {"uv": [1.968, 8.968, 1.032, 8.032]},
				"down": {"uv": [2.968, 8.032, 2.032, 8.968]}
			},
			{
				//L Leg
				"size": [4, 12, 4],
				"pos": [-1.95, 6, 0],
				"origin": [0, 12, 0],
				"rotation": [1, 0, 0],
				"north": {"uv": [5.032, 13.032, 5.968, 15.968]},
				"east": {"uv": [4.032, 13.032, 4.968, 15.968]},
				"south": {"uv": [7.032, 13.032, 7.968, 15.968]},
				"west": {"uv": [6.032, 13.032, 6.968, 15.968]},
				"up": {"uv": [5.968, 12.968, 5.032, 12.032]},
				"down": {"uv": [6.968, 12.032, 6.032, 12.968]}
			},
			{
				//L Leg Layer
				"size": [4.5, 12.5, 4.5],
				"pos": [-1.95, 6, 0],
				"origin": [0, 12, 0],
				"rotation": [1, 0, 0],
				"north": {"uv": [1.032, 13.032, 1.968, 15.968]},
				"east": {"uv": [0.032, 13.032, 0.968, 15.968]},
				"south": {"uv": [3.032, 13.032, 3.968, 15.968]},
				"west": {"uv": [2.032, 13.032, 2.968, 15.968]},
				"up": {"uv": [1.968, 12.968, 1.032, 12.032]},
				"down": {"uv": [2.968, 12.032, 2.032, 12.968]}
			},
			//Steve
			{
				//R Arm
				"size": [4, 12, 4],
				"pos": [6, 18, 0],
				"origin": [4, 22, 0],
				"rotation": [22.5, 0, 0],
				"north": {"uv": [11.032, 5.032, 11.968, 7.968]},
				"east": {"uv": [10.032, 5.032, 10.968, 7.968]},
				"south": {"uv": [13.032, 5.032, 13.968, 7.968]},
				"west": {"uv": [12.032, 5.032, 12.968, 7.968]},
				"up": {"uv": [11.968, 4.968, 11.032, 4.032]},
				"down": {"uv": [12.968, 4.032, 12.032, 4.968]},
				"model": "steve"
			},
			{
				//R Arm Layer
				"size": [4.5, 12.5, 4.5],
				"pos": [6, 18, 0],
				"origin": [4, 22, 0],
				"rotation": [22.5, 0, 0],
				"north": {"uv": [11.032, 9.032, 11.968, 11.968]},
				"east": {"uv": [10.032, 9.032, 10.968, 11.968]},
				"south": {"uv": [13.032, 9.032, 13.968, 11.968]},
				"west": {"uv": [12.032, 9.032, 12.968, 11.968]},
				"up": {"uv": [11.968, 8.968, 11.032, 8.032]},
				"down": {"uv": [12.968, 8.032, 12.032, 8.968]},
				"model": "steve"
			},
			{
				//L Arm
				"size": [4, 12, 4],
				"pos": [-6, 18, 0],
				"origin": [-4, 22, 0],
				"rotation": [22.5, 0, 0],
				"north": {"uv": [9.032, 13.032, 9.968, 15.968]},
				"east": {"uv": [8.032, 13.032, 8.968, 15.968]},
				"south": {"uv": [11.032, 13.032, 11.968, 15.968]},
				"west": {"uv": [10.032, 13.032, 10.968, 15.968]},
				"up": {"uv": [9.968, 12.968, 9.032, 12.032]},
				"down": {"uv": [10.968, 12.032, 10.032, 12.968]},
				"model": "steve"
			},
			{
				//L Arm Layer
				"size": [4.5, 12.5, 4.5],
				"pos": [-6, 18, 0],
				"origin": [-4, 22, 0],
				"rotation": [22.5, 0, 0],
				"north": {"uv": [13.032, 13.032, 13.968, 15.968]},
				"east": {"uv": [12.032, 13.032, 12.968, 15.968]},
				"south": {"uv": [15.032, 13.032, 15.968, 15.968]},
				"west": {"uv": [14.032, 13.032, 14.968, 15.968]},
				"up": {"uv": [13.968, 12.968, 13.032, 12.032]},
				"down": {"uv": [14.968, 12.032, 14.032, 12.968]},
				"model": "steve"
			},
			//ALEX
			{
				//R Arm
				"size": [3, 12, 4],
				"pos": [5.5, 18, 0],
				"origin": [0, 22, 0],
				"rotation": [22.5, 0, 0],
				"north": {"uv": [11.032, 5.032, 11.718, 7.968]},
				"east": {"uv": [10.032, 5.032, 10.968, 7.968]},
				"south": {"uv": [12.782, 5.032, 13.468, 7.968]},
				"west": {"uv": [11.782, 5.032, 12.718, 7.968]},
				"up": {"uv": [11.718, 4.968, 11.032, 4.032]},
				"down": {"uv": [12.468, 4.032, 11.782, 4.968]},
				"model": "alex"
			},
			{
				//R Arm Layer
				"size": [3.5, 12.5, 4.5],
				"pos": [5.5, 18, 0],
				"origin": [0, 22, 0],
				"rotation": [22.5, 0, 0],
				"north": {"uv": [11.032, 9.032, 11.718, 11.968]},
				"east": {"uv": [10.032, 9.032, 10.968, 11.968]},
				"south": {"uv": [12.782, 9.032, 13.468, 11.968]},
				"west": {"uv": [11.782, 9.032, 12.718, 11.968]},
				"up": {"uv": [11.718, 8.968, 11.032, 8.032]},
				"down": {"uv": [12.468, 8.032, 11.782, 8.968]},
				"model": "alex"
			},
			{
				//L Arm
				"size": [3, 12, 4],
				"pos": [-5.5, 18, 0],
				"origin": [0, 22, 0],
				"rotation": [22.5, 0, 0],
				"north": {"uv": [9.032, 13.032, 9.718, 15.968]},
				"east": {"uv": [8.032, 13.032, 8.968, 15.968]},
				"south": {"uv": [10.782, 13.032, 11.468, 15.968]},
				"west": {"uv": [9.782, 13.032, 10.718, 15.968]},
				"up": {"uv": [9.718, 12.968, 9.032, 12.032]},
				"down": {"uv": [10.468, 12.032, 9.782, 12.968]},
				"model": "alex"
			},
			{
				//L Arm Layer
				"size": [3.5, 12.5, 4.5],
				"pos": [-5.5, 18, 0],
				"origin": [0, 22, 0],
				"rotation": [22.5, 0, 0],
				"north": {"uv": [13.032, 13.032, 13.718, 15.968]},
				"east": {"uv": [12.032, 13.032, 12.968, 15.968]},
				"south": {"uv": [14.782, 13.032, 15.468, 15.968]},
				"west": {"uv": [13.782, 13.032, 14.718, 15.968]},
				"up": {"uv": [13.718, 12.968, 13.032, 12.032]},
				"down": {"uv": [14.468, 12.032, 13.782, 12.968]},
				"model": "alex"
			}
		]
		var skin = 'assets/player_skin.png';

		scope.buildModel(cubes, skin);
		this.setModelVariant('steve')
		updateDisplaySkin()
	}
	buildArmorStand() {
		this.buildModel(JSON.parse(`[
			{
				"size": [12, 1, 12],
				"pos": [0, -5.5, 0],
				"origin": [0, 0, 0],
				"north": {"uv": [0, 11, 3, 11.25]},
				"east": {"uv": [3, 11, 6, 11.25]},
				"south": {"uv": [6, 11, 9, 11.25]},
				"west": {"uv": [9, 11, 12, 11.25]},
				"up": {"uv": [3, 8, 6, 11],"rotation": 90},
				"down": {"uv": [6, 8, 9, 11], "rotation": 270}
			},
			{
				"size": [2, 11, 2],
				"pos": [0, 0.5, -2],
				"origin": [0, 0, 0],
				"north": {"uv": [8.5, 4.5, 9, 7.5]},
				"east": {"uv": [9, 4.5, 9.5, 7.5]},
				"south": {"uv": [9.5, 4.5, 10, 7.5]},
				"west": {"uv": [8, 4.5, 8.5, 7.5]},
				"up": {"uv": [8.5, 4, 9, 4.5],"rotation": 90},
				"down": {"uv": [9, 4, 9.5, 4.5], "rotation": 270}
			},
			{
				"size": [2, 11, 2],
				"pos": [0, 0.5, 2],
				"origin": [0, 0, 0],
				"north": {"uv": [8.5, 4.5, 9, 7.5]},
				"east": {"uv": [9, 4.5, 9.5, 7.5]},
				"south": {"uv": [9.5, 4.5, 10, 7.5]},
				"west": {"uv": [8, 4.5, 8.5, 7.5]},
				"up": {"uv": [8.5, 4, 9, 4.5],"rotation": 90},
				"down": {"uv": [9, 4, 9.5, 4.5], "rotation": 270}
			},
			{
				"size": [2, 2, 8],
				"pos": [0, 7, 0],
				"origin": [0, 0, 0],
				"north": {
					"uv": [0.25, 5.75, 0.75, 6.25],
					"texture": "#0"
				},
				"east": {
					"uv": [0.25, 5.75, 2.25, 6.25],
					"texture": "#0"
				},
				"south": {
					"uv": [4.75, 5.75, 5.25, 6.25],
					"texture": "#0"
				},
				"west": {
					"uv": [2.75, 5.75, 4.75, 6.25],
					"texture": "#0"
				},
				"up": {
					"uv": [0, 12.5, 2, 13],
					"texture": "#0",
					"rotation": 90,"rotation": 90
				},
				"down": {
					"uv": [0, 12.5, 2, 13],
					"texture": "#0",
					"rotation": 90, "rotation": 270
				}
			},
			{
				"size": [2, 7, 2],
				"pos": [0, 11.5, 2],
				"origin": [0, 0, 0],
				"north": {"uv": [8.5, 4.5, 9, 7.5]},
				"east": {"uv": [9, 4.5, 9.5, 7.5]},
				"south": {"uv": [9.5, 4.5, 10, 7.5]},
				"west": {"uv": [8, 4.5, 8.5, 7.5]},
				"up": {"uv": [8.5, 4, 9, 4.5],"rotation": 90},
				"down": {"uv": [9, 4, 9.5, 4.5], "rotation": 270}
			},
			{
				"size": [2, 7, 2],
				"pos": [0, 11.5, -2],
				"origin": [0, 0, 0],
				"north": {"uv": [8.5, 4.5, 9, 7.5]},
				"east": {"uv": [9, 4.5, 9.5, 7.5]},
				"south": {"uv": [9.5, 4.5, 10, 7.5]},
				"west": {"uv": [8, 4.5, 8.5, 7.5]},
				"up": {"uv": [8.5, 4, 9, 4.5],"rotation": 90},
				"down": {"uv": [9, 4, 9.5, 4.5], "rotation": 270}
			},
			{
				"size": [3, 3, 12],
				"pos": [0, 16.505, 0],
				"origin": [0, 0, 0],
				"north": {"uv": [3, 7.25, 3.75, 8]},
				"east": {
					"uv": [3.75, 7.25, 6.75, 8],
					"texture": "#0"
				},
				"south": {
					"uv": [6.75, 7.25, 7.5, 8],
					"texture": "#0"
				},
				"west": {"uv": [0, 7.25, 3, 8]},
				"up": {
					"uv": [0.75, 6.5, 3.75, 7.25],
					"texture": "#0",
					"rotation": 90,"rotation": 90
				},
				"down": {
					"uv": [3.75, 6.5, 6.75, 7.25],
					"texture": "#0",
					"rotation": 90, "rotation": 270
				}
			},
			{
				"size": [2, 6, 2],
				"pos": [0, 21, 0],
				"origin": [0, 0, 0],
				"north": {"uv": [0.5, 0.5, 1, 2.25]},
				"east": {"uv": [1, 0.5, 1.5, 2.25]},
				"south": {"uv": [1.5, 0.5, 2, 2.25]},
				"west": {"uv": [0, 0.5, 0.5, 2.25]},
				"up": {"uv": [0.5, 0, 1, 0.5],"rotation": 90},
				"down": {"uv": [1, 0, 1.5, 0.5], "rotation": 270}
			},
			{
				"size": [2, 12, 2],
				"pos": [0, 12, -6],
				"origin": [0, 0, 0],
				"north": {"uv": [7, 0.5, 7.5, 3.5]},
				"east": {"uv": [6.5, 0.5, 6, 3.5]},
				"south": {"uv": [7.5, 0.5, 8, 3.5]},
				"west": {"uv": [6, 0.5, 6.5, 3.5]},
				"up": {"uv": [6.5, 0, 7, 0.5],"rotation": 90},
				"down": {"uv": [7, 0, 7.5, 0.5], "rotation": 270}
			},
			{
				"size": [2, 12, 2],
				"pos": [0, 12, 6],
				"origin": [0, 0, 0],
				"north": {"uv": [7, 0.5, 7.5, 3.5]},
				"east": {"uv": [6.5, 0.5, 7, 3.5]},
				"south": {"uv": [7.5, 0.5, 8, 3.5]},
				"west": {"uv": [6.5, 0.5, 6, 3.5]},
				"up": {"uv": [6.5, 0, 7, 0.5],"rotation": 90},
				"down": {"uv": [7, 0, 7.5, 0.5],"rotation": 270}
			}
		]`), 'assets/armor_stand.png')
	}
	buildArmorStandSmall() {
		this.buildModel(JSON.parse(`[
			{
				"size": [6, 0.5, 6],
				"pos": [0, -5.75, 0],
				"origin": [0, 0, 0],
				"north": {"uv": [0, 11, 3, 11.25]},
				"east": {"uv": [3, 11, 6, 11.25]},
				"south": {"uv": [6, 11, 9, 11.25]},
				"west": {"uv": [9, 11, 12, 11.25]},
				"up": {"uv": [3, 8, 6, 11],"rotation": 90},
				"down": {"uv": [6, 8, 9, 11], "rotation": 270}
			},
			{
				"size": [1, 5.5, 1],
				"pos": [0, -2.75, -1],
				"origin": [0, 0, 0],
				"north": {"uv": [8.5, 4.5, 9, 7.5]},
				"east": {"uv": [9, 4.5, 9.5, 7.5]},
				"south": {"uv": [9.5, 4.5, 10, 7.5]},
				"west": {"uv": [8, 4.5, 8.5, 7.5]},
				"up": {"uv": [8.5, 4, 9, 4.5],"rotation": 90},
				"down": {"uv": [9, 4, 9.5, 4.5], "rotation": 270}
			},
			{
				"size": [1, 5.5, 1],
				"pos": [0, -2.75, 1],
				"origin": [0, 0, 0],
				"north": {"uv": [8.5, 4.5, 9, 7.5]},
				"east": {"uv": [9, 4.5, 9.5, 7.5]},
				"south": {"uv": [9.5, 4.5, 10, 7.5]},
				"west": {"uv": [8, 4.5, 8.5, 7.5]},
				"up": {"uv": [8.5, 4, 9, 4.5],"rotation": 90},
				"down": {"uv": [9, 4, 9.5, 4.5], "rotation": 270}
			},
			{
				"size": [1, 1, 4],
				"pos": [0, 0.5, 0],
				"origin": [0, 0, 0],
				"north": {
					"uv": [0.25, 5.75, 0.75, 6.25],
					"texture": "#0"
				},
				"east": {
					"uv": [0.25, 5.75, 2.25, 6.25],
					"texture": "#0"
				},
				"south": {
					"uv": [4.75, 5.75, 5.25, 6.25],
					"texture": "#0"
				},
				"west": {
					"uv": [2.75, 5.75, 4.75, 6.25],
					"texture": "#0"
				},
				"up": {
					"uv": [0, 12.5, 2, 13],
					"texture": "#0",
					"rotation": 90
				},
				"down": {
					"uv": [0, 12.5, 2, 13],
					"texture": "#0",
					"rotation": 90
				}
			},
			{
				"size": [1, 3.5, 1],
				"pos": [0, 2.75, 1],
				"origin": [0, 0, 0],
				"north": {"uv": [8.5, 4.5, 9, 7.5]},
				"east": {"uv": [9, 4.5, 9.5, 7.5]},
				"south": {"uv": [9.5, 4.5, 10, 7.5]},
				"west": {"uv": [8, 4.5, 8.5, 7.5]},
				"up": {"uv": [8.5, 4, 9, 4.5],"rotation": 90},
				"down": {"uv": [9, 4, 9.5, 4.5], "rotation": 270}
			},
			{
				"size": [1, 3.5, 1],
				"pos": [0, 2.75, -1],
				"origin": [0, 0, 0],
				"north": {"uv": [8.5, 4.5, 9, 7.5]},
				"east": {"uv": [9, 4.5, 9.5, 7.5]},
				"south": {"uv": [9.5, 4.5, 10, 7.5]},
				"west": {"uv": [8, 4.5, 8.5, 7.5]},
				"up": {"uv": [8.5, 4, 9, 4.5],"rotation": 90},
				"down": {"uv": [9, 4, 9.5, 4.5], "rotation": 270}
			},
			{
				"size": [1.5, 1.5, 6],
				"pos": [0, 5.255, 0],
				"origin": [0, 0, 0],
				"north": {"uv": [3, 7.25, 3.75, 8]},
				"east": {
					"uv": [3.75, 7.25, 6.75, 8],
					"texture": "#0"
				},
				"south": {
					"uv": [6.75, 7.25, 7.5, 8],
					"texture": "#0"
				},
				"west": {"uv": [0, 7.25, 3, 8]},
				"up": {
					"uv": [0.75, 6.5, 3.75, 7.25],
					"texture": "#0",
					"rotation": 90
				},
				"down": {
					"uv": [3.75, 6.5, 6.75, 7.25],
					"texture": "#0",
					"rotation": 90
				}
			},
			{
				"size": [
					1.5,
					4.5,
					1.5
				],
				"pos": [0, 8.27, 0],
				"origin": [0, 0, 0],
				"north": {"uv": [0.5, 0.5, 1, 2.25]},
				"east": {"uv": [1, 0.5, 1.5, 2.25]},
				"south": {"uv": [1.5, 0.5, 2, 2.25]},
				"west": {"uv": [0, 0.5, 0.5, 2.25]},
				"up": {"uv": [0.5, 0, 1, 0.5],"rotation": 90},
				"down": {"uv": [1, 0, 1.5, 0.5], "rotation": 270}
			},
			{
				"size": [1, 6, 1],
				"pos": [0, 3, -3],
				"origin": [0, 0, 0],
				"north": {"uv": [7, 0.5, 7.5, 3.5]},
				"east": {"uv": [6.5, 0.5, 6, 3.5]},
				"south": {"uv": [7.5, 0.5, 8, 3.5]},
				"west": {"uv": [6, 0.5, 6.5, 3.5]},
				"up": {"uv": [6.5, 0, 7, 0.5],"rotation": 90},
				"down": {"uv": [7, 0, 7.5, 0.5], "rotation": 270}
			},
			{
				"size": [1, 6, 1],
				"pos": [0, 3, 3],
				"origin": [0, 0, 0],
				"north": {"uv": [7, 0.5, 7.5, 3.5]},
				"east": {"uv": [6.5, 0.5, 7, 3.5]},
				"south": {"uv": [7.5, 0.5, 8, 3.5]},
				"west": {"uv": [6.5, 0.5, 6, 3.5]},
				"up": {"uv": [6.5, 0, 7, 0.5],"rotation": 90},
				"down": {"uv": [7, 0, 7.5, 0.5], "rotation": 270}
			}
		]`), 'assets/armor_stand.png')
	}
	buildZombie() {
		this.buildModel(JSON.parse(`[
			{
				"size": [4, 12, 4],
				"pos": [0, 0, -2],
				"origin": [0, 0, 0],
				"north": {
					"uv": [0.01, 5.01, 0.99, 7.99],
					"texture": "#1"
				},
				"east": {
					"uv": [3.01, 5.01, 3.99, 7.99],
					"texture": "#1"
				},
				"south": {
					"uv": [2.01, 5.01, 2.99, 7.99],
					"texture": "#1"
				},
				"west": {
					"uv": [1.01, 5.01, 1.99, 7.99],
					"texture": "#1"
				},
				"up": {
					"uv": [1.01, 4.01, 1.99, 4.99],
					"texture": "#1",
					"rotation": 90
				},
				"down": {
					"uv": [2.01, 4.01, 2.99, 4.99],
					"texture": "#1",
					"rotation": 90
				}
			},
			{
				"size": [4, 12, 4],
				"pos": [0, 0, 2],
				"origin": [0, 0, 0],
				"north": {
					"uv": [4.01, 13.01, 4.99, 15.99],
					"texture": "#1"
				},
				"east": {
					"uv": [8.01, 13.01, 6.99, 15.99],
					"texture": "#1"
				},
				"south": {
					"uv": [6.01, 13.01, 6.99, 15.99],
					"texture": "#1"
				},
				"west": {
					"uv": [5.01, 13.01, 5.99, 15.99],
					"texture": "#1"
				},
				"up": {
					"uv": [5.01, 12.01, 5.99, 12.99],
					"texture": "#1",
					"rotation": 90
				},
				"down": {
					"uv": [6.01, 12.01, 6.99, 12.99],
					"texture": "#1",
					"rotation": 90
				}
			},
			{
				"size": [4, 12, 8],
				"pos": [0, 12, 0],
				"origin": [0, 0, 0],
				"north": {
					"uv": [4.01, 5.01, 4.99, 7.99],
					"texture": "#1"
				},
				"east": {
					"uv": [8.01, 5.01, 9.99, 7.99],
					"texture": "#1"
				},
				"south": {
					"uv": [7.01, 5.01, 7.99, 7.99],
					"texture": "#1"
				},
				"west": {
					"uv": [5.01, 5.01, 6.99, 7.99],
					"texture": "#1"
				},
				"up": {
					"uv": [5.01, 4.01, 6.99, 4.99],
					"texture": "#1",
					"rotation": 90
				},
				"down": {
					"uv": [7.01, 4.01, 8.99, 4.99],
					"texture": "#1",
					"rotation": 270
				}
			},
			{
				"size": [8, 8, 8],
				"pos": [0, 22, 0],
				"origin": [0, 0, 0],
				"north": {
					"uv": [0.01, 2.01, 1.99, 3.99],
					"texture": "#1"
				},
				"east": {
					"uv": [6.01, 2.01, 7.99, 3.99],
					"texture": "#1"
				},
				"south": {
					"uv": [4.01, 2.01, 5.99, 3.99],
					"texture": "#1"
				},
				"west": {
					"uv": [2.01, 2.01, 3.99, 3.99],
					"texture": "#1"
				},
				"up": {
					"uv": [2.01, 0.01, 3.99, 1.99],
					"texture": "#1",
					"rotation": 90
				},
				"down": {
					"uv": [4.01, 0.01, 5.99, 1.99],
					"texture": "#1",
					"rotation": 90
				}
			},
			{
				"size": [12, 4, 4],
				"pos": [-4, 16, -6],
				"origin": [0, 0, 0],
				"north": {
					"uv": [12.01, 5.01, 12.99, 7.99],
					"texture": "#1",
					"rotation": 270
				},
				"east": {
					"uv": [11.01, 4.01, 11.99, 4.99],
					"texture": "#1",
					"rotation": 180
				},
				"south": {
					"uv": [10.01, 5.01, 10.99, 7.99],
					"texture": "#1",
					"rotation": 90
				},
				"west": {
					"uv": [12.01, 4.01, 12.99, 4.99],
					"texture": "#1",
					"rotation": 180
				},
				"up": {
					"uv": [11.01, 5.01, 11.99, 7.99],
					"texture": "#1",
					"rotation": 90
				},
				"down": {
					"uv": [13.01, 5.01, 13.99, 7.99],
					"texture": "#1",
					"rotation": 90
				}
			},
			{
				"size": [12, 4, 4],
				"pos": [-4, 16, 6],
				"origin": [0, 0, 0],
				"north": {
					"uv": [10.01, 13.01, 10.99, 15.99],
					"texture": "#1",
					"rotation": 270
				},
				"east": {
					"uv": [9.01, 12.01, 9.99, 12.99],
					"texture": "#1",
					"rotation": 180
				},
				"south": {
					"uv": [8.01, 13.01, 8.99, 15.99],
					"texture": "#1",
					"rotation": 90
				},
				"west": {
					"uv": [10.01, 12.01, 10.99, 12.99],
					"texture": "#1",
					"rotation": 180
				},
				"up": {
					"uv": [9.01, 13.01, 9.99, 15.99],
					"texture": "#1",
					"rotation": 90
				},
				"down": {
					"uv": [11.01, 13.01, 11.99, 15.99],
					"texture": "#1",
					"rotation": 90
				}
			}
		]`), 'assets/zombie.png')
	}
	buildBabyZombie() {
		this.buildModel(JSON.parse(`[
			{
				"size": [2, 6, 2],
				"pos": [-2.220446049250313e-16, -3, -1],
				"origin": [0, 0, 0],
				"north": {
					"uv": [0.01, 5.01, 0.99, 7.99],
					"texture": "#1"
				},
				"east": {
					"uv": [3.01, 5.01, 3.99, 7.99],
					"texture": "#1"
				},
				"south": {
					"uv": [2.01, 5.01, 2.99, 7.99],
					"texture": "#1"
				},
				"west": {
					"uv": [1.01, 5.01, 1.99, 7.99],
					"texture": "#1"
				},
				"up": {
					"uv": [1.01, 4.01, 1.99, 4.99],
					"texture": "#1",
					"rotation": 90
				},
				"down": {
					"uv": [2.01, 4.01, 2.99, 4.99],
					"texture": "#1",
					"rotation": 90
				}
			},
			{
				"size": [2, 6, 2],
				"pos": [-2.220446049250313e-16, -3, 1],
				"origin": [0, 0, 0],
				"north": {
					"uv": [4.01, 13.01, 4.99, 15.99],
					"texture": "#1"
				},
				"east": {
					"uv": [8.01, 13.01, 6.99, 15.99],
					"texture": "#1"
				},
				"south": {
					"uv": [6.01, 13.01, 6.99, 15.99],
					"texture": "#1"
				},
				"west": {
					"uv": [5.01, 13.01, 5.99, 15.99],
					"texture": "#1"
				},
				"up": {
					"uv": [5.01, 12.01, 5.99, 12.99],
					"texture": "#1",
					"rotation": 90
				},
				"down": {
					"uv": [6.01, 12.01, 6.99, 12.99],
					"texture": "#1",
					"rotation": 90
				}
			},
			{
				"size": [2, 6, 4],
				"pos": [-2.220446049250313e-16, 3, 0],
				"origin": [0, 0, 0],
				"north": {
					"uv": [4.01, 5.01, 4.99, 7.99],
					"texture": "#1"
				},
				"east": {
					"uv": [8.01, 5.01, 9.99, 7.99],
					"texture": "#1"
				},
				"south": {
					"uv": [7.01, 5.01, 7.99, 7.99],
					"texture": "#1"
				},
				"west": {
					"uv": [5.01, 5.01, 6.99, 7.99],
					"texture": "#1"
				},
				"up": {
					"uv": [5.01, 4.01, 6.99, 4.99],
					"texture": "#1",
					"rotation": 90
				},
				"down": {
					"uv": [7.01, 4.01, 8.99, 4.99],
					"texture": "#1",
					"rotation": 270
				}
			},
			{
				"size": [6.0, 6.0, 6.0],
				"pos": [0, 9, 0],
				"origin": [0, 9, 0],
				"north": {
					"uv": [0.01, 2.01, 1.99, 3.99],
					"texture": "#1"
				},
				"east": {
					"uv": [6.01, 2.01, 7.99, 3.99],
					"texture": "#1"
				},
				"south": {
					"uv": [4.01, 2.01, 5.99, 3.99],
					"texture": "#1"
				},
				"west": {
					"uv": [2.01, 2.01, 3.99, 3.99],
					"texture": "#1"
				},
				"up": {
					"uv": [2.01, 0.01, 3.99, 1.99],
					"texture": "#1",
					"rotation": 90
				},
				"down": {
					"uv": [4.01, 0.01, 5.99, 1.99],
					"texture": "#1",
					"rotation": 90
				}
			},
			{
				"size": [6, 2, 2],
				"pos": [-2.000000000000001, 5, -3],
				"origin": [0, 0, 0],
				"north": {
					"uv": [12.01, 5.01, 12.99, 7.99],
					"texture": "#1",
					"rotation": 270
				},
				"east": {
					"uv": [11.01, 4.01, 11.99, 4.99],
					"texture": "#1",
					"rotation": 180
				},
				"south": {
					"uv": [10.01, 5.01, 10.99, 7.99],
					"texture": "#1",
					"rotation": 90
				},
				"west": {
					"uv": [12.01, 4.01, 12.99, 4.99],
					"texture": "#1",
					"rotation": 180
				},
				"up": {
					"uv": [11.01, 5.01, 11.99, 7.99],
					"texture": "#1",
					"rotation": 90
				},
				"down": {
					"uv": [13.01, 5.01, 13.99, 7.99],
					"texture": "#1",
					"rotation": 90
				}
			},
			{
				"size": [6, 2, 2],
				"pos": [-2.000000000000001, 5, 3],
				"origin": [0, 0, 0],
				"north": {
					"uv": [10.01, 13.01, 10.99, 15.99],
					"texture": "#1",
					"rotation": 270
				},
				"east": {
					"uv": [9.01, 12.01, 9.99, 12.99],
					"texture": "#1",
					"rotation": 180
				},
				"south": {
					"uv": [8.01, 13.01, 8.99, 15.99],
					"texture": "#1",
					"rotation": 90
				},
				"west": {
					"uv": [10.01, 12.01, 10.99, 12.99],
					"texture": "#1",
					"rotation": 180
				},
				"up": {
					"uv": [9.01, 13.01, 9.99, 15.99],
					"texture": "#1",
					"rotation": 90
				},
				"down": {
					"uv": [11.01, 13.01, 11.99, 15.99],
					"texture": "#1",
					"rotation": 90
				}
			}
		]`), 'assets/zombie.png')
	}
	buildMonitor() {
		this.buildModel(JSON.parse(`[
			{"size": [8, 8, 0.1], "pos": [0, 4.93, 31.20], "origin": [0, 0, 0], "north":{"uv":[0,0,0,0]},"east":{"uv":[0,0,0,0]},"south":{"uv":[0,0,0,0]},"west":{"uv":[0,0,16,16]},"up":{"uv":[0,0,0,0]},"down":{"uv":[0,0,0,0]}},
			{"size": [8, 8, 0.1], "pos": [0, -4.93, 31.20], "origin": [0, 0, 0], "north":{"uv":[0,0,0,0]},"east":{"uv":[0,0,0,0]},"south":{"uv":[0,0,0,0]},"west":{"uv":[0,0,16,16]},"up":{"uv":[0,0,0,0]},"down":{"uv":[0,0,0,0]}},
			{"size": [8, 8, 0.1], "pos": [5.65, 0, 31.2], "origin": [0, 0, 0], "north":{"uv":[0,0,0,0]},"east":{"uv":[0,0,0,0]},"south":{"uv":[0,0,0,0]},"west":{"uv":[0,0,16,16]},"up":{"uv":[0,0,0,0]},"down":{"uv":[0,0,0,0]}},
			{"size": [8, 8, 0.1], "pos": [-5.65, 0, 31.2], "origin": [0, 0, 0], "north":{"uv":[0,0,0,0]},"east":{"uv":[0,0,0,0]},"south":{"uv":[0,0,0,0]},"west":{"uv":[0,0,16,16]},"up":{"uv":[0,0,0,0]},"down":{"uv":[0,0,0,0]}}
		]`), 'black')
	}
	buildBlock() {
		this.buildModel(JSON.parse(`[
			{"size": [16,16,16], "pos": [0, 0, 0], "origin": [0, 0, 0], "north":{"uv":[0,0,16,16]},"east":{"uv":[0,0,16,16]},"south":{"uv":[0,0,16,16]},"west":{"uv":[0,0,16,16]},"up":{"uv":[0,0,16,16]},"down":{"uv":[0,0,16,16]}}
		]`), 'assets/missing.png')
	}
	buildFrame() {
		this.buildBlock()
		this.buildModel(JSON.parse(`[
			{"size": [10,10,0.5], "pos": [0, 0, -8.25], "origin": [0, 0, 0], "north":{"uv":[3,3,13,13]},"east":{"uv":[0,0,0,0]},"south":{"uv":[0,0,0,0]},"west":{"uv":[0,0,0,0]},"up":{"uv":[0,0,0,0]},"down":{"uv":[0,0,0,0]}},

			{"size": [1,12,1], "pos": [5.5, 0, -8.5], "origin": [0, 0, 0], "north":{"uv":[2,2,3,14]},"east":{"uv":[2,2,3,14]},"south":{"uv":[2,2,3,14]},"west":{"uv":[2,2,3,14]},"up":{"uv":[2,2,3,3]},"down":{"uv":[2,2,3,3]}},
			{"size": [1,12,1], "pos": [-5.5, 0, -8.5], "origin": [0, 0, 0], "north":{"uv":[2,2,3,14]},"east":{"uv":[2,2,3,14]},"south":{"uv":[2,2,3,14]},"west":{"uv":[2,2,3,14]},"up":{"uv":[2,2,3,3]},"down":{"uv":[2,2,3,3]}},

			{"size": [10,1,1], "pos": [0, 5.5, -8.5], "origin": [0, 0, 0], "north":{"uv":[3,2,13,3]},"east":{"uv":[3,2,13,3]},"south":{"uv":[3,2,13,3]},"west":{"uv":[3,2,13,3]},"up":{"uv":[3,2,13,3]},"down":{"uv":[3,2,13,3]}},
			{"size": [10,1,1], "pos": [0, -5.5, -8.5], "origin": [0, 0, 0], "north":{"uv":[3,13,13,14]},"east":{"uv":[3,13,13,14]},"south":{"uv":[3,13,13,14]},"west":{"uv":[3,13,13,14]},"up":{"uv":[3,13,13,14]},"down":{"uv":[3,13,13,14]}}
		]`), 'assets/item_frame.png')
	}
}
window.displayReferenceObjects = {
	refmodels: {
		player: 			new refModel('player'),
		zombie: 			new refModel('zombie'),
		armor_stand: 		new refModel('armor_stand'),
		baby_zombie: 		new refModel('baby_zombie'),
		armor_stand_small:  new refModel('armor_stand_small'),
		monitor: 			new refModel('monitor'),
		bow: 				new refModel('bow'),
		crossbow: 				new refModel('crossbow'),
		block: 				new refModel('block'),
		frame: 				new refModel('frame'),
		inventory_nine: 	new refModel('inventory_nine'),
		inventory_full:		new refModel('inventory_full'),
		hud: 				new refModel('hud')
	},
	active: '',
	bar: function(buttons) {
		$('#display_ref_bar').html('')
		if (buttons.length === 10000) {
			this.refmodels[buttons[0]].load()
			return;
		}
		if (buttons.length < 2) {
			$('.reference_model_bar').css('visibility', 'hidden')
		} else {
			$('.reference_model_bar').css('visibility', 'visible')
		}
		var i = 0;
		while (i < buttons.length) {
			var ref = this.refmodels[buttons[i]]
			var icon = 'icon-'+ref.icon
			switch (icon) {
				case 'icon-monitor': icon = 'fa fa-asterisk'; break;
			}
			var button = $(
				`<div>
					<input class="hidden" type="radio" name="refmodel" id="${ref.id}"${ i === 0 ? ' selected' : '' }>
					<label class="tool" onclick="displayReferenceObjects.refmodels.${ref.id}.load(${i})" for="${ref.id}">
						<div class="tooltip">${ref.name}</div>
						<i class="${icon}"></i>
					</label>
				</div>`
			)
			$('#display_ref_bar').append(button)
			if (i === displayReferenceObjects.ref_indexes[display_slot]) {
				ref.load(i)
				button.find('input').prop("checked", true)
			}
			i++;
		}
	},
	clear: function() {
		display_scene.remove(displayReferenceObjects.active.model)
		displayReferenceObjects.active = false
		$('#donation_hint').hide()
	},
	ref_indexes: {
		thirdperson_righthand: 0,
		thirdperson_lefthand: 0,
		firstperson_righthand: 0,
		firstperson_lefthand: 0,
		ground: 0,
		gui: 0,
		head: 0,
		fixed: 0,
	},
	slots: [
		'thirdperson_righthand',
		'thirdperson_lefthand',
		'firstperson_righthand',
		'firstperson_lefthand',
		'ground',
		'gui',
		'head',
		'fixed',
	]
}
DisplayMode.slots = displayReferenceObjects.slots

enterDisplaySettings = function() {		//Enterung Display Setting Mode, changes the scene etc
	display_mode = true;

	selected.empty()
	updateSelection()

	if (!display_preview) {
		display_preview = new Preview({id: 'display'})
	}
	if (quad_previews.enabled) {
		quad_previews.enabled_before = true
	}
	display_preview.fullscreen()
	display_preview.setNormalCamera()
	display_preview.camPers.position.set(-80, 40, -30)
	display_preview.camPers.setFocalLength(45)
	
	$('body').addClass('display_mode')
	$('#display_bar input#thirdperson_righthand').prop("checked", true)


	buildGrid()
	setShading()
	DisplayMode.loadThirdRight()

	display_area.updateMatrixWorld()
	display_base.updateMatrixWorld()
	Transformer.center()
	if (outlines.children.length) {
		outlines.children.length = 0
		Canvas.updateAllPositions()
	}
}
exitDisplaySettings = function() {		//Enterung Display Setting Mode, changes the scene etc
	resetDisplayBase()
	setDisplayArea(0,0,0, 0,0,0, 1,1,1)
	display_area.updateMatrixWorld()
	display_base.updateMatrixWorld()
	lights.rotation.set(0, 0, 0);

	display_mode = false;
	main_preview.fullscreen()

	$('.selection_only').css('visibility', 'hidden')
	$('body').removeClass('display_mode')
	resizeWindow()
	//updateInterface()
	if (quad_previews.enabled_before) {
		openQuadView()
	}
	scene.add(Transformer)
	buildGrid()
	setShading()
	Canvas.updateRenderSides()
}
function axisIndex(index) {
	if (typeof index === 'number') {
		if (index === 0) return 'x';
		if (index === 1) return 'y';
		if (index === 2) return 'z';
	} else {
		if (index === 'x') return 0;
		if (index === 'y') return 1;
		if (index === 'z') return 2;
	}
}
function resetDisplayBase() {
	display_base.rotation.x = Math.PI / (180 / 0.1);
	display_base.rotation.y = Math.PI / (180 / 0.1);
	display_base.rotation.z = Math.PI / (180 / 0.1);
	display_base.position.x = 0;
	display_base.position.y = 0;
	display_base.position.z = 0;
	display_base.scale.x = 1;
	display_base.scale.y = 1;
	display_base.scale.z = 1;
}

DisplayMode.updateDisplayBase = function(slot) {
	if (!slot) slot = display[display_slot]

	display_base.rotation.x = Math.PI / (180 / slot.rotation[0]);
	display_base.rotation.y = Math.PI / (180 / slot.rotation[1]) * (display_slot.includes('lefthand') ? -1 : 1);
	display_base.rotation.z = Math.PI / (180 / slot.rotation[2]) * (display_slot.includes('lefthand') ? -1 : 1);

	display_base.position.x = slot.translation[0] * (display_slot.includes('lefthand') ? -1 : 1);
	display_base.position.y = slot.translation[1];
	display_base.position.z = slot.translation[2];

	display_base.scale.x = (slot.scale[0]||0.001) * (slot.mirror[0] ? -1 : 1);
	display_base.scale.y = (slot.scale[1]||0.001) * (slot.mirror[1] ? -1 : 1);
	display_base.scale.z = (slot.scale[2]||0.001) * (slot.mirror[2] ? -1 : 1);

	Transformer.center()
}

DisplayMode.toggleGuiLight = function() {
	Project.front_gui_light = !Project.front_gui_light;
}


DisplayMode.applyPreset = function(preset, all) {
	if (preset == undefined) return;
	var slots = [display_slot]
	if (all) {
		slots = displayReferenceObjects.slots
	} else if (preset.areas[display_slot] == undefined) {
		Blockbench.showQuickMessage('message.preset_no_info')
		return;
	};
	Undo.initEdit({display_slots: slots})
	slots.forEach(function(sl) {
		if (!display[sl]) {
			display[sl] = new DisplaySlot()
		}
		display[sl].extend(preset.areas[sl])
	})
	DisplayMode.updateDisplayBase()
	Undo.finishEdit('apply display preset')
}
DisplayMode.createPreset = function() {
	var name = $('input#preset_name').val()
	if (name == '') {
		$('input#preset_name').val(tl('display.preset.blank_name'))
		return;
	} else {
		$('input#preset_name').val('new preset')
	}
	var preset = {name: name, areas: {}}
	display_presets.push(preset)

	displayReferenceObjects.slots.forEach(function(s) {
		if ($('#'+s+'_save').is(':checked') && display[s]) {
			preset.areas[s] = display[s].copy()
		}
	})
	hideDialog()
	localStorage.setItem('display_presets', JSON.stringify(display_presets))
}
DisplayMode.loadJSON = function(data) {
	for (var slot in data) {
		if (displayReferenceObjects.slots.includes(slot)) {
			display[slot] = new DisplaySlot().extend(data[slot])
		}
	}
}

var setDisplayArea = DisplayMode.setBase = function(x, y, z, rx, ry, rz, sx, sy, sz) {//Sets the Work Area to the given Space
	display_area.rotation['x'] = Math.PI / (180 / rx);
	display_area.rotation['y'] = Math.PI / (180 / ry);
	display_area.rotation['z'] = Math.PI / (180 / rz);

	display_area.position['x'] = x;
	display_area.position['y'] = y;
	display_area.position['z'] = z;

	display_area.scale['x'] = sx;
	display_area.scale['y'] = sy;
	display_area.scale['z'] = sz;

	display_area.updateMatrixWorld()

	Transformer.center()
}
DisplayMode.groundAnimation = function() {
	display_area.rotation.y += 0.015
	ground_timer += 1
	display_area.position.y = 13.5 + Math.sin(Math.PI * (ground_timer / 100)) * Math.PI/2
	Transformer.center()
	if (ground_timer === 200) ground_timer = 0;
}
DisplayMode.updateGUILight = function() {
	if (!display_mode) return;
	if (display_slot == 'gui' && Project.front_gui_light == true) {
		lights.rotation.set(-Math.PI, 0.6, 0);
	} else {
		lights.rotation.set(0, Math.PI * 0.75, 0);
	}
} 

function loadDisp(key) {	//Loads The Menu and slider values, common for all Radio Buttons
	display_slot = key

	if (key !== 'gui' && display_preview.isOrtho === true) {
		display_preview.setNormalCamera()
	}
	display_preview.controls.enabled = true;
	ground_animation = false;
	$('#display_crosshair').detach()
	display_preview.camPers.setFocalLength(45)

	if (display[key] == undefined) {
		display[key] = new DisplaySlot()
	}
	DisplayMode.vue._data.slot = display[key]
	DisplayMode.slot = display[key]
	DisplayMode.updateDisplayBase();
	Canvas.updateRenderSides();
	DisplayMode.updateGUILight();
	Toolbars.display.update();
}
DisplayMode.loadThirdRight = function() {	//Loader
	loadDisp('thirdperson_righthand')
	display_preview.camPers.position.set(-44, 40, -44)
	display_preview.controls.target.set(0, 14, 0)
	displayReferenceObjects.bar(['player', 'zombie', 'baby_zombie', 'armor_stand', 'armor_stand_small'])
}
DisplayMode.loadThirdLeft = function() {	//Loader
	loadDisp('thirdperson_lefthand')
	display_preview.camPers.position.set(-44, 40, -44)
	display_preview.controls.target.set(0, 14, 0)
	displayReferenceObjects.bar(['player', 'zombie', 'baby_zombie', 'armor_stand', 'armor_stand_small'])
}
DisplayMode.loadFirstRight = function() {	//Loader
	loadDisp('firstperson_righthand')
	display_preview.camPers.setFocalLength(12)
	display_preview.camPers.position.set(0, 0, 32.4)
	display_preview.controls.target.set(0,0,0)
	display_preview.controls.enabled = false
	displayReferenceObjects.bar(['monitor', 'bow', 'crossbow'])
	$('.single_canvas_wrapper').append('<div id="display_crosshair"></div>')
}
DisplayMode.loadFirstLeft = function() {	//Loader
	loadDisp('firstperson_lefthand')
	display_preview.camPers.setFocalLength(12)
	display_preview.camPers.position.set(0, 0, 32.4)
	display_preview.controls.target.set(0,0,0)
	display_preview.controls.enabled = false
	displayReferenceObjects.bar(['monitor', 'bow', 'crossbow'])
	$('.single_canvas_wrapper').append('<div id="display_crosshair"></div>')
}
DisplayMode.loadHead = function() {		//Loader
	loadDisp('head')
	display_preview.camPers.position.set(-30, 40, -30)
	display_preview.controls.target.set(0, 22, 0)
	displayReferenceObjects.bar(['player', 'zombie', 'baby_zombie', 'armor_stand', 'armor_stand_small'])
}
DisplayMode.loadGUI = function() {		//Loader
	loadDisp('gui')
	setDisplayArea(0, 0, 0, 0, 0, 0, 0.4, 0.4, 0.4)
	display_preview.camOrtho.zoom = 1
	display_preview.controls.target.set(0,0,0)
	display_preview.setOrthographicCamera(2)
	display_preview.camOrtho.position.set(0,0,32)
	displayReferenceObjects.bar(['inventory_nine', 'inventory_full', 'hud'])
	BarItems.gui_light.set(Project.front_gui_light ? 'front' : 'side');
}
DisplayMode.loadGround = function() {		//Loader
	loadDisp('ground')
	display_preview.camPers.position.set(-40, 37, -40)
	display_preview.controls.target.set(0, 11, 0)
	setDisplayArea(0, 12, 0, 0, 0, 0, 1, 1, 1)
	ground_animation = true;
	ground_timer = 0
	displayReferenceObjects.bar(['block'])
}
DisplayMode.loadFixed = function() {		//Loader
	loadDisp('fixed')
	display_preview.camPers.position.set(-24, 18, -50)
	display_preview.controls.target.set(0, 1, -5)
	setDisplayArea(0, 0, -8.5, 0, 0, 0, 0.5, 0.5, 0.5)
	displayReferenceObjects.bar(['frame'])
}
DisplayMode.load = function(slot) {
	switch (slot) {
		case 'thirdperson_righthand':
		DisplayMode.loadThirdRight()
		break;
		case 'thirdperson_lefthand':
		DisplayMode.loadThirdLeft()
		break;
		case 'firstperson_righthand':
		DisplayMode.loadFirstRight()
		break;
		case 'firstperson_lefthand':
		DisplayMode.loadFirstLeft()
		break;
		case 'head':
		DisplayMode.loadHead()
		break;
		case 'gui':
		DisplayMode.loadGUI()
		break;
		case 'ground':
		DisplayMode.loadGround()
		break;
		case 'fixed':
		DisplayMode.loadFixed()
		break;
	}
}

DisplayMode.copy = function() {
	Clipbench.display_slot = DisplayMode.slot.copy()
}
DisplayMode.paste = function() {
	Undo.initEdit({display_slots: [display_slot]})
	DisplayMode.slot.extend(Clipbench.display_slot)
	DisplayMode.updateDisplayBase()
	Undo.finishEdit('paste display slot')
}

DisplayMode.scrollSlider = function(type, value, el) {
	Undo.initEdit({display_slots: [display_slot]})

	var [channel, axis] = type.split('.')
	DisplayMode.slot[channel][parseInt(axis)] = value

	DisplayMode.slot.update()
	Undo.finishEdit('change display slot')
}

window.changeDisplaySkin = function() {
	var buttons = [
		tl('message.display_skin.upload'),
		tl('message.display_skin.reset')
	]
	if (isApp) {
		buttons.splice(1, 0, tl('message.display_skin.name'))
	}
	buttons.push('dialog.cancel');
	Blockbench.showMessageBox({
		translateKey: 'display_skin',
		icon: 'icon-player',
		buttons: buttons,
		confirm: 0,
		cancel: buttons.length-1,
	}, function(result) {
		if (result === 0) {
			Blockbench.import({
				extensions: ['png'],
				type: 'PNG Player Skin',
				readtype: 'image'
			}, function(files) {

				Blockbench.showMessageBox({
					translateKey: 'display_skin_model',
					icon: 'icon-player',
					buttons: [
						tl('message.display_skin_model.classic'),
						tl('message.display_skin_model.slim')
					]
				}, function(slim) {
					if (files.length) {
						settings.display_skin.value = (slim?'S':'C') +','+ (isApp ? files[0].path : files[0].content)
						updateDisplaySkin()
					}
				})
			})
		} else if (result === 1 && isApp) {
			if (typeof settings.display_skin.value === 'string' && settings.display_skin.value.substr(0, 9) === 'username:') {
				var before = settings.display_skin.value.replace('username:', '')
			} else {
				var before = ''
			}
			Blockbench.textPrompt(tl('message.display_skin.name'), before, function(text) {
				settings.display_skin.value = 'username:'+text
				updateDisplaySkin()
			})
		} else if (result < buttons.length-1) {
			settings.display_skin.value = false
			updateDisplaySkin()
		}
	})
}
function updateDisplaySkin() {
	var val = settings.display_skin.value
	var source;
	function setPSkin(skin, slim) {
		if (!displayReferenceObjects.refmodels.player.material) {
			return;
		}
		var mat = displayReferenceObjects.refmodels.player.material


		var img = new Image()
		try {
			img.src = skin
		} catch(err) {
		}
		img.onload = function() {
			mat.map.dispose()
			var tex = new THREE.Texture(img)
			img.tex = tex;
			img.tex.magFilter = THREE.NearestFilter
			img.tex.minFilter = THREE.NearestFilter
			this.tex.needsUpdate = true;
			mat.map = tex;

			displayReferenceObjects.refmodels.player.setModelVariant(slim ? 'alex' : 'steve')
		}
	}
	if (!val || typeof val !== 'string') {
		setPSkin('assets/player_skin.png')

	} else if (val.substr(0, 9) === 'username:') {
		var username = val.substr(9)
		$.getJSON('https://api.mojang.com/users/profiles/minecraft/'+username, function(uuid) {
			if (uuid && uuid.id) {

				$.getJSON('https://sessionserver.mojang.com/session/minecraft/profile/'+uuid.id, function(data) {
					if (data && data.properties) {
						var skin_path;
						var is_slim = false;
						try {
							var parsed = JSON.parse(atob(data.properties[0].value))
							skin_path = parsed.textures.SKIN.url
							if (parsed.textures.SKIN.metadata && parsed.textures.SKIN.metadata.model === 'slim') {
								is_slim = true
							}
						} catch (err) {}
						setPSkin(skin_path, is_slim)
					}
				})
			}
		})
	} else {
		if (val.substr(1,1) === ',') {
			var slim = val.substr(0,1) === 'S'
			val = val.substr(2)
		} else {
			var slim = false
		}
		setPSkin(val, slim)
	}
	//displayReferenceObjects.refmodels.player.material
}

onVueSetup(function() {
	DisplayMode.vue = new Vue({
		el: '#display_sliders',
		data: {
			axes: [0, 1, 2],
			slot: new DisplaySlot()
		},
		methods: {
			isMirrored: (axis) => {
				if (display[display_slot]) {
					return display[display_slot].scale[axis] < 0;
				}
			},
			change: (axis, channel) => {
				if (channel === 'scale') {
					var val = limitNumber(DisplayMode.slot.scale[axis], 0, 4)
					DisplayMode.slot.scale[axis] = val;
					if (Pressing.shift) {
						DisplayMode.slot.scale[0] = val;
						DisplayMode.slot.scale[1] = val;
						DisplayMode.slot.scale[2] = val;
					}
				} else if (channel === 'translation') {
					DisplayMode.slot.translation[axis] = limitNumber(DisplayMode.slot.translation[axis], -80, 80)||0;
				} else {
					DisplayMode.slot.rotation[axis] = Math.trimDeg(DisplayMode.slot.rotation[axis])||0;
				}
				DisplayMode.updateDisplayBase()
			},
			resetChannel: (channel) => {
				var v = channel === 'scale' ? 1 : 0;
				Undo.initEdit({display_slots: [display_slot]})
				DisplayMode.slot.extend({[channel]: [v, v, v]})
				if (channel === 'scale') {
				DisplayMode.slot.extend({mirror: [false, false, false]})
				}
				Undo.finishEdit('reset display')
			},
			invert: (axis) => {
				Undo.initEdit({display_slots: [display_slot]})
				DisplayMode.slot.mirror[axis] = !DisplayMode.slot.mirror[axis];
				DisplayMode.slot.update()
				Undo.finishEdit('mirror display')
			},
			start: () => {
				Undo.initEdit({display_slots: [display_slot]})
			},
			save: () => {
				Undo.finishEdit('change_display')
			}
		}
	})
})

BARS.defineActions(function() {
	new Action('add_display_preset', {
		icon: 'add',
		category: 'display',
		condition: () => display_mode,
		click: function () {showDialog('create_preset')}
	})
	new BarSelect('gui_light', {
		options: {
			side: true,
			front: true,
		},
		condition: () => display_mode && display_slot === 'gui',
		onChange: function(slider) {
			Project.front_gui_light = slider.get() == 'front';
			DisplayMode.updateGUILight();
		}
	})
})

})()