import { Blockbench } from "../api"

export const Outliner = {
	ROOT: 'root',
	root: [],
	get elements() {
		return Project.elements || []
	},
	set elements(val) {
		console.warn('You cannot modify this')
	},
	get selected() {
		return Project.selected_elements || []
	},
	set selected(val) {
		console.warn('You cannot modify this')
	},
	buttons: {
		visibility: {
			id: 'visibility',
			title: tl('switches.visibility'),
			icon: 'visibility',
			icon_off: 'visibility_off',
			advanced_option: false
		},
		locked: {
			id: 'locked',
			title: tl('switches.lock'),
			icon: 'fa-lock',
			icon_off: 'fa-lock-open',
			advanced_option: true,
			visibilityException(node) {
				return node.locked
			}
		},
		export: {
			id: 'export',
			title: tl('switches.export'),
			icon: 'far.fa-square-check',
			icon_off: 'far.fa-window-close',
			advanced_option: true,
			condition: {modes: ['edit']},
			visibilityException(node) {
				return !node.export;
			}
		},
		shade: {
			id: 'shade',
			condition: {modes: ['edit'], features: ['java_cube_shading_properties']},
			title: tl('switches.shade'),
			icon: 'fa-star',
			icon_off: 'far.fa-star',
			advanced_option: true,
		},
		mirror_uv: {
			id: 'mirror_uv',
			condition: {modes: ['edit'], method: (element) => (element instanceof Group) ? element.children.find(c => c.box_uv) : element.box_uv},
			title: tl('switches.mirror'),
			icon: 'icon-mirror_x',
			icon_off: 'icon-mirror_x',
			advanced_option: true,
		},
		autouv: {
			id: 'autouv',
			title: tl('switches.autouv'),
			icon: 'fa-thumbtack',
			icon_off: 'far.fa-times-circle',
			icon_alt: 'fa-magic',
			advanced_option: true,
			condition: {modes: ['edit']},
			getState(element) {
				if (!element.autouv) {
					return false
				} else if (element.autouv === 1) {
					return true
				} else {
					return 'alt'
				}
			}
		},
	},

	toJSON() {
		let result = [];
		function iterate(array, save_array) {
			let i = 0;
			for (let element of array) {
				if (element.children instanceof Array) {
					let copy = {
						uuid: element.uuid,
						isOpen: element.isOpen,
						children: []
					}
					/*if (element instanceof Group) {
						copy = element.compile(true);
					}*/
					if (element.children.length > 0) {
						iterate(element.children, copy.children);
					}
					save_array.push(copy)
				} else {
					save_array.push(element.uuid)
				}
				i++;
			}
		}
		iterate(Outliner.root, result);
		return result;
	},
	loadJSON(array, add_to_project) {
		function iterate(array, save_array, addGroup) {
			for (let item of array) {
				if (typeof item === 'string') {

					let obj = OutlinerNode.uuids[item];
					if (obj) {
						obj.removeFromParent();
						save_array.push(obj);
						obj.parent = addGroup;
					}
				} else {
					let obj = OutlinerNode.uuids[item.uuid];

					// Legacy group support
					if (item && item.name != undefined) {
						if (obj instanceof Group) {
							obj.extend(item);
						} else {
							obj = new Group(item, item.uuid);
							if (item.uuid) obj.uuid = item.uuid;
							obj.init();
						}
					}

					if (!obj) {
						console.warn('Item not found', item);
						continue;
					}

					obj.removeFromParent();
					save_array.push(obj)
					obj.parent = addGroup;

					obj.isOpen = !!item.isOpen;

					if (item.children instanceof Array) {
						obj.children.empty();
						iterate(item.children, obj.children, obj)
					}
					if (item.content instanceof Array) {
						obj.children.empty();
						iterate(item.content, obj.children, obj)
					}
					if (item.selected && obj.multiSelect) {
						obj.multiSelect();
					}
				}
			}
		}
		if (!add_to_project) {
			Group.all.forEach(group => {
				group.removeFromParent();
			})
		}
		iterate(array, Outliner.root, 'root');
	}
}
Object.defineProperty(window, 'elements', {
	get() {
		return Outliner.elements;
	},
	set(val) {
		console.warn('You cannot modify this')
	}
});
Object.defineProperty(window, 'selected', {
	get() {
		return Outliner.selected;
	},
	set(val) {
		console.warn('You cannot modify this')
	}
});
//Colors
export const markerColors = [
	{pastel: "#A2EBFF", standard: "#58C0FF", id: 'light_blue'},
	{pastel: "#FFF899", standard: "#F4D714", id: 'yellow'},
	{pastel: "#F1BB75", standard: "#EC9218", id: 'orange'},
	{pastel: "#FF9B97", standard: "#FA565D", id: 'red'},
	{pastel: "#C5A6E8", standard: "#B55AF8", id: 'purple'},
	{pastel: "#A6C8FF", standard: "#4D89FF", id: 'blue'},
	{pastel: "#7BFFA3", standard: "#00CE71", id: 'green'},
	{pastel: "#BDFFA6", standard: "#AFFF62", id: 'lime'},
	{pastel: "#FFA5D5", standard: "#F96BC5", id: 'pink'},
	{pastel: "#E0E9FB", standard: "#C7D5F6", id: 'silver'}
]
export class OutlinerNode {
	constructor(uuid) {
		this.uuid = uuid || guid()
		this.export = true;
		this.locked = false;
	}
	init() {
		OutlinerNode.uuids[this.uuid] = this;
		if (!this.parent || (this.parent === 'root' && Outliner.root.indexOf(this) === -1)) {
			this.addTo('root')
		}
		return this;
	}
	select(event) {}
	get preview_controller() {
		return this.constructor.preview_controller;
	}
	getTypeBehavior(flag) {
		let constructor = this.type == 'group' ? Group : OutlinerElement.types[this.type];
		if (!constructor) return;
		for (let override of constructor.behavior_overrides) {
			if (Condition(override.condition)) {
				if (override.behavior[flag] != undefined) return override.behavior[flag];
			}
		}
		return constructor.behavior[flag];
	}
	//Sorting
	sortInBefore(element, index_mod = 0) {
		if (this.getTypeBehavior('parent_types')) {
			let types = this.getTypeBehavior('parent_types');
			let is_allowed = (element.parent == 'root' && types.includes('root')) || types.includes(element.parent.type);
			if (!is_allowed) return;
		}
		
		let arr = element.getParentArray();
		let index = arr.indexOf(element);
		if (arr.includes(this) && index > this.getParentArray().indexOf(this)) {
			// Adjust for self being removed from array;
			index--;
		}
		this.removeFromParent();

		//Adding
		this.parent = element.parent;
		if (index < 0) {
			arr.push(this)
		} else {
			arr.splice(index+index_mod, 0, this)
		}
		return this;
	}
	addTo(group, index = -1) {
		//Resolve Group Argument
		if (!group) {
			group = 'root'
		} else if (group !== 'root') {
			if (!group.children) {
				if (group.parent === 'root') {
					index = Outliner.root.indexOf(group)+1
					group = 'root'
				} else {
					index = group.parent.children.indexOf(group)+1
					group = group.parent
				}
			}
		}
		
		if (this.getTypeBehavior('parent_types')) {
			let types = this.getTypeBehavior('parent_types');
			let is_allowed = (group == 'root' && types.includes('root')) || types.includes(group.type);
			if (!is_allowed) return;
		}

		this.removeFromParent()
		//Get Array
		let arr;
		if (group === 'root') {
			arr = Outliner.root
			this.parent = 'root'
		} else {
			arr = group.children
			this.parent = group
		}

		//Adding
		if (arr.includes(this)) return this;
		if (index < 0)
			arr.push(this)
		else {
			arr.splice(index, 0, this)
		}

		return this;
	}
	removeFromParent() {
		this.getParentArray()?.remove(this);
		return this;
	}
	getParentArray() {
		if (this.parent === 'root') {
			return Outliner.root
		} else if (typeof this.parent === 'object') {
			return this.parent.children
		}
	}
	showContextMenu(event) {
		if (this.locked) return this;
		if (!this.selected) {
			this.clickSelect(event)
		}
		this.menu.open(event, this)
		return this;
	}
	//Outliner
	showInOutliner() {
		var scope = this;
		if (this.parent !== 'root') {
			this.parent.openUp()
		}
		Vue.nextTick(() => {
			var el = $('#'+scope.uuid)
			if (el.length === 0) return;
			var outliner_pos = $('#panel_outliner').offset().top

			var el_pos = el.offset().top
			if (el_pos > outliner_pos && el_pos < $('#cubes_list').height() + outliner_pos) return;

			var multiple = el_pos > outliner_pos ? 0.8 : 0.2
			var scroll_amount = el.offset().top  + $('#cubes_list').scrollTop() - outliner_pos - 20
			scroll_amount -= $('#cubes_list').height()*multiple - 15

			$('#cubes_list').animate({
				scrollTop: scroll_amount
			}, 200);
		})
	}
	updateElement() {
		var scope = this;
		var old_name = this.name;
		scope.name = '_&/3%6-7A';
		scope.name = old_name;
		return this;
	}
	get mesh() {
		return Project.nodes_3d[this.uuid];
	}
	get scene_object() {
		return Project.nodes_3d[this.uuid];
	}
	getDepth() {
		var d = 0;
		function it(p) {
			if (p.parent) {
				d++;
				return it(p.parent)
			} else {
				return d-1;
			}
		}
		return it(this)
	}
	remove() {
		if (this.preview_controller) this.preview_controller.remove(this);
		if (OutlinerNode.uuids[this.uuid] == this) delete OutlinerNode.uuids[this.uuid];
		this.removeFromParent();
	}
	rename() {
		this.showInOutliner()
		var obj = $('#'+this.uuid+' > div.outliner_object > input.cube_name')
		obj.attr('disabled', false)
		obj.select()
		obj.focus()
		obj.addClass('renaming')
		Blockbench.addFlag('renaming')
		this.old_name = this.name
		return this;
	}
	saveName(save) {
		if (save !== false && this.name.trim().length > 0 && this.name != this.old_name) {
			let name = this.name.trim();
			this.name = this.old_name;
			if (this.type === 'group') {
				Undo.initEdit({groups: [this], mirror_modeling: false});
			} else {
				Undo.initEdit({elements: [this], mirror_modeling: false});
			}
			if (this.constructor.animator) {
				Animation.all.forEach(animation => {
					if (animation.animators[this.uuid] && animation.animators[this.uuid].keyframes.length) {
						animation.saved = false;
					}
				})
			}
			this.name = name
			this.sanitizeName();
			delete this.old_name
			if (Condition(this.getTypeBehavior('unique_name'))) {
				this.createUniqueName()
			}
			Undo.finishEdit('Rename element')
		} else {
			this.name = this.old_name
			delete this.old_name
		}
		return this;
	}
	sanitizeName() {
		var name_regex = typeof this.name_regex == 'function' ? this.name_regex(this) : this.name_regex;
		if (name_regex) {
			var regex = new RegExp(`[^${name_regex}]`, 'g');
			this.name = this.name.replace(regex, c => {
				if (c == '-' && '_'.search(regex) == -1) {
					return '_';
				}
				if (c.toLowerCase().search(regex) == -1) {
					return c.toLowerCase();
				}
				return '';
			});
		}
	}
	createUniqueName(arr) {
		if (!Condition(this.getTypeBehavior('unique_name'))) return;
		var scope = this;
		var others = this.constructor.all.slice();
		if (arr && arr.length) {
			arr.forEach(g => {
				others.safePush(g)
			})
		}
		let zero_based = this.name.match(/[^\d]0$/) !== null;
		var name = this.name.replace(/\d+$/, '').replace(/\s+/g, '_');
		function check(n) {
			let n_lower = n.toLowerCase();
			for (var i = 0; i < others.length; i++) {
				if (others[i] !== scope && others[i].name.toLowerCase() === n_lower) return false;
			}
			return true;
		}
		if (check(this.name)) {
			return this.name;
		}
		for (var num = zero_based ? 1 : 2; num < 8e3; num++) {
			if (check(name+num)) {
				scope.name = name+num;
				return scope.name;
			}
		}
		return false;
	}
	isIconEnabled(toggle) {
		if (typeof toggle.getState == 'function') {
			return toggle.getState(this);
		} else if (this[toggle.id] !== undefined) {
			return this[toggle.id];
		} else {
			return true;
		}
	}
	matchesFilter(search_term_lowercase) {
		if (this.name.toLowerCase().includes(search_term_lowercase)) return true;
		if (this.children) {
			return this.children.find(child => child.matchesFilter(search_term_lowercase));
		}
		return false;
	}
	isChildOf(group, max_levels) {
		function iterate(obj, level) {
			if (!obj || obj === 'root') {
				return false;
			} else if (obj === group) {
				return true;
			} else if (!max_levels || level < max_levels-1) {
				return iterate(obj.parent, level+1)
			}
			return false;
		}
		return iterate(this.parent, 0)
	}
	static addBehaviorOverride(override_options) {
		let constructor = this;
		let override = {
			condition: override_options.condition,
			priority: override_options.priority ?? 0,
			behavior: override_options.behavior,
			delete() {
				constructor.behavior_overrides.remove(override);
			}
		}
		if (constructor.behavior_overrides == OutlinerNode.behavior_overrides) constructor.behavior_overrides = [];
		constructor.behavior_overrides.push(override);
		if (override_options.priority != undefined)  {
			constructor.behavior_overrides.sort((a, b) => b.priority - a.priority);
		}
		return override;
	}
	static behavior_overrides = [];
	static uuids = {}
}
OutlinerNode.prototype.node = 'outliner_node';
export class OutlinerElement extends OutlinerNode {
	constructor(data, uuid) {
		super(uuid);
		this.parent = 'root';
		this.selected = false;
	}
	init() {
		super.init();
		Project.elements.safePush(this);
		if (!this.mesh || !this.mesh.parent) {
			this.preview_controller.setup(this);
		}
		return this;
	}
	remove() {
		this.unselect()
		super.remove();
		Project.selected_elements.remove(this);
		Project.elements.remove(this);
		if (this.children) {
			let i = this.children.length-1
			while (i >= 0) {
				this.children[i].remove(false)
				i--;
			}
		}
		if (this.constructor.animator) {
			Animator.animations.forEach(animation => {
				if (animation.animators && animation.animators[this.uuid]) {
					animation.removeAnimator(this.uuid);
				}
				if (animation.selected && Animator.open) {
					updateKeyframeSelection();
				}
			})
		}
		TickUpdates.selection = true;
		return this;
	}
	showContextMenu(event) {
		if (this.locked) return this;
		if (!this.selected) {
			this.clickSelect(event)
		}
		this.menu.open(event, this)
		return this;
	}
	forSelected(fc, undo_tag, selection_method) {
		let selected = this.constructor.selected;
		if (selected.length <= 1 || !selected.includes(this)) {
			var edited = [this];
		} else {
			var edited = selected;
		}
		if (selection_method == 'all_in_group') {
			edited = edited.slice();
			edited.slice().forEach(element => {
				element.getParentArray().forEach(child => {
					if (child.faces) edited.safePush(child);
				})
			})
		}
		if (typeof fc === 'function') {
			if (undo_tag) {
				Undo.initEdit({elements: edited})
			}
			for (var i = 0; i < edited.length; i++) {
				fc(edited[i])
			}
			if (undo_tag) {
				Undo.finishEdit(undo_tag)
			}
		}
		return edited;
	}
	duplicate() {
		let copy = new this.constructor(this);
		//Numeration
		let number = copy.name.match(/[0-9]+$/)
		if (number) {
			number = parseInt(number[0])
			copy.name = copy.name.split(number).join(number+1)
		}
		if (Condition(this.getTypeBehavior('unique_name'))) {
			copy._original_name = this.name;
		}
		//Rest
		let last_selected = this.getParentArray().findLast(el => el.selected || el == this);
		copy.sortInBefore(last_selected, 1).init();
		let index = selected.indexOf(this)
		if (index >= 0) {
			selected[index] = copy
		} else {
			selected.push(copy)
		}
		Property.resetUniqueValues(this.constructor, copy);
		if (Condition(copy.getTypeBehavior('unique_name'))) {
			copy.createUniqueName()
		}
		if (copy.getTypeBehavior('parent')) {
			for (let child of this.children) {
				child.duplicate().addTo(copy)
			}
			copy.isOpen = true;
			Canvas.updatePositions();
		}
		TickUpdates.selection = true;
		return copy;
	}
	select(event, is_outliner_click) {
		if (Modes.animate && !this.constructor.animator) {
			Blockbench.showQuickMessage('message.group_required_to_animate');
			return false;
		}
		Undo.initSelection();
		//Shift
		var just_selected = [];
		let allow_multi_select = (!Modes.paint || (Toolbox.selected.id == 'fill_tool' && BarItems.fill_mode.value == 'selected_elements'));
		if (event && allow_multi_select && (event.shiftKey === true || Pressing.overrides.shift) && this.getParentArray().includes(selected[selected.length-1]) && is_outliner_click) {
			var starting_point;
			var last_selected = selected[selected.length-1]
			this.getParentArray().forEach((s, i) => {
				if (s === last_selected || s === this) {
					if (starting_point) {
						starting_point = false
					} else {
						starting_point = true
					}
					if (s.type !== 'group') {
						if (!selected.includes(s)) {
							s.markAsSelected(true)
							just_selected.push(s)
						}
					} else {
						s.markAsSelected(true)
					}
				} else if (starting_point) {
					if (s.type !== 'group') {
						if (!selected.includes(s)) {
							s.markAsSelected(true)
							just_selected.push(s)
						}
					} else {
						s.markAsSelected(true)
					}
				}
			})

		//Control
		} else if (event && allow_multi_select && (event.ctrlOrCmd || event.shiftKey || Pressing.overrides.ctrl || Pressing.overrides.shift)) {
			if (Outliner.selected.includes(this)) {
				this.unselect(true);
			} else {
				let select_children = !(this.getTypeBehavior('select_children') == 'self_first' && !this.selected);
				this.markAsSelected(select_children)
				just_selected.push(this)
			}

		//Normal
		} else {
			let all_children_selected = this.children instanceof Array && !this.children.find(child => child.selected == false);
			unselectAllElements([this]);
			let select_children = (this.getTypeBehavior('select_children') == 'self_first' && !this.selected) ? false : !all_children_selected;
			this.markAsSelected(select_children);
			just_selected.push(this)
			if (settings.outliner_reveal_on_select.value) {
				this.showInOutliner()
			}
		}
		Blockbench.dispatchEvent('added_to_selection', {added: just_selected})
		TickUpdates.selection = true;
		return this;
	}
	clickSelect(event, outliner_click) {
		if (Blockbench.hasFlag('renaming')) return;
		Undo.initSelection();
		let result = this.select(event, outliner_click);
		if (result === false) {
			Undo.cancelSelection();
			return;
		}
		Undo.finishSelection('Select element');
	}
	markAsSelected() {
		Project.selected_elements.safePush(this);
		this.selected = true;
		TickUpdates.selection = true;
		return this;
	}
	unselect(unselect_parent) {
		Project.selected_elements.remove(this);
		this.selected = false;
		if (UVEditor.selected_element_faces[this.uuid]) {
			delete UVEditor.selected_element_faces[this.uuid];
		}
		if (unselect_parent && this.parent.selected && this.parent.getTypeBehavior('select_children') != 'self_first') {
			this.parent.unselect(unselect_parent);
		}
		TickUpdates.selection = true;
		return this;
	}
	getUndoCopy() {
		let copy = new this.constructor(this)
		copy.uuid = this.uuid
		copy.type = this.type;
		delete copy.parent;
		return copy;
	}
	getSaveCopy() {
		let save = {};
		for (let key in this.constructor.properties) {
			this.constructor.properties[key].copy(this, save)
		}
		save.export = this.export ? undefined : false;
		save.uuid = this.uuid;
		save.type = this.type;
		return save;
	}
}
	OutlinerElement.fromSave = function(obj, keep_uuid) {
		let Type = OutlinerElement.types[obj.type] || Cube;
		if (Type) {
			return new Type(obj, keep_uuid ? obj.uuid : 0).init()
		}
	}
	OutlinerElement.isTypePermitted = function(type) {
		return !(
			(type == 'locator' && !Format.locators) ||
			(type == 'mesh' && !Format.meshes) ||
			(type == 'spline' && !Format.splines)
		)
	}
	Object.defineProperty(OutlinerElement, 'all', {
		get() {
			return Project.elements ? Project.elements : [];
		},
		set(arr) {
			console.warn('You cannot modify this')
		}
	})
	Object.defineProperty(OutlinerElement, 'selected', {
		get() {
			return Project.selected_elements ? Project.selected_elements : [];
		},
		set(group) {
			console.warn('You cannot modify this')
		}
	})
	OutlinerElement.hasAny = function() {
		return Outliner.elements.length > 0 && Outliner.elements.findIndex(element => element instanceof this) !== -1;
	}
	OutlinerElement.hasSelected = function() {
		return Outliner.selected.length > 0 && Outliner.selected.findIndex(element => element instanceof this) !== -1;
	}
	OutlinerElement.types = {};


