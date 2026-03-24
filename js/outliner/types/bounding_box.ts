import { settings, Settings } from "../../interface/settings";
import { markerColors } from "../../marker_colors";
import { flipNameOnAxis } from "../../modeling/transform";
import { fastWorldPosition } from "../../util/three_custom";
import { lineIntersectsReactangle } from "../../util/util";
import { OutlinerElement } from "../abstract/outliner_element";
import { Vue } from './../../lib/libs';

type AxisNumber = 0|1|2;
export type BoundingBoxFunction = 'collision' | 'hitbox';
export interface BoundingBoxOptions {
	name?: string
	from?: ArrayVector3
	to?: ArrayVector3
	size?: ArrayVector3
	visibility?: boolean
	color?: number
	function?: BoundingBoxFunction[]
}

export class BoundingBox extends OutlinerElement {
	public title = tl('data.bounding_box');
	public type = 'bounding_box';
	public icon = 'activity_zone';
	public menu = new Menu([
		...Outliner.control_menu_group,
		new MenuSeparator('export'),
		'generate_bedrock_block_box',
		'generate_bedrock_entity_box',
		new MenuSeparator('settings'),
		{name: 'menu.cube.color', icon: 'color_lens', children() {
			return markerColors.map((color, i) => {return {
				icon: 'bubble_chart',
				color: color.standard,
				name: color.name || 'cube.color.'+color.id,
				click(element: BoundingBox) {
					element.forSelected((obj: BoundingBox) => {
						obj.setColor(i);
					}, 'Change color');
				}
			}});
		}},
		"randomize_marker_colors",
		new MenuSeparator('manage'),
		'rename',
		'toggle_visibility',
		'delete'
	]);
	public buttons = [
		Outliner.buttons.export,
		Outliner.buttons.locked,
		Outliner.buttons.visibility,
	];

	visibility: boolean
	color: number
	function: BoundingBoxFunction[]


