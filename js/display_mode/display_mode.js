import DisplayModePanel from "./DisplayModePanel.vue";
import { THREE } from "../lib/libs";
import { Mode } from "../modes";
import DisplayReferences from "./display_references";
import VertShader from './../shaders/texture.vert.glsl';
import FragShader from './../shaders/texture.frag.glsl';
import { prepareShader } from "../shaders/shader";

var ground_timer = 0
var display_presets;
var display_preview;

export const DisplayMode = {
	display_slot: 'thirdperson_righthand'
};


export class DisplaySlot {
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
			mirror: this.mirror.slice(),
			fit_to_frame: this.fit_to_frame
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
			if (Format.id == 'bedrock_block') {
				build.scale = build.scale.map(Math.abs);
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
			this.scale[i] = Math.abs(this.scale[i]);
			this.rotation[i] = Math.trimDeg(this.rotation[i]);
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
			on_shelf: {
				rotation: [ 0, 180, 0 ],
				translation: [ 0, 0, 0 ],
				scale: [ 1, 1, 1 ]
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



export class refModel {
	constructor(id, options = 0) {
		var scope = this;
		this.model = new THREE.Object3D();
		this.name = tl('display.reference.'+id);
		this.id = id;
		this.icon = options.icon || id;
		this.models = options.models || [];
		this.condition = options.condition;
		this.initialized = false;
		this.pose_angles = {};

		switch (id) {
			case 'player':
				this.pose_angles.thirdperson_righthand = 22.5;
				this.pose_angles.thirdperson_lefthand = 22.5;
				this.pose_angles.head = 0;

				this.updateBasePosition = function() {
					let display_slot = DisplayMode.display_slot;
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
					let display_slot = DisplayMode.display_slot;
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
					let display_slot = DisplayMode.display_slot;
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
					let display_slot = DisplayMode.display_slot;
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
					let display_slot = DisplayMode.display_slot;
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
					var side = DisplayMode.display_slot.includes('left') ? -1 : 1;
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
			case 'shelf_left':
				this.updateBasePosition = function() {
					let yPos = 7.75 + (Project.shelf_align_bottom ? -1.75 : 0);
					setDisplayArea(13, yPos, 12, 0, 180, 0, 0.25, 0.25, 0.25)
				}
				break;
			case 'shelf':
				this.updateBasePosition = function() {
					let yPos = 7.75 + (Project.shelf_align_bottom ? -1.75 : 0);
					setDisplayArea(8, yPos, 12, 0, 180, 0, 0.25, 0.25, 0.25)

					if (!this.shelf_displays) {
						this.shelf_displays = [];
						this.shelf_groups = [];

						[-20, 20].forEach((xOffset, index) => {
							let slotGroup = new THREE.Object3D();
							slotGroup.name = `shelf_display_base_${index}`;
							display_area.add(slotGroup);
							this.shelf_groups.push(slotGroup);
							this.shelf_displays.push(slotGroup);
						});
					}

					if (this.shelf_displays && this.shelf_displays.length === 2) {
						this.shelf_displays.forEach((slotGroup, index) => {
							let slotOffset = new THREE.Vector3(index === 0 ? -20 : 20, 0, 0);

							if (slotGroup.children.length !== display_base.children.length) {
								slotGroup.children.forEach(child => slotGroup.remove(child));
								display_base.children.forEach(child => {
									let clonedChild = child.clone();
									slotGroup.add(clonedChild);
								});
							}

							let finalPosition = display_base.position.clone().add(slotOffset);
							let matrix = new THREE.Matrix4();

							let scaleMatrix = new THREE.Matrix4().makeScale(
								display_base.scale.x, 
								display_base.scale.y, 
								display_base.scale.z
							);

							let rotationMatrix = new THREE.Matrix4().makeRotationFromEuler(display_base.rotation);

							let translationMatrix = new THREE.Matrix4().makeTranslation(
								finalPosition.x, 
								finalPosition.y, 
								finalPosition.z
							);

							matrix.multiplyMatrices(translationMatrix, rotationMatrix);
							matrix.multiply(scaleMatrix);

							slotGroup.matrix.copy(matrix);
							slotGroup.matrixAutoUpdate = false;
							slotGroup.matrixWorldNeedsUpdate = true;
						});
					}
				}
				break;
			case 'shelf_center':
				this.updateBasePosition = function() {
					let yPos = 7.75 + (Project.shelf_align_bottom ? -1.75 : 0);
					setDisplayArea(8, yPos, 12, 0, 180, 0, 0.25, 0.25, 0.25)
				}
				break;
			case 'shelf_right':
				this.updateBasePosition = function() {
					let yPos = 7.75 + (Project.shelf_align_bottom ? -1.75 : 0);
					setDisplayArea(3, yPos, 12, 0, 180, 0, 0.25, 0.25, 0.25)
				}
				break;
			case 'bow':
				this.updateBasePosition = function() {
					var side = DisplayMode.display_slot.includes('left') ? -1 : 1;
					setDisplayArea(side*4.2, -4.9+24, 25, -20, -19, -8, 1,1,1)
				}
				break;
			case 'crossbow':
				this.updateBasePosition = function() {
					var side = DisplayMode.display_slot.includes('left') ? -1 : 1;
					setDisplayArea(side*-1.2, -6.75+24, 23, 0, side*10, 0, 1, 1, 1)
				}
				break;
				
			case 'eating':
				this.updateBasePosition = function() {
					var side = DisplayMode.display_slot.includes('left') ? -1 : 1;
					DisplayMode.setBase(
						side*-1.7, -6.1+24, 23.4,
						-92, side*100, side*119,
						0.8, 0.8, 0.8)
				}
				break;
			case 'tooting':
				this.updateBasePosition = function() {
					var side = DisplayMode.display_slot.includes('left') ? -1 : 1;
					//setDisplayArea(side*-0.6, 19.8, 23.8, 31.5, side*22, -11, 1, 1, 1)
					setDisplayArea(side == 1 ? -2.7 : 2.1, 20.1, Format.id.includes('bedrock') ? 24.5 : 25.6, 36, side*21.5, side*-12, 1, 1, 1)
				}
				break;
		}
	}
	buildModel(options) {
		let {elements, texture, texture_size} = options;
		if (!texture_size) texture_size = [16, 16];
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
			var mat = new THREE.ShaderMaterial({
				uniforms: {
					map: {type: 't', value: tex},
					SHADE: {type: 'bool', value: settings.shading.value},
					LIGHTCOLOR: {type: 'vec3', value: new THREE.Color().copy(Canvas.global_light_color).multiplyScalar(settings.brightness.value / 50)},
					LIGHTSIDE: {type: 'int', value: Canvas.global_light_side},
					EMISSIVE: {type: 'bool', value: false}
				},
				vertexShader: prepareShader(VertShader),
				fragmentShader: prepareShader(FragShader),
				side: THREE.DoubleSide,
				transparent: true
			});
			mat.map = tex;
		}

		scope.material = mat

		elements.forEach(function(s) {
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
					[face.uv[0]/texture_size[0], 1-(face.uv[1]/texture_size[1])],
					[face.uv[2]/texture_size[0], 1-(face.uv[1]/texture_size[1])],
					[face.uv[0]/texture_size[0], 1-(face.uv[3]/texture_size[1])],
					[face.uv[2]/texture_size[0], 1-(face.uv[3]/texture_size[1])]
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
		displayReferenceObjects.ref_indexes[DisplayMode.display_slot] = index || 0;
		displayReferenceObjects.clear()
		if (typeof this.updateBasePosition === 'function') {
			this.updateBasePosition()
		}
		//3D
		if (!this.initialized) {
			for (let model of this.models) {
				this.buildModel(model);
			}
			if (this.id == 'player') {
				this.setModelVariant('steve')
				updateDisplaySkin()
			}
			this.initialized = true;
		}
		scene.add(this.model)
		displayReferenceObjects.active = this;

		DisplayMode.vue.pose_angle = this.pose_angles[DisplayMode.display_slot] || 0;
		DisplayMode.vue.reference_model = this.id;

		if (DisplayMode.display_slot == 'ground') {
			Canvas.ground_animation = this.id != 'fox';
		}
		
		ReferenceImage.updateAll()
	}
}
export const displayReferenceObjects = {
	refmodels: {
		player: new refModel('player', {
			icon: 'icon-player',
			models: [DisplayReferences.display_player]
		}),
		zombie: new refModel('zombie', {
			icon: 'icon-zombie',
			models: [DisplayReferences.zombie]
		}),
		armor_stand: new refModel('armor_stand', {
			icon: 'icon-armor_stand',
			models: [DisplayReferences.armor_stand]
		}),
		baby_zombie: new refModel('baby_zombie', {
			icon: 'icon-baby_zombie',
			models: [DisplayReferences.baby_zombie]
		}),
		armor_stand_small: new refModel('armor_stand_small', {
			icon: 'icon-armor_stand_small',
			models: [DisplayReferences.armor_stand_small]
		}),
		fox: new refModel('fox', {
			icon: 'pets',
			condition: {formats: ['java_block']},
			models: [DisplayReferences.fox]
		}),
		monitor: new refModel('monitor', {
			icon: 'fa-asterisk',
			models: [DisplayReferences.monitor]
		}),
		bow: new refModel('bow', {
			icon: 'icon-bow',
			models: [DisplayReferences.monitor]
		}),
		crossbow: new refModel('crossbow', {
			icon: 'icon-crossbow',
			models: [DisplayReferences.monitor]
		}),
		eating: new refModel('eating', {
			icon: 'fa-apple-whole',
			models: [DisplayReferences.monitor]
		}),
		tooting: new refModel('tooting', {
			icon: 'fa-bullhorn',
			models: [DisplayReferences.monitor]
		}),
		block: new refModel('block', {
			icon: 'fa-cube',
			models: [DisplayReferences.block]
		}),
		frame: new refModel('frame', {
			icon: 'filter_frames',
			models: [DisplayReferences.frame_block, DisplayReferences.frame]
		}),
		frame_invisible: new refModel('frame_invisible', {
			icon: 'visibility_off',
			models: [DisplayReferences.frame_block]
		}),
		frame_top: new refModel('frame_top', {
			icon: 'filter_frames',
			models: [DisplayReferences.frame_top_block, DisplayReferences.frame_top]
		}),
		frame_top_invisible: new refModel('frame_top_invisible', {
			icon: 'visibility_off',
			models: [DisplayReferences.frame_top_block]
		}),
		shelf: new refModel('shelf', {
			icon: 'table_view',
			models: [DisplayReferences.shelf]
		}),
		shelf_left: new refModel('shelf_left', {
			icon: 'keyboard_arrow_left',
			models: [DisplayReferences.shelf]
		}),
		shelf_center: new refModel('shelf_center', {
			icon: 'remove',
			models: [DisplayReferences.shelf]
		}),
		shelf_right: new refModel('shelf_right', {
			icon: 'keyboard_arrow_right',
			models: [DisplayReferences.shelf]
		}),
		inventory_nine: new refModel('inventory_nine', {
			icon: 'icon-inventory_nine',
			models: []
		}),
		inventory_full: new refModel('inventory_full', {
			icon: 'icon-inventory_full',
			models: []
		}),
		hud: new refModel('hud', {
			icon: 'icon-hud',
			models: []
		})
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
			if (i === displayReferenceObjects.ref_indexes[DisplayMode.display_slot]) {
				ref.load(i)
				button.find('input').prop("checked", true)
			}
			i++;
		}
	},
	clear: function() {
		if (displayReferenceObjects.active && displayReferenceObjects.active.shelf_displays) {
			displayReferenceObjects.active.shelf_displays.forEach(display => {
				display_area.remove(display);
			});
			displayReferenceObjects.active.shelf_displays = null;
			if (displayReferenceObjects.active.shelf_groups) {
				displayReferenceObjects.active.shelf_groups = null;
			}
		}
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
		on_shelf: 0,
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
		'on_shelf',
	]
}
DisplayMode.slots = displayReferenceObjects.slots

export const display_angle_preset = {
	projection: 'perspective',
	position: [-80, 40, -30],
	target: [0, 8, 0],
	default: true
}

export function enterDisplaySettings() {		//Enterung Display Setting Mode, changes the scene etc
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
	DisplayMode.load(DisplayMode.display_slot)

	display_area.updateMatrixWorld()
	Transformer.center()
	if (Canvas.outlines.children.length) {
		Canvas.outlines.children.empty();
	}
}
export function exitDisplaySettings() {		//Enterung Display Setting Mode, changes the scene etc
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
export function resetDisplayBase() {
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
	if (!slot) slot = Project.display_settings[DisplayMode.display_slot]

	display_base.rotation.x = Math.PI / (180 / slot.rotation[0]);
	display_base.rotation.y = Math.PI / (180 / slot.rotation[1]) * (DisplayMode.display_slot.includes('lefthand') ? -1 : 1);
	display_base.rotation.z = Math.PI / (180 / slot.rotation[2]) * (DisplayMode.display_slot.includes('lefthand') ? -1 : 1);

	display_base.position.x = slot.translation[0] * (DisplayMode.display_slot.includes('lefthand') ? -1 : 1);
	if (DisplayMode.display_slot === 'on_shelf' && !Project.shelf_align_bottom) {
		display_base.position.y = 0;
	} else {
		display_base.position.y = slot.translation[1];
	}
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

	if (displayReferenceObjects.active && displayReferenceObjects.active.id === 'shelf' && displayReferenceObjects.active.shelf_displays) {

		displayReferenceObjects.active.shelf_displays.forEach((slotGroup, index) => {
			let slotOffset = new THREE.Vector3(index === 0 ? -20 : 20, 0, 0);
			let finalPosition = display_base.position.clone().add(slotOffset);
			let matrix = new THREE.Matrix4();
			let scaleMatrix = new THREE.Matrix4().makeScale(
				display_base.scale.x, 
				display_base.scale.y, 
				display_base.scale.z
			);
			let rotationMatrix = new THREE.Matrix4().makeRotationFromEuler(display_base.rotation);
			let translationMatrix = new THREE.Matrix4().makeTranslation(
				finalPosition.x, 
				finalPosition.y, 
				finalPosition.z
			);

			matrix.multiplyMatrices(translationMatrix, rotationMatrix);
			matrix.multiply(scaleMatrix);

			slotGroup.matrix.copy(matrix);
			slotGroup.matrixAutoUpdate = false;
			slotGroup.matrixWorldNeedsUpdate = true;
		});
	}

	Transformer.center()
}


DisplayMode.applyPreset = function(preset, all) {
	if (preset == undefined) return;
	var slots = [DisplayMode.display_slot];
	if (all) {
		slots = displayReferenceObjects.slots
	} else if (preset.areas[DisplayMode.display_slot] == undefined) {
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
	} else if (DisplayMode.display_slot == 'gui' && Project.front_gui_light == true) {
		lights.rotation.set(-Math.PI, 0.6, 0);
		Canvas.global_light_side = 4;
	} else {
		lights.rotation.set(0, 0, 0);
		Canvas.global_light_side = 0;
	}
	Canvas.updateShading();
} 

export function loadDisp(key) {	//Loads The Menu and slider values, common for all Radio Buttons
	DisplayMode.display_slot = key

	if (key !== 'gui' && display_preview.isOrtho === true) {
		display_preview.loadAnglePreset(display_angle_preset)
	}
	display_preview.controls.enabled = true;
	Canvas.ground_animation = false;
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
	updateGUISlotCrop();
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
export function getOptimalFocalLength() {
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
	Canvas.ground_animation = true;
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
DisplayMode.loadShelf = function() {		//Loader
	loadDisp('on_shelf')
	display_preview.loadAnglePreset({
		position: [-30, 25, -30],
		target: [0, 8, 0]
	})
	displayReferenceObjects.bar(['shelf', 'shelf_left', 'shelf_center', 'shelf_right'])
	BarItems.shelf_alignment.set(Project.shelf_align_bottom ? 'bottom' : 'top');
}
DisplayMode.updateShelfAlignment = function() {
	if (!Modes.display || DisplayMode.display_slot !== 'on_shelf') return;

	if (displayReferenceObjects.active && displayReferenceObjects.active.updateBasePosition) {
		displayReferenceObjects.active.updateBasePosition();
	}

	DisplayMode.updateDisplayBase();
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
		case 'on_shelf':
		DisplayMode.loadShelf()
		break;
	}
}

DisplayMode.copy = function() {
	Clipbench.display_slot = DisplayMode.slot.copy()
}
DisplayMode.paste = function() {
	Undo.initEdit({display_slots: [DisplayMode.display_slot]})
	DisplayMode.slot.extend(Clipbench.display_slot)
	DisplayMode.updateDisplayBase()
	Undo.finishEdit('Paste display slot')
}

DisplayMode.scrollSlider = function(type, value, el) {
	Undo.initEdit({display_slots: [DisplayMode.display_slot]})

	var [channel, axis] = type.split('.')
	DisplayMode.slot[channel][parseInt(axis)] = value

	DisplayMode.slot.update()
	Undo.finishEdit('Change display slot')
}

let clip_planes = [
	new THREE.Plane(new THREE.Vector3(1, 0, 0), 3.2001),
	new THREE.Plane(new THREE.Vector3(-1, 0, 0), 3.2001),
	new THREE.Plane(new THREE.Vector3(0, 1, 0), 3.2001),
	new THREE.Plane(new THREE.Vector3(0, -1, 0), 3.2001)
];
function updateGUISlotCrop() {
	if (!display_preview?.canvas) return;
	if (DisplayMode.display_slot == 'gui' && Format.id == 'java_block' && VersionUtil.compare(Project.java_block_version, '>=', '1.21.6')) {
		for (let texture of Texture.all) {
			texture.material.clippingPlanes = clip_planes;
		}
		Preview.selected.renderer.localClippingEnabled = true;
		/*let cam_zoom = display_preview.camOrtho.zoom;
		let cam_pos = [
			display_preview.camOrtho.position.x * 40 * cam_zoom,
			display_preview.camOrtho.position.y * 40 * cam_zoom,
		];
		let size = 256 * cam_zoom;
		let left = display_preview.canvas.width/2 - cam_pos[0] - (size/2);
		let right = display_preview.canvas.width/2 + cam_pos[0] - (size/2);
		let top = display_preview.canvas.height/2 + cam_pos[1] - (size/2);
		let bottom = display_preview.canvas.height/2 - cam_pos[1] - (size/2);

		display_preview.canvas.style.clipPath = `inset(${top}px ${right}px ${bottom}px ${left}px)`;*/
	} else {
		for (let texture of Texture.all) {
			texture.material.clippingPlanes = null;
		}
		Preview.selected.renderer.localClippingEnabled = false;
	}
}
Blockbench.on('update_camera_position', e => {
	if (Modes.display) {
		updateGUISlotCrop();
	}
})

export function changeDisplaySkin() {
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
export function updateDisplaySkin(feedback) {
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
	new Mode('display', {
		icon: 'tune',
		selectElements: false,
		default_tool: 'move_tool',
		category: 'navigate',
		condition: () => Format.display_mode,
		onSelect: () => {
			enterDisplaySettings()
		},
		onUnselect: () => {
			exitDisplaySettings()
		},
	})

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
					on_shelf: {type: 'checkbox', label: 'display.slot.on_shelf', value: true},
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
		condition: () => Modes.display && DisplayMode.display_slot === 'gui' && Format.id == 'java_block',
		onChange: function(slider) {
			Project.front_gui_light = slider.get() == 'front';
			DisplayMode.updateGUILight();
		}
	})
	new BarSelect('shelf_alignment', {
		options: {
			top: true,
			bottom: true,
		},
		condition: () => Modes.display && DisplayMode.display_slot === 'on_shelf' && Format.id == 'java_block',
		onChange: function(slider) {
			Project.shelf_align_bottom = slider.get() == 'bottom';
			DisplayMode.updateShelfAlignment();
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
			height: 400,
			sidebar_index: 0,
		},
		toolbars: [
			new Toolbar({
				id: 'display',
				children: [
					'copy',
					'paste',
					'add_display_preset',
					'apply_display_preset',
					'gui_light',
					'shelf_alignment'
				]
			})
		],
		component: DisplayModePanel
	})
	DisplayMode.vue = Interface.Panels.display.inside_vue;
})


Object.assign(window, {
	DisplayMode,
	DisplaySlot,
	display_angle_preset,
	resetDisplayBase,
	updateDisplaySkin,
	displayReferenceObjects,
	changeDisplaySkin,
});