export class NodePreviewController extends EventSystem {
	constructor(type, data = {}) {
		super();
		this.type = type;
		this.events = {};
		type.preview_controller = this;

		this.updateGeometry = null;
		this.updateUV = null;
		this.updateFaces = null;
		this.updatePixelGrid = null;
		this.updateHighlight = null;

		Object.assign(this, data);
	}
	setup(element) {
		var mesh = new THREE.Object3D();
		Project.nodes_3d[element.uuid] = mesh;
		mesh.name = element.uuid;
		mesh.type = element.type;
		mesh.isElement = true;
		mesh.visible = element.visibility;
		mesh.rotation.order = Format.euler_order;
		this.updateTransform(element);

		this.dispatchEvent('setup', {element});
	}
	remove(element) {
		let {mesh} = element;
		if (mesh?.parent) mesh.parent.remove(mesh);
		if (mesh?.geometry) mesh.geometry.dispose();
		if (mesh?.outline && mesh.outline.geometry) {
			mesh.outline.geometry.dispose();
			if (Transformer.dragging) {
				Canvas.outlines.remove(Canvas.outlines.getObjectByName(this.uuid+'_ghost_outline'))
			}
		}
		delete Project.nodes_3d[element.uuid];

		this.dispatchEvent('remove', {element});
	}
	updateAll(element) {
		if (!element.mesh) this.setup(element);
		this.updateTransform(element);
		this.updateVisibility(element);
		if (this.updateGeometry) this.updateGeometry(element);
		if (this.updateUV) this.updateUV(element);
		if (this.updateFaces) this.updateFaces(element);
		if (this.updatePixelGrid) this.updatePixelGrid(element);

		this.dispatchEvent('update_all', {element});
	}
	updateTransform(element) {
		let mesh = element.mesh;

		if (element.getTypeBehavior('movable')) {
			mesh.position.set(element.origin[0], element.origin[1], element.origin[2])
		}

		if (element.getTypeBehavior('rotatable')) {
			mesh.rotation.x = Math.degToRad(element.rotation[0]);
			mesh.rotation.y = Math.degToRad(element.rotation[1]);
			mesh.rotation.z = Math.degToRad(element.rotation[2]);
		}

		if (element.getTypeBehavior('scalable')) {
			mesh.scale.x = element.scale[0] || 1e-7;
			mesh.scale.y = element.scale[1] || 1e-7;
			mesh.scale.z = element.scale[2] || 1e-7;
		}

		if (Format.bone_rig) {
			if (element.parent instanceof OutlinerNode && element.parent.getTypeBehavior('parent')) {
				element.parent.mesh.add(mesh);
				if (element.parent.getTypeBehavior('use_absolute_position')) {
					mesh.position.x -= element.parent.origin[0];
					mesh.position.y -= element.parent.origin[1];
					mesh.position.z -= element.parent.origin[2];
				}
			} else if (mesh.parent !== Project.model_3d) {
				Project.model_3d.add(mesh)
			}
		} else if (mesh.parent !== Project.model_3d) {
			Project.model_3d.add(mesh)
		}

		mesh.updateMatrixWorld();

		this.dispatchEvent('update_transform', {element});
	}
	updateVisibility(element) {
		element.mesh.visible = element.visibility;

		this.dispatchEvent('update_visibility', {element});
	}
	updateSelection(element) {
		let {mesh} = element;
		if (mesh && mesh.outline) {
			if (Modes.paint && settings.outlines_in_paint_mode.value === false) {
				mesh.outline.visible = false;
			} else {
				mesh.outline.visible = element.selected;
			}
		}

		this.dispatchEvent('update_selection', {element});
	}
	updateRenderOrder(element) {
		switch (element.render_order) {
			case 'behind': element.mesh.renderOrder = -1; break;	
			case 'in_front': element.mesh.renderOrder = 1; break;	
			default: element.mesh.renderOrder = 0; break;	
		}
	}
	viewportRectangleOverlap(element, {projectPoint, rect_start, rect_end}) {
		element.mesh.getWorldPosition(Reusable.vec2);
		return pointInRectangle(projectPoint(Reusable.vec2), rect_start, rect_end);
	}
}
/**
Standardied outliner node context menu group order

(mesh editing)
(settings)
copypaste
	copy, paste, duplicate
outliner_control
	group, move
(add)
settings
	color, options, texture
manage
	visibility, rename, delete
 */