	constructor(data?: BoundingBoxOptions, uuid?: string) {
		super(data, uuid)
		let size = Settings.get('default_cube_size');
		this.color = Math.floor(Math.random()*markerColors.length)
		this.visibility = true;

		for (let key in BoundingBox.properties) {
			BoundingBox.properties[key].reset(this);
		}
		Object.assign(this._static.properties, {
			from: [0, 0, 0],
			to: [size, size, size],
		});

		if (data) {
			this.extend(data)
		}
	}
	get from(): ArrayVector3 {return this._static.properties.from};
	get to(): ArrayVector3 {return this._static.properties.to};
	set from(v: ArrayVector3) {this._static.properties.from = v};
	set to(v: ArrayVector3) {this._static.properties.to = v};
	get position(): ArrayVector3 {
		return [0, 0, 0];
	}
	get origin(): ArrayVector3 {
		return [0, 0, 0];
	}
	extend(object: BoundingBoxOptions) {
		for (let key in BoundingBox.properties) {
			BoundingBox.properties[key].merge(this, object)
		}

		this.sanitizeName();
		Merge.number(this, object, 'color')
		Merge.boolean(this, object, 'export')
		Merge.boolean(this, object, 'visibility')
		if (object.from) {
			Merge.number(this.from, object.from, 0)
			Merge.number(this.from, object.from, 1)
			Merge.number(this.from, object.from, 2)
		}
		if (object.to) {
			Merge.number(this.to, object.to, 0)
			Merge.number(this.to, object.to, 1)
			Merge.number(this.to, object.to, 2)
		}
		if (object.size) {
			if (typeof object.size[0] == 'number' && !isNaN(object.size[0])) this.to[0] = this.from[0] + object.size[0]
			if (typeof object.size[1] == 'number' && !isNaN(object.size[1])) this.to[1] = this.from[1] + object.size[1]
			if (typeof object.size[2] == 'number' && !isNaN(object.size[2])) this.to[2] = this.from[2] + object.size[2]
		}
		return this;
	}
	size(): ArrayVector3
	size(axis: AxisNumber, floored?: boolean): number
	size(axis?: AxisNumber, floored: boolean = false) {
		let scope = this;
		let epsilon = 0.0000001;
		function getA(axis: AxisNumber) {
			if (floored == true) {
				return Math.floor(scope.to[axis] - scope.from[axis] + epsilon);

			} else {
				return scope.to[axis] - scope.from[axis]
			}
		}
		if (axis !== undefined) {
			return getA(axis);
		} else {
			return [
				getA(0),
				getA(1),
				getA(2)
			]
		}
	}
	getSize(axis, selection_only) {
		return this.size(axis);
	}
	getMesh() {
		return this.mesh;
	}
	getUndoCopy(aspects = 0) {
		let copy: any = {};

		for (let key in BoundingBox.properties) {
			BoundingBox.properties[key].copy(this, copy);
		}

		copy.from = this.from.slice();
		copy.to = this.to.slice();
		copy.color = this.color;
		copy.visibility = this.visibility;
		copy.export = this.export;

		copy.uuid = this.uuid
		copy.type = this.type;
		return copy;
	}
	getSaveCopy() {
		let el: any = {};
		
		for (let key in BoundingBox.properties) {
			BoundingBox.properties[key].copy(this, el)
		}

		el.from = this.from;
		el.to = this.to;
		el.color = this.color;

		if (!this.visibility) el.visibility = false;
		if (!this.export) el.export = false;
		el.type = this.type;
		el.uuid = this.uuid;
		return el;
	}
	roll(axis: AxisNumber, steps: number, origin: ArrayVector3 = [8, 8, 8]) {
		function rotateCoord(array: ArrayVector3) {
			let a, b;
			array.forEach(function(s, i) {
				if (i == axis) {
					//
				} else {
					if (a == undefined) {
						a = s - origin[i]
						b = i
					} else {
						array[b] = s - origin[i]
						array[b] = origin[b] - array[b]
						array[i] = origin[i] + a;
					}
				}
			})
			return array
		}

		while (steps > 0) {
			steps--;
			//Swap coordinate thingy
			switch(axis) {
				case 0: [this.from[2], this.to[2]] = [this.to[2], this.from[2]]; break;
				case 1: [this.from[2], this.to[2]] = [this.to[2], this.from[2]]; break;
				case 2: [this.from[1], this.to[1]] = [this.to[1], this.from[1]]; break;
			}
			this.from.V3_set(rotateCoord(this.from))
			this.to.V3_set(rotateCoord(this.to))
		}
		this.preview_controller.updateTransform(this);
		this.preview_controller.updateGeometry(this);
		return this;
	}
	flip(axis: AxisNumber, center: number) {
		let scope = this;

		let from = this.from[axis]
		this.from[axis] = center - (this.to[axis] - center)
		this.to[axis] = center - (from - center)
		this.origin[axis] = center - (this.origin[axis] - center)
		
		flipNameOnAxis(this, axis);

		this.preview_controller.updateTransform(this);
		this.preview_controller.updateGeometry(this);
	}
	getWorldCenter() {
		let m = this.mesh;
		let pos = new THREE.Vector3(
			this.from[0] + this.size(0)/2,
			this.from[1] + this.size(1)/2,
			this.from[2] + this.size(2)/2
		)
		pos.x = (pos.x - this.origin[0]) * m.scale.x;
		pos.y = (pos.y - this.origin[1]) * m.scale.y;
		pos.z = (pos.z - this.origin[2]) * m.scale.z;

		if (m) {
			let r = m.getWorldQuaternion(Reusable.quat1)
			pos.applyQuaternion(r)
			pos.add(fastWorldPosition(m, Reusable.vec2))
		}
		return pos;
	}
	getGlobalVertexPositions() {
		let vertices = [
			[this.to[0]	 ,  this.to[1]  ,  this.to[2]	],
			[this.to[0]  ,  this.to[1]  ,  this.from[2]],
			[this.to[0]  ,  this.from[1],  this.to[2]	],
			[this.to[0]  ,  this.from[1],  this.from[2]],
			[this.from[0],  this.to[1]  ,  this.from[2]],
			[this.from[0],  this.to[1]  ,  this.to[2]	],
			[this.from[0],  this.from[1],  this.from[2]],
			[this.from[0],  this.from[1],  this.to[2]	],
		];
		return vertices;
	}
	setColor(index: number) {
		this.color = index;
		if (this.visibility) {
			this.preview_controller.updateGeometry(this);
		}
		return this;
	}
	moveVector(arr, axis, update = true) {
		if (typeof arr == 'number') {
			let n = arr;
			arr = [0, 0, 0];
			arr[axis||0] = n;
		} else if (arr instanceof THREE.Vector3) {
			arr = arr.toArray();
		}
		let scope = this;
		let in_box = true;
		arr.forEach((val, i) => {

			let size = scope.size(i);
			val += scope.from[i];

			let val_before = val;
			if (Math.abs(val_before - val) >= 1e-4) in_box = false;
			val -= scope.from[i]

			scope.from[i] += val;
			scope.to[i] += val;
		})
		if (update) {
			this.preview_controller.updateTransform(this);
			this.preview_controller.updateGeometry(this);
		}
		TickUpdates.selection = true;
		return in_box;
	}
	resize(val: number | ((offset: number) => number), axis: AxisNumber, negative?: boolean, allow_negative?: boolean, bidirectional?: boolean) {
		let before = this.temp_data.old_size != undefined ? this.temp_data.old_size : this.size(axis);
		if (before instanceof Array) before = before[axis];
		let is_inverted = before < 0;
		if (is_inverted && allow_negative == null) negative = !negative;
		let modify = val instanceof Function ? val : n => (n + val);

		if (bidirectional) {

			let center = this.temp_data.oldCenter[axis] || 0;
			let difference = modify(before) - before;
			if (negative) difference *= -1;

			let from = center - (before/2) - difference;
			let to = center + (before/2) + difference;

			if (Format.integer_size) {
				from = Math.round(from-this.from[axis])+this.from[axis];
				to = Math.round(to-this.to[axis])+this.to[axis];
			}
			this.from[axis] = from;
			this.to[axis] = to;
			if (from > to && !(settings.negative_size.value || allow_negative)) {
				this.from[axis] = this.to[axis] = (from + to) / 2;
			}

		} else if (!negative) {
			let pos = this.from[axis] + modify(before);
			if (Format.integer_size) {
				pos = Math.round(pos-this.from[axis])+this.from[axis];
			}
			if (pos >= this.from[axis] || settings.negative_size.value || allow_negative) {
				this.to[axis] = pos;
			} else {
				this.to[axis] = this.from[axis];
			}
		} else {
			let pos = this.to[axis] + modify(-before);
			if (Format.integer_size) {
				pos = Math.round(pos-this.to[axis])+this.to[axis];
			}
			if (pos <= this.to[axis] || settings.negative_size.value || allow_negative) {
				this.from[axis] = pos;
			} else {
				this.from[axis] = this.to[axis];
			}
		}
		this.preview_controller.updateGeometry(this);
		TickUpdates.selection = true;
		return this;
	}

