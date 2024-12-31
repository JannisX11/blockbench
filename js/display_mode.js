var ground_animation = false;
var ground_timer = 0
var display_slot = 'thirdperson_righthand';
var display_presets;
var display_preview;
var enterDisplaySettings, exitDisplaySettings;
const DisplayMode = {};


class DisplaySlot {
	constructor(id, data) {
		this.slot_id = id;
		this.default()
		if (data) this.extend(data)
	}
	default() {
		this.rotation = [0, 0, 0];
		this.translation = [0, 0, 0];
		this.scale = [1, 1, 1];
		this.rotation_pivot = [0, 0, 0];
		this.scale_pivot = [0, 0, 0];
		this.mirror = [false, false, false]
		this.fit_to_frame = false;
		return this;
	}
	copy() {
		return {
			rotation: this.rotation.slice(),
			translation: this.translation.slice(),
			scale: this.scale.slice(),
			rotation_pivot: this.rotation_pivot.slice(),
			scale_pivot: this.scale_pivot.slice(),
			mirror: this.mirror.slice()
		}
	}
	export() {
		let build = {};
		let export_all = Format.id == 'bedrock_block';
		if (export_all || !this.rotation.allEqual(0)) build.rotation = this.rotation
		if (export_all || !this.translation.allEqual(0)) build.translation = this.translation
		if (export_all || !this.scale.allEqual(1) || !this.mirror.allEqual(false)) {
			build.scale = this.scale.slice()
			if (!this.mirror.allEqual(false)) {

				for (let i = 0; i < 3; i++) {
					build.scale[i] *= this.mirror[i] ? -1 : 1;
				}
			}
		}
		if (export_all || !this.rotation_pivot.allEqual(0)) build.rotation_pivot = this.rotation_pivot
		if (export_all || !this.scale_pivot.allEqual(0)) build.scale_pivot = this.scale_pivot
		if (Object.keys(build).length) {
			return build;
		}
	}
	exportBedrock() {
		let has_data = !this.rotation.allEqual(0)
			|| !this.translation.allEqual(0)
			|| !this.scale.allEqual(1)
			|| !this.mirror.allEqual(false)
			|| !this.rotation_pivot.allEqual(0)
			|| !this.scale_pivot.allEqual(0);
		if (!has_data) return;

		let build = {
			rotation: this.rotation.slice(),
			translation: this.translation.slice(),
			scale: this.scale.slice(),
			rotation_pivot: this.rotation_pivot,
			scale_pivot: this.scale_pivot,
		}
		if (this.slot_id == 'gui') {
			build.fit_to_frame = this.fit_to_frame;
		}
		if (!this.mirror.allEqual(false)) {
			for (let i = 0; i < 3; i++) {
				build.scale[i] *= this.mirror[i] ? -1 : 1;
			}
		}
		return build;
	}
	extend(data) {
		if (!data) return this;
		for (var i = 0; i < 3; i++) {
			if (data.rotation) Merge.number(this.rotation, data.rotation, i)
			if (data.mirror) Merge.boolean(this.mirror, data.mirror, i)
			if (data.scale) Merge.number(this.scale, data.scale, i)
			if (data.translation) Merge.number(this.translation, data.translation, i)
			if (data.rotation_pivot) Merge.number(this.rotation_pivot, data.rotation_pivot, i)
			if (data.scale_pivot) Merge.number(this.scale_pivot, data.scale_pivot, i)
			this.scale[i] = Math.abs(this.scale[i])
			if (data.scale && data.scale[i] < 0) this.mirror[i] = true;
		}
		if (typeof data.fit_to_frame == 'boolean') this.fit_to_frame = data.fit_to_frame;
		this.update()
		return this;
	}
	update() {
		if (Modes.display && this === DisplayMode.slot) {
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
	},
	{id: 'armor_stand', fixed: true, areas: {
		thirdperson_righthand: {
			rotation: [ 90, 0, 0 ],
			translation: [ -6, -2, -4 ],
			scale: [ 1, 1, 1 ]
		},
		thirdperson_lefthand: {
			rotation: [ 90, 0, 0 ],
			translation: [ -6, -2, -4 ],
			scale: [ 1, 1, 1 ]
		},
		head: {
			rotation: [ 0, 0, 0 ],
			translation: [ 0, -30.4, 0 ],
			scale: [ 1.6, 1.6, 1.6 ]
		}
	}
	}
]
if (localStorage.getItem('display_presets') != null) {
	var stored_display_presets = JSON.parse(localStorage.getItem('display_presets'))
	$.extend(display_presets, stored_display_presets)
}



class refModel {
	constructor(id, options = 0) {
		var scope = this;
		this.model = new THREE.Object3D();
		this.name = tl('display.reference.'+id);
		this.id = id;
		this.icon = options.icon || id;
		this.condition = options.condition;
		this.initialized = false;
		this.pose_angles = {};

		switch (id) {
			case 'player':
				this.pose_angles.thirdperson_righthand = 22.5;
				this.pose_angles.thirdperson_lefthand = 22.5;
				this.pose_angles.head = 0;

				this.updateBasePosition = function() {
					let angle = Math.degToRad(scope.pose_angles[display_slot] || 0)
					let x = scope.variant === 'alex' ? 5.5 : 6
					let y = 22 - Math.cos(angle)*10 + Math.sin(angle)*2
					let z = 	 Math.sin(angle)*10 + Math.cos(angle)*2

					if (display_slot === 'thirdperson_righthand') {
						setDisplayArea(x, y, -z, -90 + scope.pose_angles[display_slot], 0, 0, 1, 1, 1)
					} else if (display_slot === 'thirdperson_lefthand') {
						setDisplayArea(-x, y, -z, -90 + scope.pose_angles[display_slot], 0, 0, 1, 1, 1)
					} else if (display_slot === 'head') {
						setDisplayArea(0, 24 + Math.cos(angle)*4, Math.sin(angle)*4, scope.pose_angles[display_slot], 0, 0, 0.625, 0.625, 0.625)
					}

					this.model.children.forEach(mesh => {
						if (display_slot === 'thirdperson_righthand' && mesh.name.match(/^right_arm/)) {
							mesh.rotation.x = angle;
						}
						if (display_slot === 'thirdperson_lefthand' && mesh.name.match(/^left_arm/)) {
							mesh.rotation.x = angle;
						}
						if (display_slot === 'head' && mesh.name.match(/^head/)) {
							mesh.rotation.x = angle;
						}
					})
				}
				break;
			case 'armor_stand':
				this.updateBasePosition = function() {
					if (display_slot === 'thirdperson_righthand') {
						setDisplayArea(6, 12, -2, -90, 0, 0, 1, 1, 1)
					} else if (display_slot === 'thirdperson_lefthand') {
						setDisplayArea(-6, 12, -2, -90, 0, 0, 1, 1, 1)
					} else if (display_slot === 'head') {
						setDisplayArea(0, 27, 0, 0, 0, 0, 0.625, 0.625, 0.625)
					}
				}
				break;
			case 'armor_stand_small':
				this.updateBasePosition = function() {
					if (display_slot === 'thirdperson_righthand') {
						setDisplayArea(3, 6, -1, -90, 0, 0, 0.5, 0.5, 0.5)
					} else if (display_slot === 'thirdperson_lefthand') {
						setDisplayArea(-3, 6, -1, -90, 0, 0, 0.5, 0.5, 0.5)
					} else if (display_slot === 'head') {
						setDisplayArea(0, 14.5, 0, 0, 0, 0, 0.4635, 0.4635, 0.4635)
					}
				}
				break;
			case 'fox':
				this.updateBasePosition = function() {
					setDisplayArea(0, 0, -6, 90, 180, 0, 1, 1, 1);
				}
				break;
			case 'block':
				this.updateBasePosition = function() {
					setDisplayArea(8, 4, 8, 0, 0, 0, 1, 1, 1)
				}
				break;
			case 'zombie':
				this.updateBasePosition = function() {
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
				this.updateBasePosition = function() {
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
				this.updateBasePosition = function() {
					var side = display_slot.includes('left') ? -1 : 1;
					setDisplayArea(side*9.039, -8.318+24, 20.8, 0, 0, 0, 1,1,1)
				}
				break;
			case 'frame':
				this.updateBasePosition = function() {
					setDisplayArea(8, 8, -1, 0, 0, 0, 0.5, 0.5, 0.5)
				}
				break;
			case 'frame_invisible':
				this.updateBasePosition = function() {
					setDisplayArea(8, 8, 0.0, 0, 0, 0, 0.5, 0.5, 0.5)
				}
				break;
			case 'frame_top':
				this.updateBasePosition = function() {
					setDisplayArea(8, 1, 8, 90, 0, 0, 0.5, 0.5, 0.5)
				}
				break;
			case 'frame_top_invisible':
				this.updateBasePosition = function() {
					setDisplayArea(8, 0, 8, 90, 0, 0, 0.5, 0.5, 0.5)
				}
				break;
			case 'bow':
				this.updateBasePosition = function() {
					var side = display_slot.includes('left') ? -1 : 1;
					setDisplayArea(side*4.2, -4.9+24, 25, -20, -19, -8, 1,1,1)
				}
				break;
			case 'crossbow':
				this.updateBasePosition = function() {
					var side = display_slot.includes('left') ? -1 : 1;
					setDisplayArea(side*-1.2, -6.75+24, 23, 0, side*10, 0, 1, 1, 1)
				}
				break;
				
			case 'eating':
				this.updateBasePosition = function() {
					var side = display_slot.includes('left') ? -1 : 1;
					DisplayMode.setBase(
						side*-1.7, -6.1+24, 23.4,
						-92, side*100, side*119,
						0.8, 0.8, 0.8)
				}
				break;
			case 'tooting':
				this.updateBasePosition = function() {
					var side = display_slot.includes('left') ? -1 : 1;
					//setDisplayArea(side*-0.6, 19.8, 23.8, 31.5, side*22, -11, 1, 1, 1)
					setDisplayArea(side == 1 ? -2.7 : 2.1, 20.1, Format.id.includes('bedrock') ? 24.5 : 25.6, 36, side*21.5, side*-12, 1, 1, 1)
				}
				break;
		}
	}
	buildModel(things, texture, texture_res = [16, 16]) {
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
					[face.uv[0]/texture_res[0], 1-(face.uv[1]/texture_res[1])],
					[face.uv[2]/texture_res[0], 1-(face.uv[1]/texture_res[1])],
					[face.uv[0]/texture_res[0], 1-(face.uv[3]/texture_res[1])],
					[face.uv[2]/texture_res[0], 1-(face.uv[3]/texture_res[1])]
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
	setModelVariant(variant) {
		this.variant = variant;
		this.model.children.forEach((m) => {
			if (m.r_model) {
				m.visible = m.r_model === variant;
			}
		})
		if (Modes.display && displayReferenceObjects.active === this) {
			this.updateBasePosition()
		}
	}
	load(index) {
		displayReferenceObjects.ref_indexes[display_slot] = index || 0;
		displayReferenceObjects.clear()
		if (typeof this.updateBasePosition === 'function') {
			this.updateBasePosition()
		}
		//3D
		if (!this.initialized) {
			switch (this.id) {
				case 'player': this.buildPlayer(); break;
				case 'zombie': this.buildZombie(); break;
				case 'armor_stand': this.buildArmorStand(); break;
				case 'baby_zombie': this.buildBabyZombie(); break;
				case 'armor_stand_small': this.buildArmorStandSmall(); break;
				case 'fox': this.buildFox(); break;
				case 'crossbow':
				case 'bow':
				case 'eating':
				case 'tooting':
				case 'monitor': this.buildMonitor(); break;
				case 'block': this.buildBlock(); break;
				case 'frame': this.buildFrame(); break;
				case 'frame_invisible': this.buildFrameInvisible(); break;
				case 'frame_top': this.buildFrameTop(); break;
				case 'frame_top_invisible': this.buildFrameTopInvisible(); break;
			}
			this.initialized = true;
		}
		scene.add(this.model)
		displayReferenceObjects.active = this;

		DisplayMode.vue.pose_angle = this.pose_angles[display_slot] || 0;
		DisplayMode.vue.reference_model = this.id;

		if (display_slot == 'ground') {
			ground_animation = this.id != 'fox';
		}
		
		ReferenceImage.updateAll()
	}
	buildPlayer(slim) {
		var scope = this;
		var cubes = [
			{
				//Head
				"name": "head",
				"size": [8, 8, 8],
				"pos": [0, 28, 0],
				"origin": [0, 24, 0],
				"north": {"uv": [2.032, 2.032, 3.968, 3.968]},
				"east": {"uv": [0.032, 2.032, 1.968, 3.968]},
				"south": {"uv": [6.032, 2.032, 7.968, 3.968]},
				"west": {"uv": [4.032, 2.032, 5.968, 3.968]},
				"up": {"uv": [3.968, 1.968, 2.032, 0.032]},
				"down": {"uv": [5.968, 0.032, 4.032, 1.968]}
			},
			{
				//Head Layer
				"name": "head_layer",
				"size": [9, 9, 9],
				"pos": [0, 28, 0],
				"origin": [0, 24, 0],
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
				"name": "right_arm",
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
				"name": "right_arm_layer",
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
				"name": "left_arm",
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
				"name": "left_arm_layer",
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
				"name": "right_arm",
				"size": [3, 12, 4],
				"pos": [5.5, 17.5, 0],
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
				"name": "right_arm_layer",
				"size": [3.5, 12.5, 4.5],
				"pos": [5.5, 17.5, 0],
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
				"name": "left_arm",
				"size": [3, 12, 4],
				"pos": [-5.5, 17.5, 0],
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
				"name": "left_arm_layer",
				"size": [3.5, 12.5, 4.5],
				"pos": [-5.5, 17.5, 0],
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
				"pos": [0, 0.5, 0],
				"origin": [0, 0, 0],
				"north": {"uv": [12, 44, 24, 45]},
				"east": {"uv": [0, 44, 12, 45]},
				"south": {"uv": [36, 44, 48, 45]},
				"west": {"uv": [24, 44, 36, 45]},
				"up": {"uv": [24, 44, 12, 32]},
				"down": {"uv": [36, 32, 24, 44]}
			},
			{
				"size": [12, 3, 3],
				"pos": [0, 22.5, 0],
				"origin": [0, 0, 0],
				"north": {"uv": [3, 29, 15, 32]},
				"east": {"uv": [0, 29, 3, 32]},
				"south": {"uv": [18, 29, 30, 32]},
				"west": {"uv": [15, 29, 18, 32]},
				"up": {"uv": [15, 29, 3, 26]},
				"down": {"uv": [27, 26, 15, 29]}
			},
			{
				"size": [2, 7, 2],
				"pos": [2, 17.5, 0],
				"origin": [0, 0, 0],
				"north": {"uv": [18, 2, 20, 9]},
				"east": {"uv": [16, 2, 18, 9]},
				"south": {"uv": [22, 2, 24, 9]},
				"west": {"uv": [20, 2, 22, 9]},
				"up": {"uv": [20, 2, 18, 0]},
				"down": {"uv": [22, 0, 20, 2]}
			},
			{
				"size": [2, 7, 2],
				"pos": [-2, 17.5, 0],
				"origin": [0, 0, 0],
				"north": {"uv": [50, 18, 52, 25]},
				"east": {"uv": [48, 18, 50, 25]},
				"south": {"uv": [54, 18, 56, 25]},
				"west": {"uv": [52, 18, 54, 25]},
				"up": {"uv": [52, 18, 50, 16]},
				"down": {"uv": [54, 16, 52, 18]}
			},
			{
				"size": [8, 2, 2],
				"pos": [0, 13, 0],
				"origin": [0, 0, 0],
				"north": {"uv": [2, 50, 10, 52]},
				"east": {"uv": [0, 50, 2, 52]},
				"south": {"uv": [12, 50, 20, 52]},
				"west": {"uv": [10, 50, 12, 52]},
				"up": {"uv": [10, 50, 2, 48]},
				"down": {"uv": [18, 48, 10, 50]}
			},
			{
				"size": [2, 7, 2],
				"pos": [0, 26.5, 0],
				"origin": [0, 0, 0],
				"north": {"uv": [2, 2, 4, 9]},
				"east": {"uv": [0, 2, 2, 9]},
				"south": {"uv": [6, 2, 8, 9]},
				"west": {"uv": [4, 2, 6, 9]},
				"up": {"uv": [4, 2, 2, 0]},
				"down": {"uv": [6, 0, 4, 2]}
			},
			{
				"size": [2, 12, 2],
				"pos": [-6, 18, 0],
				"origin": [0, 0, 0],
				"north": {"uv": [36, 18, 34, 30]},
				"east": {"uv": [38, 18, 36, 30]},
				"south": {"uv": [40, 18, 38, 30]},
				"west": {"uv": [34, 18, 32, 30]},
				"up": {"uv": [34, 18, 36, 16]},
				"down": {"uv": [36, 16, 38, 18]}
			},
			{
				"size": [2, 11, 2],
				"pos": [-1.9, 6.5, 0],
				"origin": [0, 0, 0],
				"north": {"uv": [44, 18, 42, 29]},
				"east": {"uv": [46, 18, 44, 29]},
				"south": {"uv": [48, 18, 46, 29]},
				"west": {"uv": [42, 18, 40, 29]},
				"up": {"uv": [42, 18, 44, 16]},
				"down": {"uv": [44, 16, 46, 18]}
			},
			{
				"size": [2, 12, 2],
				"pos": [6, 18, 0],
				"origin": [0, 0, 0],
				"north": {"uv": [26, 2, 28, 14]},
				"east": {"uv": [24, 2, 26, 14]},
				"south": {"uv": [30, 2, 32, 14]},
				"west": {"uv": [28, 2, 30, 14]},
				"up": {"uv": [28, 2, 26, 0]},
				"down": {"uv": [30, 0, 28, 2]}
			},
			{
				"size": [2, 11, 2],
				"pos": [1.9, 6.5, 0],
				"origin": [0, 0, 0],
				"north": {"uv": [10, 2, 12, 13]},
				"east": {"uv": [8, 2, 10, 13]},
				"south": {"uv": [14, 2, 16, 13]},
				"west": {"uv": [12, 2, 14, 13]},
				"up": {"uv": [12, 2, 10, 0]},
				"down": {"uv": [14, 0, 12, 2]}
			}
		]`), 'assets/armor_stand.png', [64, 64])
	}
	buildArmorStandSmall() {
		this.buildModel(JSON.parse(`[
			{
				"size": [6, 0.5, 6],
				"pos": [0, 0.25, 0],
				"origin": [0, 0, 0],
				"north": {"uv": [12, 44, 24, 45]},
				"east": {"uv": [0, 44, 12, 45]},
				"south": {"uv": [36, 44, 48, 45]},
				"west": {"uv": [24, 44, 36, 45]},
				"up": {"uv": [24, 44, 12, 32]},
				"down": {"uv": [36, 32, 24, 44]}
			},
			{
				"size": [6, 1.5, 1.5],
				"pos": [0, 11.25, 0],
				"origin": [0, 0, 0],
				"north": {"uv": [3, 29, 15, 32]},
				"east": {"uv": [0, 29, 3, 32]},
				"south": {"uv": [18, 29, 30, 32]},
				"west": {"uv": [15, 29, 18, 32]},
				"up": {"uv": [15, 29, 3, 26]},
				"down": {"uv": [27, 26, 15, 29]}
			},
			{
				"size": [1, 3.5, 1],
				"pos": [1, 8.75, 0],
				"origin": [0, 0, 0],
				"north": {"uv": [18, 2, 20, 9]},
				"east": {"uv": [16, 2, 18, 9]},
				"south": {"uv": [22, 2, 24, 9]},
				"west": {"uv": [20, 2, 22, 9]},
				"up": {"uv": [20, 2, 18, 0]},
				"down": {"uv": [22, 0, 20, 2]}
			},
			{
				"size": [1, 3.5, 1],
				"pos": [-1, 8.75, 0],
				"origin": [0, 0, 0],
				"north": {"uv": [50, 18, 52, 25]},
				"east": {"uv": [48, 18, 50, 25]},
				"south": {"uv": [54, 18, 56, 25]},
				"west": {"uv": [52, 18, 54, 25]},
				"up": {"uv": [52, 18, 50, 16]},
				"down": {"uv": [54, 16, 52, 18]}
			},
			{
				"size": [4, 1, 1],
				"pos": [0, 6.5, 0],
				"origin": [0, 0, 0],
				"north": {"uv": [2, 50, 10, 52]},
				"east": {"uv": [0, 50, 2, 52]},
				"south": {"uv": [12, 50, 20, 52]},
				"west": {"uv": [10, 50, 12, 52]},
				"up": {"uv": [10, 50, 2, 48]},
				"down": {"uv": [18, 48, 10, 50]}
			},
			{
				"size": [1.5, 5.25, 1.48],
				"pos": [0, 13.875, 0],
				"origin": [0, 12, 0],
				"north": {"uv": [2, 2, 4, 9]},
				"east": {"uv": [0, 2, 2, 9]},
				"south": {"uv": [6, 2, 8, 9]},
				"west": {"uv": [4, 2, 6, 9]},
				"up": {"uv": [4, 2, 2, 0]},
				"down": {"uv": [6, 0, 4, 2]}
			},
			{
				"size": [1, 6, 1],
				"pos": [-3, 9, 0],
				"origin": [0, 0, 0],
				"north": {"uv": [36, 18, 34, 30]},
				"east": {"uv": [38, 18, 36, 30]},
				"south": {"uv": [40, 18, 38, 30]},
				"west": {"uv": [34, 18, 32, 30]},
				"up": {"uv": [34, 18, 36, 16]},
				"down": {"uv": [36, 16, 38, 18]}
			},
			{
				"size": [1, 5.5, 1],
				"pos": [-0.95, 3.25, 0],
				"origin": [0, 0, 0],
				"north": {"uv": [44, 18, 42, 29]},
				"east": {"uv": [46, 18, 44, 29]},
				"south": {"uv": [48, 18, 46, 29]},
				"west": {"uv": [42, 18, 40, 29]},
				"up": {"uv": [42, 18, 44, 16]},
				"down": {"uv": [44, 16, 46, 18]}
			},
			{
				"size": [1, 6, 1],
				"pos": [3, 9, 0],
				"origin": [0, 0, 0],
				"north": {"uv": [26, 2, 28, 14]},
				"east": {"uv": [24, 2, 26, 14]},
				"south": {"uv": [30, 2, 32, 14]},
				"west": {"uv": [28, 2, 30, 14]},
				"up": {"uv": [28, 2, 26, 0]},
				"down": {"uv": [30, 0, 28, 2]}
			},
			{
				"size": [1, 5.5, 1],
				"pos": [0.95, 3.25, 0],
				"origin": [0, 0, 0],
				"north": {"uv": [10, 2, 12, 13]},
				"east": {"uv": [8, 2, 10, 13]},
				"south": {"uv": [14, 2, 16, 13]},
				"west": {"uv": [12, 2, 14, 13]},
				"up": {"uv": [12, 2, 10, 0]},
				"down": {"uv": [14, 0, 12, 2]}
			}
		]`), 'assets/armor_stand.png', [64, 64])
	}
	buildFox() {
		this.buildModel(JSON.parse(`[
			{
				"size": [8, 6, 6],
				"pos": [0, 4, 0],
				"origin": [0, 0, 0],
				"north": {"uv": [7, 11, 15, 17]},
				"east": {"uv": [1, 11, 7, 17]},
				"south": {"uv": [21, 11, 29, 17]},
				"west": {"uv": [15, 11, 21, 17]},
				"up": {"uv": [15, 11, 7, 5]},
				"down": {"uv": [23, 5, 15, 11]}
			},
			{
				"size": [4, 2, 3],
				"pos": [0, 2, -4.5],
				"origin": [0, 0, 0],
				"north": {"uv": [9, 21, 13, 23]},
				"east": {"uv": [6, 21, 9, 23]},
				"south": {"uv": [16, 21, 20, 23]},
				"west": {"uv": [13, 21, 16, 23]},
				"up": {"uv": [13, 21, 9, 18]},
				"down": {"uv": [17, 18, 13, 21]}
			},
			{
				"size": [2, 2, 1],
				"pos": [3, 8, -1.5],
				"origin": [0, 0, 0],
				"north": {"uv": [9, 2, 11, 4]},
				"east": {"uv": [8, 2, 9, 4]},
				"south": {"uv": [12, 2, 14, 4]},
				"west": {"uv": [11, 2, 12, 4]},
				"up": {"uv": [11, 2, 9, 1]},
				"down": {"uv": [13, 1, 11, 2]}
			},
			{
				"size": [2, 2, 1],
				"pos": [-3, 8, -1.5],
				"origin": [0, 0, 0],
				"north": {"uv": [16, 2, 18, 4]},
				"east": {"uv": [15, 2, 16, 4]},
				"south": {"uv": [19, 2, 21, 4]},
				"west": {"uv": [18, 2, 19, 4]},
				"up": {"uv": [18, 2, 16, 1]},
				"down": {"uv": [20, 1, 18, 2]}
			}

		]`), 'assets/fox.png', [32, 32])
	}
	buildZombie() {
		this.buildModel(JSON.parse(`[
			{
				"size": [4, 12, 4],
				"pos": [0, 0, -2],
				"origin": [0, 0, 0],
				"north": {"uv": [0.01, 5.01, 0.99, 7.99], "texture": "#1"},
				"east": {"uv": [3.01, 5.01, 3.99, 7.99], "texture": "#1"},
				"south": {"uv": [2.01, 5.01, 2.99, 7.99], "texture": "#1"},
				"west": {"uv": [1.01, 5.01, 1.99, 7.99], "texture": "#1"},
				"up": {"uv": [1.01, 4.01, 1.99, 4.99], "texture": "#1", "rotation": 90},
				"down": {"uv": [2.01, 4.01, 2.99, 4.99], "texture": "#1", "rotation": 90}
			},
			{
				"size": [4, 12, 4],
				"pos": [0, 0, 2],
				"origin": [0, 0, 0],
				"north": {"uv": [4.01, 13.01, 4.99, 15.99], "texture": "#1"},
				"east": {"uv": [8.01, 13.01, 6.99, 15.99], "texture": "#1"},
				"south": {"uv": [6.01, 13.01, 6.99, 15.99], "texture": "#1"},
				"west": {"uv": [5.01, 13.01, 5.99, 15.99], "texture": "#1"},
				"up": {"uv": [5.01, 12.01, 5.99, 12.99], "texture": "#1", "rotation": 90},
				"down": {"uv": [6.01, 12.01, 6.99, 12.99], "texture": "#1", "rotation": 90}
			},
			{
				"size": [4, 12, 8],
				"pos": [0, 12, 0],
				"origin": [0, 0, 0],
				"north": {"uv": [4.01, 5.01, 4.99, 7.99], "texture": "#1"},
				"east": {"uv": [8.01, 5.01, 9.99, 7.99], "texture": "#1"},
				"south": {"uv": [7.01, 5.01, 7.99, 7.99], "texture": "#1"},
				"west": {"uv": [5.01, 5.01, 6.99, 7.99], "texture": "#1"},
				"up": {"uv": [5.01, 4.01, 6.99, 4.99], "texture": "#1", "rotation": 90},
				"down": {"uv": [7.01, 4.01, 8.99, 4.99], "texture": "#1", "rotation": 270}
			},
			{
				"size": [8, 8, 8],
				"pos": [0, 22, 0],
				"origin": [0, 0, 0],
				"north": {"uv": [0.01, 2.01, 1.99, 3.99], "texture": "#1"},
				"east": {"uv": [6.01, 2.01, 7.99, 3.99], "texture": "#1"},
				"south": {"uv": [4.01, 2.01, 5.99, 3.99], "texture": "#1"},
				"west": {"uv": [2.01, 2.01, 3.99, 3.99], "texture": "#1"},
				"up": {"uv": [2.01, 0.01, 3.99, 1.99], "texture": "#1", "rotation": 90},
				"down": {"uv": [4.01, 0.01, 5.99, 1.99], "texture": "#1", "rotation": 90}
			},
			{
				"size": [12, 4, 4],
				"pos": [-4, 16, -6],
				"origin": [0, 0, 0],
				"north": {"uv": [12.01, 5.01, 12.99, 7.99], "texture": "#1", "rotation": 270},
				"east": {"uv": [11.01, 4.01, 11.99, 4.99], "texture": "#1", "rotation": 180},
				"south": {"uv": [10.01, 5.01, 10.99, 7.99], "texture": "#1", "rotation": 90},
				"west": {"uv": [12.01, 4.01, 12.99, 4.99], "texture": "#1", "rotation": 180},
				"up": {"uv": [11.01, 5.01, 11.99, 7.99], "texture": "#1", "rotation": 90},
				"down": {"uv": [13.01, 5.01, 13.99, 7.99], "texture": "#1", "rotation": 90}
			},
			{
				"size": [12, 4, 4],
				"pos": [-4, 16, 6],
				"origin": [0, 0, 0],
				"north": {"uv": [10.01, 13.01, 10.99, 15.99], "texture": "#1", "rotation": 270},
				"east": {"uv": [9.01, 12.01, 9.99, 12.99], "texture": "#1", "rotation": 180},
				"south": {"uv": [8.01, 13.01, 8.99, 15.99], "texture": "#1", "rotation": 90},
				"west": {"uv": [10.01, 12.01, 10.99, 12.99], "texture": "#1", "rotation": 180},
				"up": {"uv": [9.01, 13.01, 9.99, 15.99], "texture": "#1", "rotation": 90},
				"down": {"uv": [11.01, 13.01, 11.99, 15.99], "texture": "#1", "rotation": 90}
			}
		]`), 'assets/zombie.png')
	}
	buildBabyZombie() {
		this.buildModel(JSON.parse(`[
			{
				"size": [2, 6, 2],
				"pos": [-2.220446049250313e-16, -3, -1],
				"origin": [0, 0, 0],
				"north": {"uv": [0.01, 5.01, 0.99, 7.99], "texture": "#1"},
				"east": {"uv": [3.01, 5.01, 3.99, 7.99], "texture": "#1"},
				"south": {"uv": [2.01, 5.01, 2.99, 7.99], "texture": "#1"},
				"west": {"uv": [1.01, 5.01, 1.99, 7.99], "texture": "#1"},
				"up": {"uv": [1.01, 4.01, 1.99, 4.99], "texture": "#1", "rotation": 90},
				"down": {"uv": [2.01, 4.01, 2.99, 4.99], "texture": "#1", "rotation": 90}
			},
			{
				"size": [2, 6, 2],
				"pos": [-2.220446049250313e-16, -3, 1],
				"origin": [0, 0, 0],
				"north": {"uv": [4.01, 13.01, 4.99, 15.99], "texture": "#1"},
				"east": {"uv": [8.01, 13.01, 6.99, 15.99], "texture": "#1"},
				"south": {"uv": [6.01, 13.01, 6.99, 15.99], "texture": "#1"},
				"west": {"uv": [5.01, 13.01, 5.99, 15.99], "texture": "#1"},
				"up": {"uv": [5.01, 12.01, 5.99, 12.99], "texture": "#1", "rotation": 90},
				"down": {"uv": [6.01, 12.01, 6.99, 12.99], "texture": "#1", "rotation": 90}
			},
			{
				"size": [2, 6, 4],
				"pos": [-2.220446049250313e-16, 3, 0],
				"origin": [0, 0, 0],
				"north": {"uv": [4.01, 5.01, 4.99, 7.99], "texture": "#1"},
				"east": {"uv": [8.01, 5.01, 9.99, 7.99], "texture": "#1"},
				"south": {"uv": [7.01, 5.01, 7.99, 7.99], "texture": "#1"},
				"west": {"uv": [5.01, 5.01, 6.99, 7.99], "texture": "#1"},
				"up": {"uv": [5.01, 4.01, 6.99, 4.99], "texture": "#1", "rotation": 90},
				"down": {"uv": [7.01, 4.01, 8.99, 4.99], "texture": "#1", "rotation": 270}
			},
			{
				"size": [6.0, 6.0, 6.0],
				"pos": [0, 9, 0],
				"origin": [0, 9, 0],
				"north": {"uv": [0.01, 2.01, 1.99, 3.99], "texture": "#1"},
				"east": {"uv": [6.01, 2.01, 7.99, 3.99], "texture": "#1"},
				"south": {"uv": [4.01, 2.01, 5.99, 3.99], "texture": "#1"},
				"west": {"uv": [2.01, 2.01, 3.99, 3.99], "texture": "#1"},
				"up": {"uv": [2.01, 0.01, 3.99, 1.99], "texture": "#1", "rotation": 90},
				"down": {"uv": [4.01, 0.01, 5.99, 1.99], "texture": "#1", "rotation": 90}
			},
			{
				"size": [6, 2, 2],
				"pos": [-2.000000000000001, 5, -3],
				"origin": [0, 0, 0],
				"north": {"uv": [12.01, 5.01, 12.99, 7.99], "texture": "#1", "rotation": 270},
				"east": {"uv": [11.01, 4.01, 11.99, 4.99], "texture": "#1", "rotation": 180},
				"south": {"uv": [10.01, 5.01, 10.99, 7.99], "texture": "#1", "rotation": 90},
				"west": {"uv": [12.01, 4.01, 12.99, 4.99], "texture": "#1", "rotation": 180},
				"up": {"uv": [11.01, 5.01, 11.99, 7.99], "texture": "#1", "rotation": 90},
				"down": {"uv": [13.01, 5.01, 13.99, 7.99], "texture": "#1", "rotation": 90}
			},
			{
				"size": [6, 2, 2],
				"pos": [-2.000000000000001, 5, 3],
				"origin": [0, 0, 0],
				"north": {"uv": [10.01, 13.01, 10.99, 15.99], "texture": "#1", "rotation": 270},
				"east": {"uv": [9.01, 12.01, 9.99, 12.99], "texture": "#1", "rotation": 180},
				"south": {"uv": [8.01, 13.01, 8.99, 15.99], "texture": "#1", "rotation": 90},
				"west": {"uv": [10.01, 12.01, 10.99, 12.99], "texture": "#1", "rotation": 180},
				"up": {"uv": [9.01, 13.01, 9.99, 15.99], "texture": "#1", "rotation": 90},
				"down": {"uv": [11.01, 13.01, 11.99, 15.99], "texture": "#1", "rotation": 90}
			}
		]`), 'assets/zombie.png')
	}
	buildMonitor() {
		this.buildModel(JSON.parse(`[
			{"size": [8, 8, 0.1], "pos": [0, 28.93, 31.20], "origin": [0, 0, 0], "north":{"uv":[0,0,0,0]},"east":{"uv":[0,0,0,0]},"south":{"uv":[0,0,0,0]},"west":{"uv":[0,0,16,16]},"up":{"uv":[0,0,0,0]},"down":{"uv":[0,0,0,0]}},
			{"size": [8, 8, 0.1], "pos": [0, 19.07, 31.20], "origin": [0, 0, 0], "north":{"uv":[0,0,0,0]},"east":{"uv":[0,0,0,0]},"south":{"uv":[0,0,0,0]},"west":{"uv":[0,0,16,16]},"up":{"uv":[0,0,0,0]},"down":{"uv":[0,0,0,0]}},
			{"size": [8, 8, 0.1], "pos": [5.65, 24, 31.2], "origin": [0, 0, 0], "north":{"uv":[0,0,0,0]},"east":{"uv":[0,0,0,0]},"south":{"uv":[0,0,0,0]},"west":{"uv":[0,0,16,16]},"up":{"uv":[0,0,0,0]},"down":{"uv":[0,0,0,0]}},
			{"size": [8, 8, 0.1], "pos": [-5.65, 24, 31.2], "origin": [0, 0, 0], "north":{"uv":[0,0,0,0]},"east":{"uv":[0,0,0,0]},"south":{"uv":[0,0,0,0]},"west":{"uv":[0,0,16,16]},"up":{"uv":[0,0,0,0]},"down":{"uv":[0,0,0,0]}}
		]`), 'black')
	}
	buildBlock() {
		this.buildModel(JSON.parse(`[
			{"size": [16,16,16], "pos": [8, -7.98, 8], "origin": [0, 0, 0], "north":{"uv":[0,0,16,16]},"east":{"uv":[0,0,16,16]},"south":{"uv":[0,0,16,16]},"west":{"uv":[0,0,16,16]},"up":{"uv":[0,0,16,16]},"down":{"uv":[0,0,16,16]}}
		]`), 'assets/missing.png')
	}
	buildFrame() {
		this.buildModel(JSON.parse(`[
			{"size": [16,16,16], "pos": [8, 8, 8], "origin": [0, 0, 0], "north":{"uv":[0,0,16,16]},"east":{"uv":[0,0,16,16]},"south":{"uv":[0,0,16,16]},"west":{"uv":[0,0,16,16]},"up":{"uv":[0,0,16,16]},"down":{"uv":[0,0,16,16]}}
		]`), 'assets/missing.png')
		this.buildModel(JSON.parse(`[
			{"size": [10,10,0.5], "pos": [8, 8, -0.25], "origin": [0, 0, 0], "north":{"uv":[3,3,13,13]},"east":{"uv":[0,0,0,0]},"south":{"uv":[0,0,0,0]},"west":{"uv":[0,0,0,0]},"up":{"uv":[0,0,0,0]},"down":{"uv":[0,0,0,0]}},

			{"size": [1,12,1], "pos": [13.5, 8, -0.5], "origin": [0, 0, 0], "north":{"uv":[2,2,3,14]},"east":{"uv":[2,2,3,14]},"south":{"uv":[2,2,3,14]},"west":{"uv":[2,2,3,14]},"up":{"uv":[2,2,3,3]},"down":{"uv":[2,2,3,3]}},
			{"size": [1,12,1], "pos": [2.5,  8, -0.5], "origin": [0, 0, 0], "north":{"uv":[2,2,3,14]},"east":{"uv":[2,2,3,14]},"south":{"uv":[2,2,3,14]},"west":{"uv":[2,2,3,14]},"up":{"uv":[2,2,3,3]},"down":{"uv":[2,2,3,3]}},

			{"size": [10,1,1], "pos": [8, 13.5, -0.5], "origin": [0, 0, 0], "north":{"uv":[3,2,13,3]},"east":{"uv":[3,2,13,3]},"south":{"uv":[3,2,13,3]},"west":{"uv":[3,2,13,3]},"up":{"uv":[3,2,13,3]},"down":{"uv":[3,2,13,3]}},
			{"size": [10,1,1], "pos": [8, 2.5, -0.5], "origin": [0, 0, 0], "north":{"uv":[3,13,13,14]},"east":{"uv":[3,13,13,14]},"south":{"uv":[3,13,13,14]},"west":{"uv":[3,13,13,14]},"up":{"uv":[3,13,13,14]},"down":{"uv":[3,13,13,14]}}
		]`), 'assets/item_frame.png')
	}
	buildFrameInvisible() {
		this.buildModel(JSON.parse(`[
			{"size": [16,16,16], "pos": [8, 8, 8], "origin": [0, 0, 0], "north":{"uv":[0,0,16,16]},"east":{"uv":[0,0,16,16]},"south":{"uv":[0,0,16,16]},"west":{"uv":[0,0,16,16]},"up":{"uv":[0,0,16,16]},"down":{"uv":[0,0,16,16]}}
		]`), 'assets/missing.png')
	}
	buildFrameTop() {
		this.buildModel(JSON.parse(`[
			{"size": [16,16,16], "pos": [8, -8.01, 8], "origin": [0, 0, 0], "north":{"uv":[0,0,16,16]},"east":{"uv":[0,0,16,16]},"south":{"uv":[0,0,16,16]},"west":{"uv":[0,0,16,16]},"up":{"uv":[0,0,16,16]},"down":{"uv":[0,0,16,16]}}
		]`), 'assets/missing.png')
		this.buildModel(JSON.parse(`[
			{"rotation": [90, 0, 0], "size": [10,10,0.5], "pos": [8, -8, -0.25], "origin": [8, -8, 8], "north":{"uv":[3,3,13,13]},"east":{"uv":[0,0,0,0]},"south":{"uv":[0,0,0,0]},"west":{"uv":[0,0,0,0]},"up":{"uv":[0,0,0,0]},"down":{"uv":[0,0,0,0]}},

			{"rotation": [90, 0, 0], "size": [1,12,1], "pos": [13.5, -8, -0.5], "origin": [8, -8, 8], "north":{"uv":[2,2,3,14]},"east":{"uv":[2,2,3,14]},"south":{"uv":[2,2,3,14]},"west":{"uv":[2,2,3,14]},"up":{"uv":[2,2,3,3]},"down":{"uv":[2,2,3,3]}},
			{"rotation": [90, 0, 0], "size": [1,12,1], "pos": [2.5,  -8, -0.5], "origin": [8, -8, 8], "north":{"uv":[2,2,3,14]},"east":{"uv":[2,2,3,14]},"south":{"uv":[2,2,3,14]},"west":{"uv":[2,2,3,14]},"up":{"uv":[2,2,3,3]},"down":{"uv":[2,2,3,3]}},

			{"rotation": [90, 0, 0], "size": [10,1,1], "pos": [8, -2.5, -0.5], "origin": [8, -8, 8], "north":{"uv":[3,2,13,3]},"east":{"uv":[3,2,13,3]},"south":{"uv":[3,2,13,3]},"west":{"uv":[3,2,13,3]},"up":{"uv":[3,2,13,3]},"down":{"uv":[3,2,13,3]}},
			{"rotation": [90, 0, 0], "size": [10,1,1], "pos": [8, -13.5, -0.5], "origin": [8, -8, 8], "north":{"uv":[3,13,13,14]},"east":{"uv":[3,13,13,14]},"south":{"uv":[3,13,13,14]},"west":{"uv":[3,13,13,14]},"up":{"uv":[3,13,13,14]},"down":{"uv":[3,13,13,14]}}
		]`), 'assets/item_frame.png')
	}
	buildFrameTopInvisible() {
		this.buildModel(JSON.parse(`[
			{"size": [16,16,16], "pos": [8, -8.01, 8], "origin": [0, 0, 0], "north":{"uv":[0,0,16,16]},"east":{"uv":[0,0,16,16]},"south":{"uv":[0,0,16,16]},"west":{"uv":[0,0,16,16]},"up":{"uv":[0,0,16,16]},"down":{"uv":[0,0,16,16]}}
		]`), 'assets/missing.png')
	}
}
window.displayReferenceObjects = {
	refmodels: {
		player: 			new refModel('player', {icon: 'icon-player'}),
		zombie: 			new refModel('zombie', {icon: 'icon-zombie'}),
		armor_stand: 		new refModel('armor_stand', {icon: 'icon-armor_stand'}),
		baby_zombie: 		new refModel('baby_zombie', {icon: 'icon-baby_zombie'}),
		armor_stand_small:  new refModel('armor_stand_small', {icon: 'icon-armor_stand_small'}),
		fox: 				new refModel('fox', {icon: 'pets', condition: {formats: ['java_block']}}),
		monitor: 			new refModel('monitor', {icon: 'fa-asterisk'}),
		bow: 				new refModel('bow', {icon: 'icon-bow'}),
		crossbow: 			new refModel('crossbow', {icon: 'icon-crossbow'}),
		eating: 			new refModel('eating', {icon: 'fa-apple-whole'}),
		tooting: 			new refModel('tooting', {icon: 'fa-bullhorn'}),
		block: 				new refModel('block', {icon: 'fa-cube'}),
		frame: 				new refModel('frame', {icon: 'filter_frames'}),
		frame_invisible: 	new refModel('frame_invisible', {icon: 'visibility_off'}),
		frame_top: 			new refModel('frame_top', {icon: 'filter_frames'}),
		frame_top_invisible:new refModel('frame_top_invisible', {icon: 'visibility_off'}),
		inventory_nine: 	new refModel('inventory_nine', {icon: 'icon-inventory_nine'}),
		inventory_full:		new refModel('inventory_full', {icon: 'icon-inventory_full'}),
		hud: 				new refModel('hud', {icon: 'icon-hud'})
	},
	active: '',
	bar: function(buttons) {
		buttons = buttons.filter(id => Condition(this.refmodels[id]));
		$('#display_ref_bar').html('');
		if (buttons.length < 2) {
			$('.reference_model_bar').css('visibility', 'hidden')
		} else {
			$('.reference_model_bar').css('visibility', 'visible')
		}
		var i = 0;
		while (i < buttons.length) {
			var ref = this.refmodels[buttons[i]]
			let icon = Blockbench.getIconNode(ref.icon);
			var button = $(
				`<div>
					<input class="hidden" type="radio" name="refmodel" id="${ref.id}"${ i === 0 ? ' selected' : '' }>
					<label class="tool" onclick="displayReferenceObjects.refmodels.${ref.id}.load(${i})" for="${ref.id}">
						<div class="tooltip">${ref.name}</div>
					</label>
				</div>`
			)
			button.find('> label.tool').append(icon);
			$('#display_ref_bar').append(button)
			if (i === displayReferenceObjects.ref_indexes[display_slot]) {
				ref.load(i)
				button.find('input').prop("checked", true)
			}
			i++;
		}
	},
	clear: function() {
		scene.remove(displayReferenceObjects.active.model)
		displayReferenceObjects.active = false
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

const display_angle_preset = {
	projection: 'perspective',
	position: [-80, 40, -30],
	target: [0, 8, 0],
	default: true
}

enterDisplaySettings = function() {		//Enterung Display Setting Mode, changes the scene etc
	display_mode = true;

	unselectAllElements()

	if (Project.model_3d) display_base.add(Project.model_3d)
	if (!display_preview) {
		display_preview = new Preview({id: 'display'})
	}
	if (Preview.split_screen.enabled) {
		Preview.split_screen.before = Preview.split_screen.mode;
	}
	display_preview.fullscreen()

	Canvas.buildGrid()
	Canvas.updateShading()
	
	scene.add(display_area);
	if (Project.model_3d) {
		Project.model_3d.position.copy(Canvas.scene.position);
		Project.model_3d.position.y = -8;
	}
	scene.position.set(0, 0, 0);

	resizeWindow() //Update panels and sidebars so that the camera can be loaded with the correct aspect ratio
	DisplayMode.load(display_slot)

	display_area.updateMatrixWorld()
	Transformer.center()
	if (Canvas.outlines.children.length) {
		Canvas.outlines.children.empty();
	}
}
exitDisplaySettings = function() {		//Enterung Display Setting Mode, changes the scene etc
	resetDisplayBase()
	displayReferenceObjects.clear();
	setDisplayArea(0,0,0, 0,0,0, 1,1,1)
	display_area.updateMatrixWorld()
	lights.rotation.set(0, 0, 0);
	Canvas.global_light_side = 0;
	Canvas.updateShading();
	scene.remove(display_area)
	if (!Format.centered_grid) scene.position.set(-8, 0, -8);
	display_base.children.forEachReverse(child => {
		display_base.remove(child);
		child.position.set(0, 0, 0);
	})
	if (Project.model_3d) {
		scene.add(Project.model_3d);
		Project.model_3d.position.set(0, 0, 0);
	}

	display_mode = false;
	main_preview.fullscreen()

	resizeWindow()
	ReferenceImage.updateAll()
	if (Preview.split_screen.before) {
		Preview.split_screen.setMode(Preview.split_screen.before)
	}
	scene.add(Transformer)
	Canvas.buildGrid()
	Canvas.updateShading()
	Canvas.updateRenderSides()
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
	if (!slot) slot = Project.display_settings[display_slot]

	display_base.rotation.x = Math.PI / (180 / slot.rotation[0]);
	display_base.rotation.y = Math.PI / (180 / slot.rotation[1]) * (display_slot.includes('lefthand') ? -1 : 1);
	display_base.rotation.z = Math.PI / (180 / slot.rotation[2]) * (display_slot.includes('lefthand') ? -1 : 1);

	display_base.position.x = slot.translation[0] * (display_slot.includes('lefthand') ? -1 : 1);
	display_base.position.y = slot.translation[1];
	display_base.position.z = slot.translation[2];

	display_base.scale.x = (slot.scale[0]||0.001) * (slot.mirror[0] ? -1 : 1);
	display_base.scale.y = (slot.scale[1]||0.001) * (slot.mirror[1] ? -1 : 1);
	display_base.scale.z = (slot.scale[2]||0.001) * (slot.mirror[2] ? -1 : 1);

	if (!slot.rotation_pivot.allEqual(0)) {
		let rot_piv_offset = new THREE.Vector3().fromArray(slot.rotation_pivot).multiplyScalar(16);
		let original = new THREE.Vector3().copy(rot_piv_offset);
		rot_piv_offset.applyEuler(display_base.rotation);
		rot_piv_offset.sub(original);
		display_base.position.sub(rot_piv_offset);
	}
	if (!slot.scale_pivot.allEqual(0)) {
		let scale_piv_offset = new THREE.Vector3().fromArray(slot.scale_pivot).multiplyScalar(16);
		scale_piv_offset.applyEuler(display_base.rotation);
		scale_piv_offset.x *= (1-slot.scale[0]);
		scale_piv_offset.y *= (1-slot.scale[1]);
		scale_piv_offset.z *= (1-slot.scale[2]);
		display_base.position.add(scale_piv_offset)
	}

	Transformer.center()
}


DisplayMode.applyPreset = function(preset, all) {
	if (preset == undefined) return;
	var slots = [display_slot];
	if (all) {
		slots = displayReferenceObjects.slots
	} else if (preset.areas[display_slot] == undefined) {
		Blockbench.showQuickMessage('message.preset_no_info')
		return;
	};
	Undo.initEdit({display_slots: slots})
	slots.forEach(function(sl) {
		if (!Project.display_settings[sl]) {
			Project.display_settings[sl] = new DisplaySlot(sl)
		}
		let preset_values = preset.areas[sl];
		if (preset_values) {
			if (!preset_values.rotation_pivot) Project.display_settings[sl].rotation_pivot.replace([0, 0, 0]);
			if (!preset_values.scale_pivot) Project.display_settings[sl].scale_pivot.replace([0, 0, 0]);
			Project.display_settings[sl].extend(preset.areas[sl]);
			if (preset.id == 'block' && Format.id == 'bedrock_block' && sl == 'gui') {
				Project.display_settings[sl].rotation[1] = 45;
			}
		}
	})
	DisplayMode.updateDisplayBase()
	Undo.finishEdit('Apply display preset')
}
DisplayMode.loadJSON = function(data) {
	for (var slot in data) {
		if (displayReferenceObjects.slots.includes(slot)) {
			Project.display_settings[slot] = new DisplaySlot(slot).extend(data[slot])
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
	ground_timer += 1;
	let ground_offset = 3.8;
	if (Format.id != 'bedrock_block') {
		ground_offset = 1.9 + display_base.scale.y * 3.6;
	}
	display_area.position.y = ground_offset + Math.sin(Math.PI * (ground_timer / 100)) * Math.PI/2
	Transformer.center()
	if (ground_timer === 200) ground_timer = 0;
}
DisplayMode.updateGUILight = function() {
	if (!Modes.display) return;
	if (Format.id == 'bedrock_block') {
		Canvas.global_light_side = 0;
		Canvas.updateShading();
	} else if (display_slot == 'gui' && Project.front_gui_light == true) {
		lights.rotation.set(-Math.PI, 0.6, 0);
		Canvas.global_light_side = 4;
	} else {
		lights.rotation.set(0, 0, 0);
		Canvas.global_light_side = 0;
	}
	Canvas.updateShading();
} 

function loadDisp(key) {	//Loads The Menu and slider values, common for all Radio Buttons
	display_slot = key

	if (key !== 'gui' && display_preview.isOrtho === true) {
		display_preview.loadAnglePreset(display_angle_preset)
	}
	display_preview.controls.enabled = true;
	ground_animation = false;
	$('#display_crosshair').detach()
	if (display_preview.orbit_gizmo) display_preview.orbit_gizmo.unhide();
	display_preview.camPers.setFocalLength(45)

	if (Project.display_settings[key] == undefined) {
		Project.display_settings[key] = new DisplaySlot(key)
	}
	display_preview.force_locked_angle = false;
	DisplayMode.vue._data.slot = Project.display_settings[key]
	DisplayMode.slot = Project.display_settings[key]
	DisplayMode.updateDisplayBase();
	Canvas.updateRenderSides();
	DisplayMode.updateGUILight();
	Toolbars.display.update();
}
DisplayMode.loadThirdRight = function() {	//Loader
	loadDisp('thirdperson_righthand')
	display_preview.loadAnglePreset({
		position: [-44, 40, -44],
		target: [0, 14, 0]
	})
	displayReferenceObjects.bar(['player', 'zombie', 'baby_zombie', 'armor_stand', 'armor_stand_small'])
}
DisplayMode.loadThirdLeft = function() {	//Loader
	loadDisp('thirdperson_lefthand')
	display_preview.camPers.position.set(-44, 40, -44)
	display_preview.controls.target.set(0, 14, 0)
	display_preview.loadAnglePreset({
		position: [-44, 40, -44],
		target: [0, 14, 0]
	})
	displayReferenceObjects.bar(['player', 'zombie', 'baby_zombie', 'armor_stand', 'armor_stand_small'])
}
function getOptimalFocalLength() {
	if (display_preview.camera.aspect > 1.7) {
		return 18 / display_preview.camera.aspect;
	} else if (display_preview.camera.aspect > 1.0) {
		return 16.57 + -3.57 * display_preview.camera.aspect;
	} else {
		return 13 * display_preview.camera.aspect;
	}
}
DisplayMode.loadFirstRight = function() {	//Loader
	loadDisp('firstperson_righthand')
	display_preview.loadAnglePreset({
		position: [0, 24, 32.4],
		target: [0, 24, 0],
		focal_length: getOptimalFocalLength(),
	})
	display_preview.controls.enabled = false
	if (display_preview.orbit_gizmo) display_preview.orbit_gizmo.hide();
	displayReferenceObjects.bar(['monitor', 'bow', 'crossbow', 'tooting', 'eating']);
	$('.single_canvas_wrapper').append('<div id="display_crosshair"></div>')
}
DisplayMode.loadFirstLeft = function() {	//Loader
	loadDisp('firstperson_lefthand')
	display_preview.loadAnglePreset({
		position: [0, 24, 32.4],
		target: [0, 24, 0],
		focal_length: getOptimalFocalLength(),
	})
	display_preview.controls.enabled = false
	if (display_preview.orbit_gizmo) display_preview.orbit_gizmo.hide();
	displayReferenceObjects.bar(['monitor', 'bow', 'crossbow', 'tooting', 'eating']);
	$('.single_canvas_wrapper').append('<div id="display_crosshair"></div>')
}
DisplayMode.loadHead = function() {		//Loader
	loadDisp('head')
	display_preview.loadAnglePreset({
		position: [-30, 40, -30],
		target: [0, 22, 0]
	})
	displayReferenceObjects.bar(['player', 'zombie', 'baby_zombie', 'armor_stand', 'armor_stand_small'])
}
DisplayMode.loadGUI = function() {		//Loader
	loadDisp('gui')
	setDisplayArea(0, 0, 0, 0, 0, 0, 0.4, 0.4, 0.4)

	display_preview.loadAnglePreset({
		projection: 'orthographic',
		position: [0, 0, 32],
		target: [0, 0, 0],
		locked_angle: 'south',
		zoom: 1,
	})
	if (display_preview.orbit_gizmo) display_preview.orbit_gizmo.hide();
	displayReferenceObjects.bar(['inventory_nine', 'inventory_full', 'hud'])
	BarItems.gui_light.set(Project.front_gui_light ? 'front' : 'side');
}
DisplayMode.loadGround = function() {		//Loader
	loadDisp('ground')
	display_preview.loadAnglePreset({
		position: [-40, 37, -40],
		target: [0, 3, 0]
	})
	setDisplayArea(8, 4, 8, 0, 0, 0, 1, 1, 1)
	ground_animation = true;
	ground_timer = 0
	displayReferenceObjects.bar(['block', 'fox'])
}
DisplayMode.loadFixed = function() {		//Loader
	loadDisp('fixed')
	display_preview.loadAnglePreset({
		position: [-24, 18, -50],
		target: [0, 1, -5]
	})
	displayReferenceObjects.bar(['frame', 'frame_invisible', 'frame_top', 'frame_top_invisible'])
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
	Undo.finishEdit('Paste display slot')
}

DisplayMode.scrollSlider = function(type, value, el) {
	Undo.initEdit({display_slots: [display_slot]})

	var [channel, axis] = type.split('.')
	DisplayMode.slot[channel][parseInt(axis)] = value

	DisplayMode.slot.update()
	Undo.finishEdit('Change display slot')
}

window.changeDisplaySkin = function() {
	var commands = {
		file: tl('message.display_skin.upload'),
		name: isApp ? tl('message.display_skin.username') : undefined, // Not available in web due to CORS policy of mojang API
		reset: tl('message.display_skin.reset'),
	};
	Blockbench.showMessageBox({
		translateKey: 'display_skin',
		icon: 'icon-player',
		commands,
		buttons: ['dialog.cancel'],
	}, (result) => {
		if (result === 'file') {
			Blockbench.import({
				resource_id: 'minecraft_skin',
				extensions: ['png'],
				type: 'PNG Player Skin',
				readtype: 'image'
			}, (files) => {

				let img_content = isApp ? files[0].path : files[0].content;
				let img = new Image();
				img.src = img_content;
				Blockbench.showMessageBox({
					translateKey: 'display_skin_model',
					icon: img,
					commands: {
						classic: tl('message.display_skin_model.classic'),
						slim: tl('message.display_skin_model.slim')
					},
					buttons: ['dialog.cancel'],
				}, (type) => {
					if (files.length && type) {
						settings.display_skin.value = (type == 'slim'?'S':'C') +','+ img_content;
						updateDisplaySkin(true);
						Settings.saveLocalStorages();
					}
				})
			})
		} else if (result === 'name' && isApp) {
			if (typeof settings.display_skin.value === 'string' && settings.display_skin.value.substr(0, 9) === 'username:') {
				var before = settings.display_skin.value.replace('username:', '')
			} else {
				var before = ''
			}
			Blockbench.textPrompt(tl('message.display_skin.username'), before, function(text) {
				settings.display_skin.value = 'username:'+text
				updateDisplaySkin(true);
				Settings.saveLocalStorages();
			})
		} else if (result === 'reset') {
			settings.display_skin.value = false;
			updateDisplaySkin(true);
			Settings.saveLocalStorages();
		}
	})
}
function updateDisplaySkin(feedback) {
	var val = settings.display_skin.value
	function setPSkin(skin, slim) {
		if (displayReferenceObjects.refmodels.player.material) {
			let {material} = displayReferenceObjects.refmodels.player;
	
			material.map.image.src = skin;
			material.map.needsUpdate = true;
			material.map.onUpdate = function() {
				material.map.onUpdate = null;
				displayReferenceObjects.refmodels.player.setModelVariant(slim ? 'alex' : 'steve')
			};
		}
		if (PreviewModel.models.attachable_reference_player) {
			let {material} = PreviewModel.models.attachable_reference_player;
			material.map.image.src = skin;
			material.map.needsUpdate = true;
			PreviewModel.models.attachable_reference_player.updateArmVariant(slim);
		}
		if (PreviewModel.models.minecraft_player) {
			let {material} = PreviewModel.models.minecraft_player;
			material.map.image.src = skin;
			material.map.needsUpdate = true;
			PreviewModel.models.minecraft_player.updateArmVariant(slim);
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
							var parsed = JSON.parse(Buffer.from(data.properties[0].value, 'base64').toString())
							skin_path = parsed.textures.SKIN.url
							if (parsed.textures.SKIN.metadata && parsed.textures.SKIN.metadata.model === 'slim') {
								is_slim = true
							}
						} catch (err) {}
						setPSkin(skin_path, is_slim)
					}
				})
			} else if (feedback) {
				Blockbench.showQuickMessage(tl('message.display_skin.invalid_name', [username]), 2000);
			}
		})
	} else {
		if (val[1] === ',') {
			var slim = val[0] === 'S';
			val = val.substr(2);
		} else {
			var slim = false;
		}
		if (isApp) val += '?' + Math.floor(Math.random()*99);
		setPSkin(val, slim);
	}
}
DisplayMode.updateDisplaySkin = updateDisplaySkin;

DisplayMode.debugBase = function() {
	new Dialog('display_base_debug', {
		title: 'Debug Display Base',
		darken: false,
		form: {
			translation: {type: 'vector', dimensions: 3, step: 0.1, value: [0, 0, 0], label: 'Translation'},
			rotation: {type: 'vector', dimensions: 3, step: 0.5, value: [0, 0, 0], label: 'Rotation'},
			scale: {type: 'vector', dimensions: 3, step: 0.05, value: [1, 1, 1], label: 'Scale'},
		},
		onFormChange(result) {
			DisplayMode.setBase(...result.translation, ...result.rotation, ...result.scale)
		}
	}).show();
}

BARS.defineActions(function() {
	new Action('add_display_preset', {
		icon: 'add',
		category: 'display',
		condition: {modes: ['display']},
		click() {
			new Dialog({
				id: 'display_preset',
				title: 'dialog.display_preset.title',
				width: 300,
				form: {
					name: {label: 'generic.name', type: 'text', placeholder: tl('display.preset.blank_name')},
					_: '_',

					info: {type: 'info', text: 'dialog.display_preset.message'},
					thirdperson_righthand: {type: 'checkbox', label: 'display.slot.third_right', value: true},
					thirdperson_lefthand: {type: 'checkbox', label: 'display.slot.third_left', value: true},
					firstperson_righthand: {type: 'checkbox', label: 'display.slot.first_right', value: true},
					firstperson_lefthand: {type: 'checkbox', label: 'display.slot.first_left', value: true},
					head: {type: 'checkbox', label: 'display.slot.head', value: true},
					ground: {type: 'checkbox', label: 'display.slot.ground', value: true},
					fixed: {type: 'checkbox', label: 'display.slot.frame', value: true},
					gui: {type: 'checkbox', label: 'display.slot.gui', value: true},
				},
				onConfirm(form_data) {
					let preset = {
						name: form_data.name || tl('display.preset.blank_name'),
						areas: {}
					}
					display_presets.push(preset);

					displayReferenceObjects.slots.forEach((s) => {
						if (form_data[s] && Project.display_settings[s]) {
							preset.areas[s] = Project.display_settings[s].copy();
						}
					})
					localStorage.setItem('display_presets', JSON.stringify(display_presets));
				}
			}).show();
		}
	})
	new Action('apply_display_preset', {
		icon: 'fa-list',
		category: 'display',
		condition: {modes: ['display']},
		click: function (e) {
			new Menu('apply_display_preset', this.children(), {searchable: true}).open(e.target);
		},
		children: function() {
			var presets = []
			display_presets.forEach(function(p) {
				var icon = 'label'
				if (p.fixed) {
					switch(p.id) {
						case 'item': icon = 'filter_vintage'; break;
						case 'block': icon = 'fa-cube'; break;
						case 'handheld': icon = 'build'; break;
						case 'rod': icon = 'remove'; break;
						case 'armor_stand': icon = 'icon-armor_stand'; break;
					}
				}
				presets.push({
					icon: icon,
					name: p.id ? tl('display.preset.'+p.id) : p.name,
					click() {
						DisplayMode.applyPreset(p)
					},
					children: [
						{name: 'action.apply_display_preset.here', icon: 'done', click() {
							DisplayMode.applyPreset(p)
						}},
						{name: 'action.apply_display_preset.everywhere', icon: 'done_all', click() {
							DisplayMode.applyPreset(p, true)
						}},
						{
							icon: 'delete',
							name: 'generic.delete',
							condition: !p.fixed,
							click: function() {
								display_presets.splice(display_presets.indexOf(p), 1);
								localStorage.setItem('display_presets', JSON.stringify(display_presets))
							}
						}
					]
				})
			})
			return presets;
		}
	})

	new BarSelect('gui_light', {
		options: {
			side: true,
			front: true,
		},
		condition: () => Modes.display && display_slot === 'gui' && Format.id == 'java_block',
		onChange: function(slider) {
			Project.front_gui_light = slider.get() == 'front';
			DisplayMode.updateGUILight();
		}
	})
})

Interface.definePanels(function() {
	
	new Panel('display', {
		icon: 'tune',
		condition: {modes: ['display']},
		default_position: {
			slot: 'left_bar',
			float_position: [0, 0],
			float_size: [300, 400],
			height: 400
		},
		toolbars: [
			new Toolbar({
				id: 'display',
				children: [
					'copy',
					'paste',
					'add_display_preset',
					'apply_display_preset',
					'gui_light'
				]
			})
		],
		component: {
			name: 'panel-display',
			data() {return {
				axes: [0, 1, 2],
				reference_model: 'player',
				pose_angle: 0,
				slot: new DisplaySlot(''),
				allow_mirroring: Settings.get('allow_display_slot_mirror')
			}},
			watch: {
				pose_angle(value) {
					displayReferenceObjects.active.pose_angles[display_slot] = value;
					if (displayReferenceObjects.active.updateBasePosition) displayReferenceObjects.active.updateBasePosition();
				}
			},
			methods: {
				allowMirroring() {
					return this.allow_mirroring && !this.isBedrockStyle();
				},
				allowEnablingMirroring() {
					return Format.id != 'bedrock_block';
				},
				isBedrockStyle() {
					return Format.id == 'bedrock_block';
				},
				isMirrored: (axis) => {
					if (Project.display_settings[display_slot]) {
						return Project.display_settings[display_slot].scale[axis] < 0;
					}
				},
				change: (axis, channel) => {
					if (channel === 'scale') {
						if (Pressing.shift || Pressing.overrides.shift) {
							var val = limitNumber(parseFloat(DisplayMode.slot.scale[axis]), 0, 4)
							DisplayMode.slot.scale[0] = val;
							DisplayMode.slot.scale[1] = val;
							DisplayMode.slot.scale[2] = val;
						}
					}
					DisplayMode.updateDisplayBase()
				},
				focusout: (axis, channel) => {
					if (channel === 'scale') {
						var val = limitNumber(DisplayMode.slot.scale[axis], 0, 4)
						DisplayMode.slot.scale[axis] = val;
						if (Pressing.shift || Pressing.overrides.shift) {
							DisplayMode.slot.scale[0] = val;
							DisplayMode.slot.scale[1] = val;
							DisplayMode.slot.scale[2] = val;
						}
					} else if (channel === 'translation') {
						DisplayMode.slot.translation[axis] = limitNumber(DisplayMode.slot.translation[axis], -80, 80)||0;
					} else if (channel == 'rotation') {
						DisplayMode.slot.rotation[axis] = Math.trimDeg(DisplayMode.slot.rotation[axis])||0;
					} else {
						DisplayMode.slot[channel][axis] = DisplayMode.slot[channel][axis] ?? 0;
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
					Undo.finishEdit('Reset display channel')
				},
				invert: (axis) => {
					Undo.initEdit({display_slots: [display_slot]})
					DisplayMode.slot.mirror[axis] = !DisplayMode.slot.mirror[axis];
					DisplayMode.slot.update()
					Undo.finishEdit('Mirror display setting')
				},
				start: () => {
					Undo.initEdit({display_slots: [display_slot]});
					Interface.addSuggestedModifierKey('shift', 'modifier_actions.uniform_scaling');
				},
				save: () => {
					Undo.finishEdit('Change display setting');
					Interface.removeSuggestedModifierKey('shift', 'modifier_actions.uniform_scaling');
				},
				toggleFitToFrame() {
					Undo.initEdit({display_slots: [display_slot]});
					this.slot.fit_to_frame = !this.slot.fit_to_frame;
					Undo.finishEdit('Change display setting fit-to-frame property');
					Interface.removeSuggestedModifierKey('shift', 'modifier_actions.uniform_scaling');
				},
				showMirroringSetting() {
					Settings.openDialog({search_term: tl('settings.allow_display_slot_mirror')});
				},
				getAxisLetter
			},
			template: `
				<div>
					<div class="toolbar_wrapper display"></div>
					<p class="panel_toolbar_label">${ tl('display.slot') }</p>
					<div id="display_bar" class="bar tabs_small icon_bar">
						<input class="hidden" type="radio" name="display" id="thirdperson_righthand" checked>
						<label class="tool" for="thirdperson_righthand" onclick="DisplayMode.loadThirdRight()"><div class="tooltip">${ tl('display.slot.third_right') }</div><i class="material-icons">accessibility</i></label>
						<input class="hidden" type="radio" name="display" id="thirdperson_lefthand">
						<label class="tool" for="thirdperson_lefthand" onclick="DisplayMode.loadThirdLeft()"><div class="tooltip">${ tl('display.slot.third_left') }</div><i class="material-icons">accessibility</i></label>
		
						<input class="hidden" type="radio" name="display" id="firstperson_righthand">
						<label class="tool" for="firstperson_righthand" onclick="DisplayMode.loadFirstRight()"><div class="tooltip">${ tl('display.slot.first_right') }</div><i class="material-icons">person</i></label>
						<input class="hidden" type="radio" name="display" id="firstperson_lefthand">
						<label class="tool" for="firstperson_lefthand" onclick="DisplayMode.loadFirstLeft()"><div class="tooltip">${ tl('display.slot.first_left') }</div><i class="material-icons">person</i></label>
		
						<input class="hidden" type="radio" name="display" id="head">
						<label class="tool" for="head" onclick="DisplayMode.loadHead()"><div class="tooltip">${ tl('display.slot.head') }</div><i class="material-icons">sentiment_satisfied</i></label>
		
						<input class="hidden" type="radio" name="display" id="ground">
						<label class="tool" for="ground" onclick="DisplayMode.loadGround()"><div class="tooltip">${ tl('display.slot.ground') }</div><i class="icon-ground"></i></label>
		
						<input class="hidden" type="radio" name="display" id="fixed">
						<label class="tool" for="fixed" onclick="DisplayMode.loadFixed()"><div class="tooltip">${ tl('display.slot.frame') }</div><i class="material-icons">filter_frames</i></label>
		
						<input class="hidden" type="radio" name="display" id="gui">
						<label class="tool" for="gui" onclick="DisplayMode.loadGUI()"><div class="tooltip">${ tl('display.slot.gui') }</div><i class="material-icons">border_style</i></label>
					</div>
					<p class="panel_toolbar_label">${ tl('display.reference') }</p>
					<div id="display_ref_bar" class="bar tabs_small icon_bar">
					</div>
		
					<div id="display_sliders">
						
						<div class="bar display_slot_section_bar">
							<p class="panel_toolbar_label">${ tl('display.rotation') }</p>
							<div class="tool head_right" v-on:click="resetChannel('rotation')"><i class="material-icons">replay</i></div>
						</div>
						<div class="bar slider_input_combo" v-for="axis in axes" :title="getAxisLetter(axis).toUpperCase()">
							<input type="range" :style="{'--color-thumb': \`var(--color-axis-\${getAxisLetter(axis)})\`}" class="tool disp_range" v-model.number="slot.rotation[axis]" v-bind:trigger_type="'rotation.'+axis"
								min="-180" max="180" step="1" value="0"
								@input="change(axis, 'rotation')" @mousedown="start()" @change="save">
							<numeric-input class="tool disp_text" v-model.number="slot.rotation[axis]" :min="-180" :max="180" :step="0.5" @input="change(axis, 'rotation')" @focusout="focusout(axis, 'rotation');save()" @mousedown="start()" />
						</div>
						
						<div class="bar display_slot_section_bar">
							<p class="panel_toolbar_label">${ tl('display.translation') }</p>
							<div class="tool head_right" v-on:click="resetChannel('translation')"><i class="material-icons">replay</i></div>
							</div>
						<div class="bar slider_input_combo" v-for="axis in axes" :title="getAxisLetter(axis).toUpperCase()">
							<input type="range" :style="{'--color-thumb': \`var(--color-axis-\${getAxisLetter(axis)})\`}" class="tool disp_range" v-model.number="slot.translation[axis]" v-bind:trigger_type="'translation.'+axis"
								v-bind:min="Math.abs(slot.translation[axis]) < 10 ? -20 : (slot.translation[axis] > 0 ? -70*3+10 : -80)"
								v-bind:max="Math.abs(slot.translation[axis]) < 10 ?  20 : (slot.translation[axis] < 0 ? 70*3-10 : 80)"
								v-bind:step="Math.abs(slot.translation[axis]) < 10 ? 0.25 : 1"
								value="0" @input="change(axis, 'translation')" @mousedown="start()" @change="save">
							<numeric-input class="tool disp_text" v-model.number="slot.translation[axis]" :min="-80" :max="80" :step="0.5" @input="change(axis, 'translation')" @focusout="focusout(axis, 'translation');save()" @mousedown="start()" />
						</div>

						<div class="bar display_slot_section_bar">
							<p class="panel_toolbar_label">${ tl('display.scale') }</p>
							<div class="tool head_right" @click="showMirroringSetting()" v-if="allowEnablingMirroring()"><i class="material-icons">flip</i></div>
							<div class="tool head_right" @click="resetChannel('scale')"><i class="material-icons">replay</i></div>
						</div>
						<div class="bar slider_input_combo" v-for="axis in axes" :title="getAxisLetter(axis).toUpperCase()">
							<div class="tool display_scale_invert" v-on:click="invert(axis)" v-if="allowMirroring()">
								<div class="tooltip">${ tl('display.mirror') }</div>
								<i class="material-icons">{{ slot.mirror[axis] ? 'check_box' : 'check_box_outline_blank' }}</i>
							</div>
							<input type="range" :style="{'--color-thumb': \`var(--color-axis-\${getAxisLetter(axis)})\`}" class="tool disp_range scaleRange" v-model.number="slot.scale[axis]" v-bind:trigger_type="'scale.'+axis" v-bind:id="'scale_range_'+axis"
								v-bind:min="slot.scale[axis] > 1 ? -2 : 0"
								v-bind:max="slot.scale[axis] > 1 ? 4 : 2"
								step="0.01"
								value="0" @input="change(axis, 'scale')" @mousedown="start(axis, 'scale')" @change="save(axis, 'scale')">
							<numeric-input class="tool disp_text" v-model.number="slot.scale[axis]" :min="0" :max="4" :step="0.01" @input="change(axis, 'scale')" @focusout="focusout(axis, 'scale');save()" @mousedown="start()" />
						</div>
						<div class="bar" v-if="isBedrockStyle() && slot.slot_id == 'gui'" @click="toggleFitToFrame()">
							<input type="checkbox" :checked="slot.fit_to_frame == true">
							<label style="padding-top: 3px;">Fit to Frame</label>
						</div>
						
						<template v-if="reference_model == 'player'">
							<div class="bar display_slot_section_bar">
								<p class="panel_toolbar_label">${ tl('display.pose_angle') }</p>
							</div>
							<div class="bar slider_input_combo">
								<input type="range" class="tool disp_range" v-model.number="pose_angle"
									min="-180" max="180" step="1" >
								<numeric-input class="tool disp_text" v-model.number="pose_angle" :min="-180" :max="180" :step="0.5" />
							</div>
						</template>
						
						<template v-if="isBedrockStyle()">
							<div class="bar display_slot_section_bar">
								<p class="panel_toolbar_label">${ tl('display.rotation_pivot') }</p>
								<div class="tool head_right" v-on:click="resetChannel('rotation_pivot')"><i class="material-icons">replay</i></div>
							</div>
							<div class="bar display_inline_inputs">
								<numeric-input class="tool disp_text is_colored"
									:style="{'--corner-color': 'var(--color-axis-'+getAxisLetter(axis) + ')'}"
									v-for="axis in axes" :title="getAxisLetter(axis).toUpperCase()"
									v-model.number="slot.rotation_pivot[axis]"
									:min="-10" :max="10" :step="0.05"
									@input="change(axis, 'rotation_pivot')"
									@focusout="focusout(axis, 'rotation_pivot');save()"
									@mousedown="start()"
								/>
							</div>

							<div class="bar display_slot_section_bar">
								<p class="panel_toolbar_label">${ tl('display.scale_pivot') }</p>
								<div class="tool head_right" v-on:click="resetChannel('scale_pivot')"><i class="material-icons">replay</i></div>
							</div>
							<div class="bar display_inline_inputs">
								<numeric-input class="tool disp_text is_colored"
									:style="{'--corner-color': 'var(--color-axis-'+getAxisLetter(axis) + ')'}"
									v-for="axis in axes" :title="getAxisLetter(axis).toUpperCase()"
									v-model.number="slot.scale_pivot[axis]"
									:min="-10" :max="10" :step="0.05"
									@input="change(axis, 'scale_pivot')"
									@focusout="focusout(axis, 'scale_pivot');save()"
									@mousedown="start()"
								/>
							</div>
						</template>
					</div>
				</div>
			`
		},
	})
	DisplayMode.vue = Interface.Panels.display.inside_vue;
})


// Bedrock Attachables
BARS.defineActions(function() {

	let player_attachable_reference_model = new PreviewModel('attachable_reference_player', {
		texture: './assets/player_skin.png',
		texture_size: [64, 64],
		cubes: [
			{
				// "Head
				"position": [-4, 24, -4],
				"size": [8, 8, 8],
				"faces": {
					"north": {"uv": [8, 8, 16, 16]},
					"east": {"uv": [0, 8, 8, 16]},
					"south": {"uv": [24, 8, 32, 16]},
					"west": {"uv": [16, 8, 24, 16]},
					"up": {"uv": [16, 8, 8, 0]},
					"down": {"uv": [24, 0, 16, 8]}
				}
			},
			{
				// Hat Layer
				"position": [-4.5, 23.5, -4.5],
				"size": [9, 9, 9],
				"faces": {
					"north": {"uv": [40, 8, 48, 16]},
					"east": {"uv": [32, 8, 40, 16]},
					"south": {"uv": [56, 8, 64, 16]},
					"west": {"uv": [48, 8, 56, 16]},
					"up": {"uv": [48, 8, 40, 0]},
					"down": {"uv": [56, 0, 48, 8]}
				}
			},
			{
				// "Body
				"position": [-4, 12, -2],
				"size": [8, 12, 4],
				"faces": {
					"north": {"uv": [20, 20, 28, 32]},
					"east": {"uv": [16, 20, 20, 32]},
					"south": {"uv": [32, 20, 40, 32]},
					"west": {"uv": [28, 20, 32, 32]},
					"up": {"uv": [28, 20, 20, 16]},
					"down": {"uv": [36, 16, 28, 20]}
				}
			},
			{
				// Body Layer
				"position": [-4.25, 11.75, -2.25],
				"size": [8.5, 12.5, 4.5],
				"faces": {
					"north": {"uv": [20, 36, 28, 48]},
					"east": {"uv": [16, 36, 20, 48]},
					"south": {"uv": [32, 36, 40, 48]},
					"west": {"uv": [28, 36, 32, 48]},
					"up": {"uv": [28, 36, 20, 32]},
					"down": {"uv": [36, 32, 28, 36]}
				}
			},


			// ======= Wide Arms
			{
				// Right Arm
				"position": [4, 12, -2],
				"size": [4, 12, 4],
				"origin": [5, 22, 0],
				"rotation": [15, 0, 0],
				"faces": {
					"north": {"uv": [44, 20, 48, 32]},
					"east": {"uv": [40, 20, 44, 32]},
					"south": {"uv": [52, 20, 56, 32]},
					"west": {"uv": [48, 20, 52, 32]},
					"up": {"uv": [48, 20, 44, 16]},
					"down": {"uv": [52, 16, 48, 20]}
				}
			},
			{
				// Arm Layer
				"position": [3.75, 11.75, -2.25],
				"size": [4.5, 12.5, 4.5],
				"origin": [5, 22, 0],
				"rotation": [15, 0, 0],
				"faces": {
					"north": {"uv": [44, 36, 48, 48]},
					"east": {"uv": [40, 36, 44, 48]},
					"south": {"uv": [52, 36, 56, 48]},
					"west": {"uv": [48, 36, 52, 48]},
					"up": {"uv": [48, 36, 44, 32]},
					"down": {"uv": [52, 32, 48, 36]}
				}
			},
			{
				// Left Arm
				"position": [-8, 12, -2],
				"size": [4, 12, 4],
				"origin": [-5, 22, 0],
				"rotation": [1, 0, -3],
				"faces": {
					"north": {"uv": [36, 52, 40, 64]},
					"east": {"uv": [32, 52, 36, 64]},
					"south": {"uv": [44, 52, 48, 64]},
					"west": {"uv": [40, 52, 44, 64]},
					"up": {"uv": [40, 52, 36, 48]},
					"down": {"uv": [44, 48, 40, 52]}
				}
			},
			{
				// Arm Layer
				"position": [-8.25, 11.75, -2.25],
				"size": [4.5, 12.5, 4.5],
				"origin": [-5, 22, 0],
				"rotation": [1, 0, -3],
				"faces": {
					"north": {"uv": [52, 52, 56, 64]},
					"east": {"uv": [48, 52, 52, 64]},
					"south": {"uv": [60, 52, 64, 64]},
					"west": {"uv": [56, 52, 60, 64]},
					"up": {"uv": [56, 52, 52, 48]},
					"down": {"uv": [60, 48, 56, 52]}
				}
			},


			// ======= Slim Arms
			{
				// Right Arm
				"position": [4, 11.5, -2],
				"size": [3, 12, 4],
				"origin": [5, 21.5, 0],
				"rotation": [15, 0, 0],
				"faces": {
					"north": {"uv": [44,20,47,32]},
					"east": {"uv": [40,20,44,32]},
					"south": {"uv": [51,20,54,32]},
					"west": {"uv": [47,20,51,32]},
					"up": {"uv": [47,20,44,16]},
					"down": {"uv": [50,16,47,20]}
				}
			},
			{
				// Arm Layer
				"position": [3.75, 11.25, -2.25],
				"size": [3.5, 12.5, 4.5],
				"origin": [5, 21.5, 0],
				"rotation": [15, 0, 0],
				"faces": {
					"north": {"uv": [44,36,47,48]},
					"east": {"uv": [40,36,44,48]},
					"south": {"uv": [51,36,54,48]},
					"west": {"uv": [47,36,51,48]},
					"up": {"uv": [47,36,44,32]},
					"down": {"uv": [50,32,47,36]}
				}
			},
			{
				// Left Arm
				"position": [-7, 11.5, -2],
				"size": [3, 12, 4],
				"origin": [-5, 21.5, 0],
				"rotation": [1, 0, -3],
				"faces": {
					"north": {"uv": [36,52,39,64]},
					"east": {"uv": [32,52,36,64]},
					"south": {"uv": [43,52,46,64]},
					"west": {"uv": [39,52,43,64]},
					"up": {"uv": [39,52,36,48]},
					"down": {"uv": [42,48,39,52]}
				}
			},
			{
				// Arm Layer
				"position": [-7.25, 11.25, -2.25],
				"size": [3.5, 12.5, 4.5],
				"origin": [-5, 21.5, 0],
				"rotation": [1, 0, -3],
				"faces": {
					"north": {"uv": [52,52,55,64]},
					"east": {"uv": [48,52,52,64]},
					"south": {"uv": [59,52,62,64]},
					"west": {"uv": [55,52,59,64]},
					"up": {"uv": [55,52,52,48]},
					"down": {"uv": [58,48,55,52]}
				}
			},


			{
				// Right Leg
				"position": [-0.1, 0, -2],
				"size": [4, 12, 4],
				"faces": {
					"north": {"uv": [4, 20, 8, 32]},
					"east": {"uv": [0, 20, 4, 32]},
					"south": {"uv": [12, 20, 16, 32]},
					"west": {"uv": [8, 20, 12, 32]},
					"up": {"uv": [8, 20, 4, 16]},
					"down": {"uv": [12, 16, 8, 20]}
				}
			},
			{
				// Leg Layer
				"position": [-0.35, -0.25, -2.25],
				"size": [4.5, 12.5, 4.5],
				"faces": {
					"north": {"uv": [4, 36, 8, 48]},
					"east": {"uv": [0, 36, 4, 48]},
					"south": {"uv": [12, 36, 16, 48]},
					"west": {"uv": [8, 36, 12, 48]},
					"up": {"uv": [8, 36, 4, 32]},
					"down": {"uv": [12, 32, 8, 36]}
				}
			},
			{
				// Left Leg
				"position": [-3.9, 0, -2],
				"size": [4, 12, 4],
				"faces": {
					"north": {"uv": [20, 52, 24, 64]},
					"east": {"uv": [16, 52, 20, 64]},
					"south": {"uv": [28, 52, 32, 64]},
					"west": {"uv": [24, 52, 28, 64]},
					"up": {"uv": [24, 52, 20, 48]},
					"down": {"uv": [28, 48, 24, 52]}
				}
			},
			{
				// Leg Layer
				"position": [-4.15, -0.25, -2.25],
				"size": [4.5, 12.5, 4.5],
				"faces": {
					"north": {"uv": [4, 52, 8, 64]},
					"east": {"uv": [0, 52, 4, 64]},
					"south": {"uv": [12, 52, 16, 64]},
					"west": {"uv": [8, 52, 12, 64]},
					"up": {"uv": [8, 52, 4, 48]},
					"down": {"uv": [12, 48, 8, 52]}
				}
			}
		]
	})

	window.player_attachable_reference_model = player_attachable_reference_model;
	player_attachable_reference_model.updateArmVariant = player_preview_model.updateArmVariant;
	player_attachable_reference_model.updateArmVariant();

	let camera_preset_1st = {
		name: tl('action.bedrock_animation_mode.attachable_first'),
		id: 'attachable_first',
		condition: () => Format.id == 'bedrock' && Project.bedrock_animation_mode == 'attachable_first',
		position: [0, 19, -40],
		projection: "perspective",
		target: [0, 16, 0],
		focal_length: 18,
	};
	DefaultCameraPresets.push(camera_preset_1st);

	let center_first_person_button = Interface.createElement('button', {id: 'center_first_person_button'}, tl('preview.center_camera'));
	center_first_person_button.addEventListener('click', event => {
		Preview.selected.loadAnglePreset(camera_preset_1st);
	});

	let player_skin_setup = false;
	function updateBase(mode) {
		let root_has_binding = Outliner.root.find(g => g instanceof Group && g.bedrock_binding)
		if (mode == 'attachable_first') {
			if (root_has_binding) {
				Project.model_3d.position.set(-20, 21, 0);
			} else {
				Project.model_3d.position.set(-8, 6, -18);
			}
			Project.model_3d.rotation.set(
				Math.degToRad(-95),
				Math.degToRad(45),
				Math.degToRad(115),
				'ZYX'
			);
			Interface.preview.append(center_first_person_button);
		} else {
			center_first_person_button.remove();
		}

		if (mode == 'attachable_third') {
			let angle = Math.degToRad(15);
			if (root_has_binding) {
				let arm_offset = Reusable.vec1.set(1, -31, 1).applyAxisAngle(Reusable.vec2.set(1, 0, 0), angle);
				Project.model_3d.position.set(5, 22, 0).add(arm_offset);
			} else {
				let arm_offset = Reusable.vec1.set(1, -7, 1).applyAxisAngle(Reusable.vec2.set(1, 0, 0), angle);
				Project.model_3d.position.set(5, 22, 0).add(arm_offset);
			}
			Project.model_3d.rotation.set(angle, 0, 0);
			player_attachable_reference_model.enable()

			if (!player_skin_setup) {
				updateDisplaySkin();
				player_skin_setup = true;
			}
		} else {
			player_attachable_reference_model.disable()
		}
	
		if (mode != 'attachable_first' && mode != 'attachable_third' && Format.id == 'bedrock') {
			Project.model_3d.position.set(0, 0, 0);
			Project.model_3d.rotation.set(0, 0, 0);
		}
	}
	let bedrock_animation_mode_select = new BarSelect('bedrock_animation_mode', {
		condition: {
			modes: ['animate'],
			formats: ['bedrock'],
		},
		category: 'animation',
		value: 'entity',
		options: {
			entity: true,
			attachable_first: true,
			attachable_third: true
		},
		onChange() {
			if (Project.bedrock_animation_mode == this.value) return;
			Project.bedrock_animation_mode = this.value;

			updateBase(this.value);

			if (this.value == 'attachable_first') {
				Preview.selected.loadAnglePreset(camera_preset_1st);
			} else {
				Preview.selected.loadAnglePreset(DefaultCameraPresets[0]);
			}
		}
	})
	/*
	todo
	Attach model based on binding return values
	*/

	Blockbench.on('select_project', ({project}) => {
		bedrock_animation_mode_select.set(project.bedrock_animation_mode || 'entity');
	})
	Blockbench.on('select_mode', ({mode}) => {
		if (Modes.animate && Project.bedrock_animation_mode) {
			updateBase(Project.bedrock_animation_mode);
		} else {
			updateBase();
		}
	})
})

})()