Outliner.control_menu_group = [
	new MenuSeparator('outliner_control'),
	'copy',
	'paste',
	'duplicate',
	'group_elements',
	'move_to_group',
]

OutlinerElement.registerType = function(constructor, id) {
	OutlinerElement.types[id] = constructor;
	constructor.prototype.type = id;
	if (!constructor.behavior) constructor.behavior = {};
	Object.defineProperty(constructor, 'all', {
		get() {
			return (Project.elements?.length && Project.elements.find(element => element instanceof constructor))
				 ? Project.elements.filter(element => element instanceof constructor)
				 : [];
		},
		set(arr) {
			console.warn('You cannot modify this')
		}
	})
	Object.defineProperty(constructor, 'selected', {
		get() {
			return (Project.selected_elements?.length && Project.selected_elements.find(element => element instanceof constructor))
				 ? Project.selected_elements.filter(element => element instanceof constructor)
				 : [];
		},
		set(group) {
			console.warn('You cannot modify this')
		}
	})
	Blockbench.dispatchEvent('register_element_type', {id, constructor});
}

Array.prototype.findRecursive = function(key1, val) {
	var i = 0
	while (i < this.length) {
		if (this[i][key1] === val) {
			return this[i];
		} else if (this[i].children && this[i].children.length > 0) {
			let inner = this[i].children.findRecursive(key1, val)
			if (inner !== undefined) {
				return inner;
			}
		}
		i++;
	}
	return undefined;
}