	static behavior = {
		movable: true,
		resizable: true,
		unique_name: false
	}
}

new Property(BoundingBox, 'string', 'name', {default: 'bounding_box'});
new Property(BoundingBox, 'boolean', 'locked');
new Property(BoundingBox, 'array', 'function', {
	inputs: {
		element_panel: {
			input: {type: 'multi_select', label: 'Function', options: {
				collision: 'Collision',
				hitbox: 'Hitbox',
			}}
		}
	}
});

OutlinerElement.registerType(BoundingBox, 'bounding_box');

type MaterialSet = {default: THREE.LineBasicMaterial, selected: THREE.LineBasicMaterial};
const materials: Record<number, MaterialSet> = {};
function getBoundingBoxMaterial(bounding_box: BoundingBox): MaterialSet {
	if (!materials[bounding_box.color]) {
		let marker_color = markerColors[bounding_box.color % markerColors.length];
		materials[bounding_box.color] = {
			default: new THREE.LineBasicMaterial({color: new THREE.Color().set(marker_color.standard)}),
			selected: new THREE.LineBasicMaterial({color: new THREE.Color().set(marker_color.pastel)}),
		};
	}
	return materials[bounding_box.color];
}

new NodePreviewController(BoundingBox, {
	setup(element: BoundingBox) {
		let mesh = new THREE.LineSegments(
			new THREE.BufferGeometry(),
			getBoundingBoxMaterial(element).default
		)
		Project.nodes_3d[element.uuid] = mesh;
		mesh.name = element.uuid;
		// @ts-ignore
		mesh.type = 'bounding_box';
		// @ts-ignore
		mesh.isElement = true;
		// @ts-ignore
		mesh.no_export = true;
		mesh.visible = element.visibility;
		mesh.renderOrder = 100;

		// Update
		this.updateTransform(element);
		this.updateGeometry(element);

		this.dispatchEvent('setup', {element});
	},
	updateTransform(element: BoundingBox) {
		let mesh = element.mesh;

		if (element.getTypeBehavior('movable')) {
			mesh.position.set(element.origin[0], element.origin[1], element.origin[2])
		}
		if (mesh.parent !== Project.model_3d) {
			Project.model_3d.add(mesh)
		}
		mesh.updateMatrixWorld();

		this.dispatchEvent('update_transform', {element});
	},
	updateGeometry(element: BoundingBox) {
		let mesh = element.mesh as THREE.LineSegments;
		let from = element.from.slice()
		let to = element.to.slice()

		from.forEach((v, i) => {
			from[i] -= element.origin[i];
		})
		to.forEach((v, i) => {
			to[i] -= element.origin[i];
			if (from[i] === to[i]) {
				to[i] += 0.001
			}
		})
		let vs = element.getGlobalVertexPositions();
		let points = [
			vs[0], vs[1],
			vs[1], vs[3],
			vs[2], vs[3],
			vs[2], vs[0],

			vs[4], vs[5],
			vs[5], vs[7],
			vs[6], vs[7],
			vs[6], vs[4],

			vs[0], vs[5],
			vs[1], vs[4],
			vs[2], vs[7],
			vs[3], vs[6],
		].map(a => new THREE.Vector3().fromArray(a))
		mesh.geometry.setFromPoints(points);

		mesh.geometry.computeBoundingBox()
		mesh.geometry.computeBoundingSphere()

		this.dispatchEvent('update_geometry', {element});
	},
	updateSelection(element: BoundingBox) {
		let mesh = element.mesh as THREE.LineSegments;
		if (mesh) {
			if (Modes.paint || Modes.display) {
				mesh.visible = false;
			} else {
				mesh.visible = element.visibility;
				let materials = getBoundingBoxMaterial(element);
				mesh.material = element.selected ? materials.selected : materials.default;
			}
		}

		this.dispatchEvent('update_selection', {element});
	},
	updateVisibility(element: BoundingBox) {
		element.mesh.visible = (Modes.paint || Modes.display) ? false : element.visibility;

		this.dispatchEvent('update_visibility', {element});
	},
	viewportRectangleOverlap(element, {projectPoint, rect_start, rect_end, preview}) {
		if ((BarItems.selection_mode as BarSelect).value != 'object' && Format.meshes && preview.selection.old_selected.find(el => el instanceof Mesh)) return;

		let vector = Reusable.vec2;
		var adjustedFrom = element.from;
		var adjustedTo = element.to;

		let vertices = [
			[adjustedFrom[0] , adjustedFrom[1] , adjustedFrom[2] ],
			[adjustedFrom[0] , adjustedFrom[1] , adjustedTo[2]   ],
			[adjustedFrom[0] , adjustedTo[1]   , adjustedTo[2]   ],
			[adjustedFrom[0] , adjustedTo[1]   , adjustedFrom[2] ],
			[adjustedTo[0]   , adjustedFrom[1] , adjustedFrom[2] ],
			[adjustedTo[0]   , adjustedFrom[1] , adjustedTo[2]   ],
			[adjustedTo[0]   , adjustedTo[1]   , adjustedTo[2]   ],
			[adjustedTo[0]   , adjustedTo[1]   , adjustedFrom[2] ],
		].map(coords => {
			//coords.V3_subtract(element.origin);
			vector.fromArray(coords);
			//mesh.localToWorld(vector);
			return projectPoint(vector);
		})
		let is_on_screen = vertices.find(vertex => {
			return (vertex[0] >= 0 && vertex[0] <= preview.width
					&& vertex[1] >= 0 && vertex[1] <= preview.height);
		})
		return is_on_screen && (
				lineIntersectsReactangle(vertices[0], vertices[1], rect_start, rect_end)
			|| lineIntersectsReactangle(vertices[1], vertices[2], rect_start, rect_end)
			|| lineIntersectsReactangle(vertices[2], vertices[3], rect_start, rect_end)
			|| lineIntersectsReactangle(vertices[3], vertices[0], rect_start, rect_end)

			|| lineIntersectsReactangle(vertices[4], vertices[5], rect_start, rect_end)
			|| lineIntersectsReactangle(vertices[5], vertices[6], rect_start, rect_end)
			|| lineIntersectsReactangle(vertices[6], vertices[7], rect_start, rect_end)
			|| lineIntersectsReactangle(vertices[7], vertices[4], rect_start, rect_end)

			|| lineIntersectsReactangle(vertices[0], vertices[4], rect_start, rect_end)
			|| lineIntersectsReactangle(vertices[1], vertices[5], rect_start, rect_end)
			|| lineIntersectsReactangle(vertices[2], vertices[6], rect_start, rect_end)
			|| lineIntersectsReactangle(vertices[3], vertices[7], rect_start, rect_end)
		);
	}
})