export function compileGroups(...args) {
	console.warn('compileGroups is no longer supported. Use Outliner.toJSON instead');
	return Outliner.toJSON(...args);
};
export function parseGroups(...args) {
	console.warn('parseGroups is no longer supported. Use Outliner.loadJSON instead');
	return Outliner.loadJSON(...args);
};

// Dropping
export function moveOutlinerSelectionTo(item, target, event, order) {
	let duplicate = event.altKey || Pressing.overrides.alt;
	if (item.children instanceof Array && target instanceof OutlinerNode && target.parent) {
		var is_parent = false;
		function iterate(g) {
			if (!(is_parent = g === item) && g.parent.children instanceof Array) {
				iterate(g.parent)
			}
		}
		iterate(target)
		if (is_parent) return;
	}
	if (item instanceof OutlinerNode && item.selected) {
		var items = [];
		// ensure elements are in displayed order
		Outliner.root.forEach(node => {
			if (node.forEachChild) {
				node.forEachChild(child => {
					if (child.selected && !child.parent.selected && (target instanceof OutlinerNode == false || !target.isChildOf?.(child))) {
						items.push(child);
					}
				}, null, true);
			} else if (node.selected) {
				items.push(node);
			}
		})
	} else {
		var items = [item];
	}
	if (target instanceof Collection) {
		Undo.initEdit({collections: [target]});
		for (let item of items) {
			target.children.safePush(item.uuid);
		}
		Undo.finishEdit('Add to collection');
		updateSelection();
		return;
	}
	if (duplicate) {
		Undo.initEdit({elements: [], outliner: true, selection: true})
		Outliner.selected.empty();
	} else {
		Undo.initEdit({outliner: true, selection: true})
		var updatePosRecursive = function(item) {
			if (item.children && item.children.length) {
				item.children.forEach(updatePosRecursive)
			}
			if (item.preview_controller?.updateTransform) {
				item.preview_controller.updateTransform(item);
				if (Format.per_group_texture && item.preview_controller.updateFaces) {
					item.preview_controller.updateFaces(item);
				}
			}
		}
	}
	function place(obj) {
		if (!order) {
			obj.addTo(target)
		} else {
			obj.sortInBefore(target, order == 1 ? 1 : undefined);
		}
	}
	items.forEach(function(item) {
		if (item && item !== target) {
			if (duplicate) {
				if (item instanceof Group) {
					var dupl = item.duplicate()
					place(dupl)
					dupl.select()
				} else {
					var cube = item.duplicate()
					place(cube)
					selected.safePush(cube)
				}
			} else {
				place(item)
				if (Format.bone_rig) {
					updatePosRecursive(item)
				}
			}
		}
	})
	if (Format.bone_rig) {
		Canvas.updateAllBones()
	}
	if (duplicate) {
		updateSelection()
		Undo.finishEdit('Duplicate selection', {elements: selected, outliner: true, selection: true})
	} else {
		Transformer.updateSelection()
		Undo.finishEdit('Move elements in outliner')
	}
}
export function canAddOutlinerNodesTo(selection, target) {
	if (target == 'root') {
		for (let node of selection) {
			let parent_types = node.getTypeBehavior('parent_types');
			if (parent_types && !parent_types.includes('root')) return false;
		}
		return true;
	}
	if (!target.getTypeBehavior('parent')) return false;
	let child_types = target.getTypeBehavior('child_types');
	if (child_types) {
		if (selection.find(el => child_types.includes(el.type) == false)) return false;
	}

	for (let node of selection) {
		let parent_types = node.getTypeBehavior('parent_types');
		if (parent_types && !parent_types.includes(target.type)) return false;
	}
	return true;
}
export function canAddOutlinerSelectionTo(target, clicked_on) {
	let nodes_to_move;
	if (clicked_on instanceof OutlinerElement && !clicked_on.selected) {
		nodes_to_move = [clicked_on];
	} else {
		if (target.selected) return false;
		nodes_to_move = Outliner.selected.concat(Group.selected).filter(element => element.parent == 'root' || element.parent.selected != true);
	}
	return canAddOutlinerNodesTo(nodes_to_move, target);
}

//Misc
export function renameOutliner(element) {
	if (Format.id == 'skin') return;

	stopRenameOutliner()

	if (Group.selected.length == 1 && !Project.EditSession) {
		Group.first_selected.rename()

	} else if (Outliner.selected.length === 1 && !Project.EditSession) {
		Outliner.selected[0].rename()

	} else if (element instanceof OutlinerNode && element.getTypeBehavior('select_children') == 'self_first') {
		element.rename();

	} else {

		if (Group.first_selected && !element) {
			Blockbench.textPrompt('generic.rename', Group.first_selected.name, function (name) {
				name = name.trim();
				if (name) {
					Undo.initEdit({groups: Group.multi_selected});
					for (let group of Group.multi_selected) {
						group.name = name;
						if (Format.bone_rig) {
							group.createUniqueName();
						}
					}
					Undo.finishEdit('Rename group');
				}
			})
		} else if (Outliner.selected.length) {
			Blockbench.textPrompt('generic.rename', Outliner.selected[0].name, function (name) {
				name = name.trim();
				if (name) {
					Undo.initEdit({elements: Outliner.selected})
					Outliner.selected.forEach((element, i) => {
						element.name = name.replace(/%+/g, val => {
							return (element.getParentArray().indexOf(element)+1).toDigitString(val.length)
						}).replace(/\$+/g, val => {
							return (i+1).toDigitString(val.length)
						});
						if (Condition(element.getTypeBehavior('unique_name'))) {
							element.createUniqueName();
						}
					})
					Undo.finishEdit('Rename')
				}
			}, {description: tl('message.rename_elements.numbering')})
		}
	}
}
export function stopRenameOutliner(save) {
	if (Blockbench.hasFlag('renaming')) {
		let uuid = $('.outliner_object input.renaming').parent().parent().attr('id')
		let element = Outliner.root.findRecursive('uuid', uuid)
		if (element) {
			element.saveName(save)
		}
		$('.outliner_object input.renaming').attr('disabled', true).removeClass('renaming')
		$('body').focus()
		if (window.getSelection) {
			window.getSelection().removeAllRanges()
		} else if (document.selection) {
			document.selection.empty()
		}
		Blockbench.removeFlag('renaming')
	}
}
export function toggleElementProperty(key) {
	let affected = selected.filter(element => element[key] != undefined);
	if (!affected.length) return;
	var state = affected[0][key];
	if (typeof state === 'number') {
		state = (state+1) % 3;
	} else {
		state = !state
	}
	Undo.initEdit({
		elements: affected,
		mirror_modeling: false
	})
	affected.forEach(element => {
		if (element[key] != undefined) {
			element[key] = state;
		}
	})
	if (key === 'visibility') {
		Canvas.updateVisibility()
	}
	if (key === 'mirror_uv') {
		Canvas.updateUVs();
	}
	Undo.finishEdit('Toggle ' + key)
}

StateMemory.init('advanced_outliner_toggles', 'boolean')

SharedActions.add('rename', {
	subject: 'outliner',
	condition: {modes: ['edit', 'paint'], method: () => Format.id != 'skin'},
	priority: -1,
	run() {
		renameOutliner();
	}
});
SharedActions.add('delete', {
	subject: 'outliner',
	condition: () => ((Modes.edit || Modes.paint) && (selected.length || Group.first_selected)),
	priority: -1,
	run() {
		let list = Outliner.selected.slice();
		let groups = Group.all.filter(g => g.selected);

		let recursive_list = list.slice();
		let recursive_groups = groups.slice();
		const addChildren = element => {
			if (!element.children) return;
			for (let child of element.children) {
				if (child instanceof Group) {
					recursive_groups.safePush(child);
				} else {
					recursive_list.safePush(child);
				}
				addChildren(child);
			}
		}
		list.forEach(addChildren);
		groups.forEach(addChildren);

		Undo.initEdit({
			elements: recursive_list,
			groups: recursive_groups,
			selection: true,
			outliner: true,
		})
		for (let element of list) {
			element.remove(false);
		}
		for (let group of groups) {
			group.remove(false);
		}
		recursive_list.empty();
		recursive_groups.empty();
		TickUpdates.selection = true;
		Undo.finishEdit('Delete outliner selection')
	}
})
SharedActions.add('duplicate', {
	subject: 'outliner',
	condition: () => Modes.edit && Group.first_selected,
	priority: -1,
	run() {
		let cubes_before = elements.length;
		Undo.initEdit({outliner: true, elements: [], groups: [], selection: true});
		let all_original = [];
		for (let group of Group.multi_selected) {
			group.forEachChild(g => all_original.safePush(g), Group, true);
		}

		let all_new = [];
		let new_groups = [];
		let old_selected_groups = Group.multi_selected.slice();
		Group.multi_selected.empty();
		for (let group of old_selected_groups) {
			group.selected = false;
			let new_group = group.duplicate();
			new_group.forEachChild(g => all_new.push(g), Group, true);
			new_group.multiSelect();
			new_groups.push(new_group);
		}

		updateSelection();
		Undo.finishEdit('Duplicate group', {outliner: true, elements: elements.slice().slice(cubes_before), groups: new_groups, selection: true});

		if (Animation.all.length) {
			let affected_anims = Animation.all.filter(a => all_original.find(bone => a.animators[bone.uuid]?.keyframes.length));
			if (affected_anims.length) {
				Blockbench.showMessageBox({
					translateKey: 'duplicate_bone_copy_animation',
					message: tl('message.duplicate_bone_copy_animation.message', [affected_anims.length]),
					buttons: ['dialog.yes', 'dialog.no'],
				}, result => {
					if (result == 1) return;

					Undo.initEdit({animations: affected_anims});
					for (let animation of affected_anims) {
						for (let i = 0; i < all_original.length; i++) {
							let orig_animator = animation.animators[all_original[i].uuid];
							if (!orig_animator) continue;
							let new_animator = animation.getBoneAnimator(all_new[i]);
		
							new_animator.extend(orig_animator);
							for (let kf of orig_animator.keyframes) {
								new_animator.addKeyframe(kf);
							}
						}
					}
					Undo.finishEdit('Copy animations of duplicated bones');
				})
			}
		}
	}
})
SharedActions.add('duplicate', {
	subject: 'outliner',
	condition: () => Modes.edit && Outliner.selected.length,
	priority: -2,
	run() {
		let added_elements = [];
		Undo.initEdit({elements: added_elements, outliner: true, selection: true})
		Outliner.selected.slice().forEachReverse(function(obj, i) {
			if (obj.parent instanceof OutlinerElement && obj.parent.selected) return;
			let copy = obj.duplicate();
			added_elements.push(copy);
			Outliner.selected[i] = copy;
		})
		BarItems.move_tool.select();
		updateSelection();
		Undo.finishEdit('Duplicate elements')
	}
})
SharedActions.add('select_all', {
	subject: 'outliner',
	condition: () => Modes.edit || Modes.paint,
	priority: -2,
	run() {
		Undo.initSelection();
		let selectable_elements = Outliner.elements.filter(element => !element.locked);
		if (Outliner.selected.length < selectable_elements.length) {
			for (let node of Outliner.root) {
				if (node instanceof Group) {
					node.multiSelect();
				}
			}
			selectable_elements.forEach(obj => {
				obj.markAsSelected()
			})
			TickUpdates.selection = true;
			Undo.finishSelection('Select all elements');
		} else {
			unselectAllElements()
			Undo.finishSelection('Unselect all elements');
		}
	}
})
SharedActions.add('unselect_all', {
	subject: 'outliner',
	condition: {modes: ['edit', 'paint', 'animate']},
	priority: -2,
	run() {
		Undo.initSelection();
		unselectAllElements();
		Undo.finishSelection('Unselect all elements');
	}
})
SharedActions.add('invert_selection', {
	subject: 'outliner',
	condition: {modes: ['edit', 'paint']},
	priority: -2,
	run() {
		Outliner.elements.forEach(element => {
			if (element.selected) {
				element.unselect()
			} else {
				element.markAsSelected()
			}
		})
		for (let group of Group.multi_selected) {
			group.unselect();
		}
		updateSelection();
	}
})