BARS.defineActions(function() {
	new Action('add_bounding_box', {
		icon: 'activity_zone',
		category: 'edit',
		condition: {modes: ['edit'], features: ['bounding_boxes']},
		click: function () {
			
			Undo.initEdit({outliner: true, elements: [], selection: true});
			let base_bounding_box = new BoundingBox().init()
			let group = getCurrentGroup();
			if (group) {
				base_bounding_box.addTo(group)
				if (settings.inherit_parent_color.value) base_bounding_box.color = group.color;
			}

			if (Format.bone_rig) {
				let pos1 = group ? group.origin.slice() : [0, 0, 0];
				let size = Settings.get('default_cube_size') as number;
				if (size % 2 == 0) {
					base_bounding_box.extend({
						from:[ pos1[0] - size/2, pos1[1] - 0,    pos1[2] - size/2 ],
						to:[   pos1[0] + size/2, pos1[1] + size, pos1[2] + size/2 ],
					})
				} else {
					base_bounding_box.extend({
						from:[ pos1[0], pos1[1], pos1[2] ],
						to:[   pos1[0]+size, pos1[1]+size, pos1[2]+size ],
					})
				}
			}

			unselectAllElements()
			base_bounding_box.select()
			Canvas.updateView({elements: [base_bounding_box], element_aspects: {transform: true, geometry: true}})
			Undo.finishEdit('Add bounding box', {outliner: true, elements: Outliner.selected, selection: true});
			Blockbench.dispatchEvent( 'add_bounding_box', {object: base_bounding_box} )

			Vue.nextTick(function() {
				if (settings.create_rename.value) {
					base_bounding_box.rename()
				}
			})
			return base_bounding_box
		}
	})
})

const global = {
	BoundingBox
}
declare global {
	type BoundingBox = import('./bounding_box').BoundingBox
	const BoundingBox: typeof global.BoundingBox
}
Object.assign(window, global);