BARS.defineActions(function() {
	new Action('add_element', {
		icon: 'add_2',
		condition: {modes: ['edit']},
		side_menu: new Menu([
			'add_mesh',
			'add_cube',
			'add_spline',
			'add_billboard',
			'add_armature',
			'add_armature_bone',
			'add_locator',
			'add_null_object',
			'add_texture_mesh',
		]),
		click(event) {
			let fallback = this.side_menu.structure.map(id => BarItems[id]).find(x => Condition(x.condition));
			if (fallback) fallback.click();
		}
	});
	new Toggle('outliner_toggle', {
		icon: 'dns',
		category: 'edit',
		keybind: new Keybind({key: 115}),
		default: StateMemory.advanced_outliner_toggles,
		onChange: function (value) {
			Outliner.vue.options.show_advanced_toggles = value;
			StateMemory.advanced_outliner_toggles = value;
			StateMemory.save('advanced_outliner_toggles');
		}
	})
	new Toggle('search_outliner', {
		icon: 'search',
		category: 'edit',
		onChange(value) {
			Outliner.vue._data.options.search_term = '';
			Outliner.vue._data.search_enabled = value;
			if (value) {
				Vue.nextTick(() => {
					document.getElementById('outliner_search_bar').firstChild.focus();
				});
			}
		}
	})
	new BarText('cube_counter', {
		right: true,
		click: function() {

			var face_count = 0;
			let vertex_count = 0;
			Outliner.elements.forEach(element => {
				if (element.getTypeBehavior('cube_faces')) {
					for (var face in element.faces) {
						if (element.faces[face].texture !== null) face_count++;
					}
					if (element instanceof Cube) {
						vertex_count += 8;
					}
				} else if (element.faces) {
					face_count += Object.keys(element.faces).length;
				}
				if (element instanceof Mesh) {
					vertex_count += Object.keys(element.vertices).length;
				}
			})

			// Todo: proper localization options for element type plurals, display all element types
			const stats = [
				{ label: tl('dialog.model_stats.cubes'), value: Cube.all.length },
				Format.meshes && { label: tl('dialog.model_stats.meshes'), value: Mesh.all.length },
				Format.splines && { label: tl('dialog.model_stats.splines', [], 'Splines'), value: SplineMesh.all.length },
				Format.locators && { label: tl('dialog.model_stats.locators'), value: Locator.all.length },
				{ label: tl('dialog.model_stats.groups'), value: Group.all.length },
				{ label: tl('dialog.model_stats.vertices'), value: vertex_count },
				{ label: tl('dialog.model_stats.faces'), value: face_count },
			].filter(e => e);

			Blockbench.dispatchEvent('display_model_stats', {stats});

			const form = {};
			let i = 0;
			for (let entry of stats) {
				if (!entry) continue;
				let text = typeof entry.value == 'number' ? stringifyLargeInt(entry.value) : entry.value;
				form[i] = { type: 'info', label: entry.label, text };
				i++
			};
			let dialog = new Dialog({
				id: 'model_stats',
				title: 'dialog.model_stats.title',
				width: 300,
				singleButton: true,
				form
			})
			dialog.show()

		},
		onUpdate: function() {
			if (Animator.open) {
				var sel = 0;
				for (let group of Group.all) {
					if (group.selected) sel++;
				}
				this.set(stringifyLargeInt(sel)+' / '+stringifyLargeInt(Group.all.length));
			} else {
				this.set(stringifyLargeInt(Outliner.selected.length)+' / '+stringifyLargeInt(Outliner.elements.length));
			}
		}
	})

	new Action('move_to_group', {
		icon: 'drive_file_move',
		category: 'edit',
		searchable: true,
		children(element) {
			let nodes = [...getAllGroups(), ...Outliner.elements].filter(g => canAddOutlinerSelectionTo(g));
			let menu_list = nodes.map(node => {
				return {
					name: node.name,
					icon: node.icon,
					color: markerColors[node.color % markerColors.length] && markerColors[node.color % markerColors.length].standard,
					click(event) {
						moveOutlinerSelectionTo(element, node, event);
						element.showInOutliner();
					}
				}
			});
			if (canAddOutlinerSelectionTo('root')) {
				menu_list.splice(0, 0, {
					name: 'Root',
					icon: 'list_alt',
					click(event) {
						moveOutlinerSelectionTo(element, undefined, event);
					}
				});
			}
			return menu_list;
		},
		click(event) {
			new Menu('move_to_group', this.children(this), {searchable: true}).open(event.target, this)
		}
	})
	new Action('sort_outliner', {
		icon: 'sort_by_alpha',
		category: 'edit',
		click: function () {
			Undo.initEdit({outliner: true});
			if (Outliner.root.length < 1) return;
			Outliner.root.sort(function(a,b) {
				return sort_collator.compare(a.name, b.name)
			});
			Undo.finishEdit('Sort outliner')
		}
	})
	new Action('unlock_everything', {
		icon: 'fas.fa-key',
		category: 'edit',
		click: function () {
			let locked = Outliner.elements.filter(el => el.locked);
			let locked_groups = Group.all.filter(group => group.locked)
			if (locked.length + locked_groups.length == 0) return;

			Undo.initEdit({outliner: locked_groups.length > 0, elements: locked});
			[...locked, ...locked_groups].forEach(el => {
				el.locked = false;
			})
			Undo.finishEdit('Unlock everything')
		}
	})
	new Toggle('element_colors', {
		category: 'edit',
		icon: 'palette',
		linked_setting: 'outliner_colors'
	})
	new Action('select_window', {
		icon: 'filter_list',
		category: 'edit',
		keybind: new Keybind({key: 'f', ctrl: true}),
		condition: () => Modes.edit || Modes.paivnt,
		click: function(event, options) {
			let color_options = {
				'-1': 'generic.all'
			}
			markerColors.forEach((color, i) => {
				color_options[i] = color.name || 'cube.color.' + color.id;
			})
			let type_options = {
				all: 'generic.all'
			};
			for (let type in OutlinerElement.types) {
				type_options[type] = tl(`data.${type}`);
				if (type_options[type].includes('.')) {
					type_options[type] = OutlinerElement.types[type].display_name || OutlinerElement.types[type].name;
				}
			}
			new Dialog({
				id: 'selection_creator',
				title: 'dialog.select.title',
				form_first: true,
				form: {
					mode: {label: 'dialog.select.mode', type: 'select', options: {
						new: 'dialog.select.mode.new',
						add: 'dialog.select.mode.add',
						remove: 'dialog.select.mode.remove',
						in_selection: 'dialog.select.mode.in_selection',
					}},
					group: {label: 'dialog.select.group', type: 'checkbox'},
					separate: '_',
					name: {label: 'dialog.select.name', type: 'text'},
					type: {label: 'dialog.select.type', type: 'select', options: type_options},
					color: {label: 'menu.cube.color', type: 'select', value: '-1', options: color_options},
					texture: {label: 'data.texture', type: 'text', list: Texture.all.map(tex => tex.name)},
					random: {label: 'dialog.select.random', type: 'range', min: 0, max: 100, step: 1, value: 100}
				},
				onConfirm(formData) {
					if (formData.mode == 'new' || formData.mode == 'in_selection') {
						selected.empty();
					}
					let selected_groups = Group.multi_selected;
					if (selected_groups.length) {
						selected_groups.forEach(group => group.unselect());
					}
					var name_seg = formData.name.toUpperCase()
					var tex_seg = formData.texture.toLowerCase()
				
					let array = Outliner.elements.slice();
					if (formData.group && selected_groups.length) {
						array = [];
						group.multiSelect();
						for (let group of selected_groups) {
							group.forEachChild(child => array.safePush(child), OutlinerElement, false);
						}
					}
					if (formData.mode == 'in_selection' || formData.mode == 'remove') {
						array = array.slice().filter(el => el.selected);
					}
				
					array.forEach(function(obj) {
						if (obj.type !== formData.type && formData.type !== 'all') return;
						if (obj.name.toUpperCase().includes(name_seg) === false) return;
						if (obj.faces && tex_seg && !Format.single_texture) {
							var has_tex = false;
							for (var key in obj.faces) {
								var tex = obj.faces[key].getTexture();
								if (tex && tex.name.includes(tex_seg)) {
									has_tex = true
								}
							}
							if (!has_tex) return;
						}
						if (formData.color != '-1') {
							if (obj.setColor == undefined || obj.color.toString() != formData.color) return;
						}
						if (Math.random() > formData.random/100) return;
						if (formData.mode == 'remove') {
							selected.remove(obj);
						} else {
							selected.safePush(obj);
						}
					})
					updateSelection()
					if (options && options.returnResult) {
						options.returnResult({elements: selected, groups: selected_groups});

					} else if (selected.length) {
						selected[0].showInOutliner()
					}
				}
			}).show()
			$('.dialog#selection_creator .form_bar_name > input').focus()
		}
	})

	new Action('hide_everything_except_selection', {
		icon: 'fa-glasses',
		category: 'view',
		keybind: new Keybind({key: 'i'}),
		condition: {modes: ['edit', 'paint']},
		click() {
			if (Painter.painting) return;
			let enabled = !Project.only_hidden_elements;

			if (Project.only_hidden_elements) {
				let affected = Project.elements.filter(el => typeof el.visibility == 'boolean' && Project.only_hidden_elements.includes(el.uuid));
				Undo.initEdit({elements: affected})
				affected.forEach(el => {
					el.visibility = true;
				})
				delete Project.only_hidden_elements;
			} else {
				let affected = Project.elements.filter(el => typeof el.visibility == 'boolean' && !el.selected && el.visibility);
				Undo.initEdit({elements: affected})
				affected.forEach(el => {
					el.visibility = false;
				})
				Project.only_hidden_elements = affected.map(el => el.uuid);
			}

			Canvas.updateVisibility();
			Undo.finishEdit('Toggle visibility on everything except selection');
		}
	})
})

Interface.definePanels(function() {

	var VueTreeItem = Vue.extend({
		template: 
		`<li class="outliner_node" v-bind:class="{ parent_li: node.children && node.children.length > 0}" v-bind:id="node.uuid" v-bind:style="{'--indentation': indentation}">` +
			`<div
				class="outliner_object"
				v-bind:class="{ group: node.type === 'group', selected: node.selected }"
				:element_type="node.type"
				@contextmenu.prevent.stop="node.showContextMenu($event)"
				@click="node.clickSelect($event, true)"
				:title="node.title"
				@dblclick.stop.self="!node.locked && renameOutliner(node)"
			>` +
				//Opener
				
				`<i
					v-if="node.children && node.children.length > 0 && (!options.hidden_types.length || node.children.some(node => !options.hidden_types.includes(node.type)))"
					@click.stop="node.isOpen = !node.isOpen" class="icon-open-state fa"
					:class='{"fa-angle-right": !node.isOpen, "fa-angle-down": node.isOpen}'
				></i>
				<i v-else class="outliner_opener_placeholder"></i>

				<dynamic-icon :icon="node.icon.replace('fa ', '').replace(/ /g, '.')" :color="(outliner_colors.value && node.color >= 0) ? markerColors[node.color % markerColors.length].pastel : ''" v-on:dblclick.stop="doubleClickIcon(node)"></dynamic-icon>
				<input type="text" class="cube_name tab_target" :class="{locked: node.locked}" v-model="node.name" disabled>` +


				`<dynamic-icon v-for="(btn, key) in node.buttons" :key="key"
					v-if="Condition(btn, node) && (!btn.advanced_option || options.show_advanced_toggles || (btn.visibilityException && btn.visibilityException(node)) )"
					class="outliner_toggle"
					:icon="getButtonIcon(btn, node)"
					:class="getButtonClasses(btn, node)"
					:title="getBtnTooltip(btn, node)"
					:toggle="btn.id"
					@click.stop
				/>` +
			'</div>' +
			//Other Entries
			'<ul v-if="node.children && node.isOpen">' +
				'<vue-tree-item v-for="item in visible_children" :node="item" :depth="depth + 1" :options="options" :key="item.uuid"></vue-tree-item>' +
				`<div class="outliner_line_guide" v-if="node.children && (node.type == 'group' ? node.constructor.selected.includes(node) : (node.selected && !node.parent.selected))"></div>` +
			'</ul>' +
		'</li>',
		props: {
			options: Object,
			node: {
				type: Object
			},
			depth: Number
		},
		data() {return {
			outliner_colors: settings.outliner_colors,
			markerColors
		}},
		computed: {
			indentation() {
				return limitNumber(this.depth, 0, (this.width-100) / 16);
			},
			visible_children() {
				let filtered = this.node.children;
				if (this.options.search_term) {
					let search_term_lowercase = this.options.search_term.toLowerCase();
					filtered = this.node.children.filter(child => child.matchesFilter(search_term_lowercase));
				}
				if (!this.options.hidden_types.length) {
					return filtered;
				} else {
					return filtered.filter(node => !this.options.hidden_types.includes(node.type));
				}
			}
		},
		methods: {
			nodeClass: function (node) {
				if (node.isOpen) {
					return node.openedIcon || node.icon;
				} else {
					return node.closedIcon || node.icon;
				}
			},
			getButtonIcon: function (btn, node) {
				let value = node.isIconEnabled(btn);
				let icon_string = '';
				if (value === true) {
					icon_string = typeof btn.icon == 'function' ? btn.icon(node) : btn.icon;
				} else if (value === false) {
					icon_string = typeof btn.icon_off == 'function' ? btn.icon_off(node) : btn.icon_off
				} else {
					icon_string = typeof btn.icon_alt == 'function' ? btn.icon_alt(node) : btn.icon_alt
				}
				return icon_string.trim().replace(/fa[rs]* /, '');
			},
			getButtonClasses: function (btn, node) {
				let value = node.isIconEnabled(btn);
				if (value === true) {
					return ''
				} else if (value === false) {
					return 'icon_off';
				} else {
					return 'icon_alt';
				}
			},
			getBtnTooltip: function (btn, node) {
				let value = node.isIconEnabled(btn);
				let text = btn.title + ': ';
				if (value === true) {
					return text + tl('generic.on');
				} else if (value === false) {
					return text + tl('generic.off');
				} else if (value == 'alt') {
					return text + tl(`switches.${btn.id}.alt`);
				} else {
					return text + value;
				}
			},
			doubleClickIcon(node) {
				if (node.children && node.children.length) {
					node.isOpen = !node.isOpen;
				}
			},
			renameOutliner,
			Condition
		}
	});
	Vue.component('vue-tree-item', VueTreeItem);

	function eventTargetToNode(target) {
		if (!target) return [];
		let target_node = target;
		let i = 0;
		while (target_node && target_node.classList && !target_node.classList.contains('outliner_node')) {
			if (i < 4 && target_node) {
				target_node = target_node.parentNode;
				i++;
			} else {
				return [];
			}
		}
		return [OutlinerNode.uuids[target_node.id], target_node];
	}
	function getOrder(loc, obj) {

		if (!obj) {
			return;
		} else if (obj.children && (!obj.getTypeBehavior('child_types') || obj.getTypeBehavior('child_types').includes(Outliner.selected[0]?.type))) {
			if (loc < 8) return -1;
			if (loc > 24 && (!obj.isOpen || obj.children.length === 0)) return 1;
		} else {
			if (loc < 16) return -1;
			return 1;
		}
		return 0;
	}

	new Panel('outliner', {
		icon: 'list_alt',
		condition: {modes: ['edit', 'paint', 'animate', 'pose'], method: () => (!Format.image_editor && !(Modes.animate && AnimationController.selected))},
		default_position: {
			slot: 'right_bar',
			float_position: [0, 0],
			float_size: [300, 400],
			height: 400,
			sidebar_index: 8,
		},
		toolbars: [
			new Toolbar('outliner', {
				children: [
					'add_element',
					'add_group',
					'outliner_toggle',
					'toggle_skin_layer',
					'explode_skin_model',
					'+',
					'search_outliner',
					'cube_counter'
				]
			})
		],
		growable: true,
		resizable: true,
		onResize() {
			if (this.inside_vue) this.inside_vue.width = this.width;
		},
		component: {
			name: 'panel-outliner',
			data() { return {
				root: Outliner.root,
				search_enabled: false,
				options: {
					width: 300,
					show_advanced_toggles: StateMemory.advanced_outliner_toggles,
					hidden_types: [],
					search_term: ''
				}
			}},
			methods: {
				openMenu(event) {
					Panels.outliner.menu.show(event)
				},
				updateSearch(event) {
					if (this.search_enabled && !this.options.search_term && !document.querySelector('#outliner_search_bar > input:focus')) {
						this.search_enabled = false;
						BarItems.search_outliner.set(false);
					}
				},
				dragToggle(e1) {
					let [original] = eventTargetToNode(e1.target);
					let affected = [];
					let affected_groups = [];
					let key = e1.target.getAttribute('toggle');
					let previous_values = {};
					let value = original[key];
					let toggle_config = Outliner.buttons[key];
					value = (typeof value == 'number') ? (value+1) % 3 : !value;

					if (!toggle_config) return;
					if (!Condition(toggle_config.condition, selected[0])) return;

					function move(e2) {
						convertTouchEvent(e2);
						if (e2.target.classList.contains('outliner_toggle') && e2.target.getAttribute('toggle') == key) {
							let [node] = eventTargetToNode(e2.target);
							if (key == 'visibility' && (e2.altKey || Pressing.overrides.alt) && !affected.length) {
								let new_affected = Outliner.elements.filter(node => !node.selected);
								value = !(new_affected[0] && new_affected[0][key]);
								new_affected.forEach(node => {
									affected.push(node);
									previous_values[node.uuid] = node[key];
									node[key] = value;
								})
								// Update
								Canvas.updateVisibility();
								
							} else if (!affected.includes(node) && (!node.locked || key == 'locked' || key == 'visibility')) {
								let new_affected = [node];
								if (node instanceof Group) affected_groups.push(node);
								if (node.forEachChild) {
									if (toggle_config.change_children != false) {
										node.forEachChild(node => {
											if (node.buttons.find(b => b.id == key)) new_affected.push(node)
										});
									}
								} else if (node.selected && Outliner.selected.length > 1) {
									Outliner.selected.forEach(el => {
										if (el.buttons.find(b => b.id == key)) new_affected.safePush(el);
									})
								}
								new_affected.forEach(node => {
									affected.push(node);
									previous_values[node.uuid] = node[key];
									node[key] = value;
									if (key == 'mirror_uv' && node.preview_controller.updateUV) node.preview_controller.updateUV(node);
								})
								// Update
								if (key == 'visibility') Canvas.updateVisibility();
								if (key == 'locked') updateSelection();
							}
						}
					}
					function off(e2) {
						if (affected.length) {
							affected.forEach(node => {
								node[key] = previous_values[node.uuid];
							})
							Undo.initEdit({
								elements: affected.filter(node => node instanceof OutlinerElement),
								groups: affected_groups,
								mirror_modeling: false
							})
							affected.forEach(node => {
								node[key] = value;
								if (key == 'shade') node.updateElement();
							})
							Undo.finishEdit(`Toggle ${key} property`)
						}
						removeEventListeners(document, 'mousemove touchmove', move);
						removeEventListeners(document, 'mouseup touchend', off);
					}
					addEventListeners(document, 'mousemove touchmove', move, {passive: false});
					addEventListeners(document, 'mouseup touchend', off, {passive: false});

					move(e1);

					e1.preventDefault()

				},
				dragNode(e1) {
					if (e1.button == 1) return;
					if (getFocusedTextInput()) return;
					convertTouchEvent(e1);

					if (e1.target.classList.contains('outliner_toggle')) {
						this.dragToggle(e1);
						return false;
					}
					
					let [item] = eventTargetToNode(e1.target);
					if (!item || item.locked || !Modes.edit) {
						function off(e2) {
							removeEventListeners(document, 'mouseup touchend', off);
							if (e1.target && e1.offsetX > e1.target.clientWidth) return;
							if (e2.target && e2.target.id == 'cubes_list') {
								Undo.initSelection({});
								unselectAllElements();
								Undo.finishSelection('Unselect outliner');
							}
						}
						addEventListeners(document, 'mouseup touchend', off);
						return;
					};

					let active = false;
					let helper;
					let timeout;
					let drop_target, drop_target_node, order;
					let last_event = e1;

					// scrolling
					let list = document.getElementById('cubes_list');
					let list_offset = $(list).offset();
					let scrollInterval = function() {
						if (!active) return;
						if (mouse_pos.y < list_offset.top) {
							list.scrollTop += (mouse_pos.y - list_offset.top) / 7 - 3;
						} else if (mouse_pos.y > list_offset.top + list.clientHeight) {
							list.scrollTop += (mouse_pos.y - (list_offset.top + list.clientHeight)) / 6 + 3;
						}
					}
					let scrollIntervalID;

					function move(e2) {
						convertTouchEvent(e2);
						let offset = [
							e2.clientX - e1.clientX,
							e2.clientY - e1.clientY,
						]
						if (!active) {
							let distance = Math.sqrt(Math.pow(offset[0], 2) + Math.pow(offset[1], 2))
							if (Blockbench.isTouch) {
								if (distance > 20 && timeout) {
									clearTimeout(timeout);
									timeout = null;
								} else {
									document.getElementById('cubes_list').scrollTop += last_event.clientY - e2.clientY;
								}
							} else if (distance > 6) {
								active = true;
							}
						} else {
							if (e2) e2.preventDefault();
							
							if (open_menu) open_menu.hide();

							if (!helper) {
								helper = Interface.createElement('div', {id: 'outliner_drag_helper'}, [
									Blockbench.getIconNode(item.icon.replace(/ /g, '.').replace(/^fa\./, '')),
									Interface.createElement('label', {}, item.name)
								]);
								
								if (item instanceof Group == false && Outliner.selected.length > 1) {
									let counter = document.createElement('div');
									counter.classList.add('outliner_drag_number');
									counter.textContent = Outliner.selected.length.toString();
									helper.append(counter);
								}
								document.body.append(helper);

								scrollIntervalID = setInterval(scrollInterval, 1000/60)
							}
							helper.style.left = `${e2.clientX}px`;
							helper.style.top = `${e2.clientY}px`;

							// drag
							$('.drag_hover').removeClass('drag_hover');
							$('.outliner_node[order]').attr('order', null);
							$('.drag_hover_level').removeClass('drag_hover_level');

							let target = document.elementFromPoint(e2.clientX, e2.clientY);
							[drop_target, drop_target_node] = eventTargetToNode(target);
							if (drop_target) {
								let location = e2.clientY - $(drop_target_node).offset().top;
								order = getOrder(location, drop_target);

								let parent_target = order ? drop_target.parent : drop_target;
								if (canAddOutlinerSelectionTo(parent_target, item)) {
									drop_target_node.setAttribute('order', order)
									drop_target_node.classList.add('drag_hover');
									let parent_node = drop_target_node.parentElement.parentElement;
									if ((drop_target instanceof OutlinerElement || order) && parent_node && parent_node.classList.contains('outliner_node')) {
										parent_node.classList.add('drag_hover_level');
									}
								}

							} else if ($('#cubes_list').is(':hover') && canAddOutlinerSelectionTo('root', item)) {
								$('#cubes_list').addClass('drag_hover');
							} else if (Panels.collections.node.isConnected && Panels.collections.node.contains(target)) {
								for (let node of document.querySelectorAll('.collection')) {
									if (node.contains(target)) {
										node.classList.add('drag_hover');
										break;
									}
								}
							}
						}
						last_event = e2;
					}
					function off(e2) {
						if (helper) helper.remove();
						clearInterval(scrollIntervalID);
						removeEventListeners(document, 'mousemove touchmove', move);
						removeEventListeners(document, 'mouseup touchend', off);
						$('.drag_hover').removeClass('drag_hover');
						$('.outliner_node[order]').attr('order', null);
						$('.drag_hover_level').removeClass('drag_hover_level');
						if (Blockbench.isTouch) clearTimeout(timeout);

						if (active && !open_menu) {
							convertTouchEvent(e2);
							let target = document.elementFromPoint(e2.clientX, e2.clientY);
							[drop_target] = eventTargetToNode(target);
							if (drop_target) {
								let parent_target = order ? drop_target.parent : drop_target;
								if (canAddOutlinerSelectionTo(parent_target, item)) {
									moveOutlinerSelectionTo(item, drop_target, e2, order);
								}
							} else if ($('#cubes_list').is(':hover') && canAddOutlinerSelectionTo('root', item)) {
								moveOutlinerSelectionTo(item, undefined, e2);
							} else if (document.querySelector('.collection:hover')) {
								let collection_node = document.querySelector('.collection:hover');
								let collection_uuid = collection_node.attributes.uuid?.value;
								let collection = Collection.all.find(c => c.uuid == collection_uuid);
								if (collection) {
									moveOutlinerSelectionTo(item, collection, e2);
								}
							}
						}
					}

					if (Blockbench.isTouch) {
						timeout = setTimeout(() => {
							active = true;
							move(e1);
						}, 320)
					}

					addEventListeners(document, 'mousemove touchmove', move, {passive: false});
					addEventListeners(document, 'mouseup touchend', off, {passive: false});
				}
			},
			computed: {
				filtered_root() {
					if (!this.options.search_term) {
						return this.root;
					} else {
						let search_term_lowercase = this.options.search_term.toLowerCase();
						return this.root.filter(node => node.matchesFilter(search_term_lowercase))
					}
				}
			},
			template: `
				<div>
					<search-bar id="outliner_search_bar" class="panel_search_bar"
						v-if="search_enabled" v-model="options.search_term"
						@input="updateSearch()" onfocusout="Panels.outliner.vue.updateSearch()"
					/>
					<ul id="cubes_list"
						class="list mobile_scrollbar"
						@contextmenu.stop.prevent="openMenu($event)"
						@mousedown="dragNode($event)"
						@touchstart="dragNode($event)"
					>
						<vue-tree-item v-for="item in filtered_root" :node="item" :depth="0" :options="options" :key="item.uuid"></vue-tree-item>
					</ul>
				</div>
			`
		},
		menu: new Menu([
			new MenuSeparator('add_element'),
			{
				id: 'add_element',
				name: 'action.add_element',
				description: 'action.add_element.desc',
				icon: BarItems.add_element.icon,
				children: BarItems.add_element.side_menu.structure
			},
			'add_group',
			new MenuSeparator('copypaste'),
			'paste',
			new MenuSeparator('manage'),
			'select_all',
			'sort_outliner',
			'collapse_groups',
			'unfold_groups',
			'search_outliner',
			new MenuSeparator('options'),
			'element_colors',
			'outliner_toggle'
		])
	})
	Blockbench.onUpdateTo('5.0.0', () => {
		Toolbars.outliner.remove('add_cube');
		Toolbars.outliner.remove('add_mesh');
	})
	Outliner.vue = Interface.Panels.outliner.inside_vue;
	
	Blockbench.on('change_active_panel', ({last_panel, panel}) => {
		if (last_panel == 'outliner') {
			Interface.removeSuggestedModifierKey('ctrl', 'modifier_actions.select_multiple');
			Interface.removeSuggestedModifierKey('shift', 'modifier_actions.select_range');
			Interface.removeSuggestedModifierKey('alt', 'modifier_actions.drag_to_duplicate');
		}
		if (panel == 'outliner') {
			Interface.addSuggestedModifierKey('ctrl', 'modifier_actions.select_multiple');
			if (!Modes.animate) Interface.addSuggestedModifierKey('shift', 'modifier_actions.select_range');
			if (Modes.edit) Interface.addSuggestedModifierKey('alt', 'modifier_actions.drag_to_duplicate');
		}
	})
})

export class Face {
	constructor(data) {
		for (var key in this.constructor.properties) {
			this.constructor.properties[key].reset(this);
		}
	}
	extend(data) {
		for (var key in this.constructor.properties) {
			this.constructor.properties[key].merge(this, data)
		}
		if (data.texture === null) {
			this.texture = null;
		} else if (data.texture === false) {
			this.texture = false;
		} else if (Texture.all.includes(data.texture)) {
			this.texture = data.texture.uuid;
		} else if (typeof data.texture === 'string') {
			Merge.string(this, data, 'texture')
		}
		return this;
	}
	getTexture() {
		if (Format.per_group_texture && this.element.parent instanceof Group && this.element.parent.texture) {
			return Texture.all.findInArray('uuid', this.element.parent.texture);
		}
		if (this.texture !== null && (Format.single_texture || (Format.single_texture_default && (Format.per_group_texture || !this.texture)))) {
			return Texture.getDefault();
		}
		if (typeof this.texture === 'string') {
			return Texture.all.findInArray('uuid', this.texture)
		}
		return this.texture;
	}
	reset() {
		for (var key in Mesh.properties) {
			Mesh.properties[key].reset(this);
		}
		this.texture = false;
		return this;
	}
	getSaveCopy() {
		let copy = {
			uv: this.uv,
		}
		for (let key in this.constructor.properties) {
			if (this[key] != this.constructor.properties[key].default) this.constructor.properties[key].copy(this, copy);
		}
		let tex = this.getTexture()
		if (tex === null) {
			copy.texture = null;
		} else if (tex instanceof Texture && Blockbench.hasFlag('compiling_bbmodel')) {
			copy.texture = Texture.all.indexOf(tex);
		} else if (tex instanceof Texture) {
			copy.texture = tex.uuid;
		}
		return copy;
	}
	getUndoCopy() {
		var copy = new this.constructor(this.direction, this);
		delete copy.cube;
		delete copy.mesh;
		delete copy.direction;
		return copy;
	}
}
Object.assign(window, {
	Outliner,
	markerColors,
	OutlinerNode,
	OutlinerElement,
	NodePreviewController,
	compileGroups,
	parseGroups,
	moveOutlinerSelectionTo,
	canAddOutlinerNodesTo,
	canAddOutlinerSelectionTo,
	renameOutliner,
	stopRenameOutliner,
	toggleElementProperty,
	Face,
});
