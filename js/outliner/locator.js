
class Locator extends OutlinerElement {
	constructor(data, uuid) {
		super(data, uuid);

		for (var key in Locator.properties) {
			Locator.properties[key].reset(this);
		}

		if (data) {
			this.extend(data);
		}
	}
	get origin() {
		return this.position;
	}
	extend(object) {
		if (object.from) this.position.V3_set(object.from);
		for (var key in Locator.properties) {
			Locator.properties[key].merge(this, object)
		}
		this.sanitizeName();
		Merge.boolean(this, object, 'export');
		return this;
	}
	getUndoCopy() {
		var copy = new Locator(this)
		copy.uuid = this.uuid
		copy.type = this.type;
		delete copy.parent;
		return copy;
	}
	getSaveCopy() {
		let save = {};
		for (var key in Locator.properties) {
			Locator.properties[key].copy(this, save)
		}
		save.export = this.export ? undefined : false;
		save.uuid = this.uuid;
		save.type = 'locator';
		return save;
	}
	init() {
		if (this.parent instanceof Group == false) {
			this.addTo(Group.first_selected)
		}
		super.init();
		return this;
	}
	flip(axis, center) {
		var offset = this.position[axis] - center
		this.position[axis] = center - offset;
		this.rotation.forEach((n, i) => {
			if (i != axis) this.rotation[i] = -n;
		})
		// Name
		flipNameOnAxis(this, axis);

		this.createUniqueName();
		this.preview_controller.updateTransform(this);
		return this;
	}
	getWorldCenter() {
		var pos = new THREE.Vector3();
		var q = Reusable.quat1.set(0, 0, 0, 1);
		if (this.parent instanceof Group) {
			THREE.fastWorldPosition(this.parent.mesh, pos);
			this.parent.mesh.getWorldQuaternion(q);
			var offset2 = Reusable.vec2.fromArray(this.parent.origin).applyQuaternion(q);
			pos.sub(offset2);
		}
		var offset = Reusable.vec3.fromArray(this.position).applyQuaternion(q);
		pos.add(offset);

		return pos;
	}
}
	Locator.prototype.title = tl('data.locator');
	Locator.prototype.type = 'locator';
	Locator.prototype.icon = 'fa-anchor';
	Locator.prototype.name_regex = () => Format.node_name_regex ?? 'a-zA-Z0-9_',
	Locator.prototype.movable = true;
	Locator.prototype.rotatable = true;
	Locator.prototype.visibility = true;
	Locator.prototype.buttons = [
		Outliner.buttons.export,
		Outliner.buttons.locked,
		Outliner.buttons.visibility,
	];
	Locator.prototype.needsUniqueName = true;
	Locator.prototype.menu = new Menu([
			...Outliner.control_menu_group,
			new MenuSeparator('settings'),
			{
				id: 'ignore_inherited_scale',
				name: 'menu.locator.ignore_inherited_scale',
				icon: locator => locator.ignore_inherited_scale ? 'check_box' : 'check_box_outline_blank',
				click(clicked_locator) {
					let value = !clicked_locator.ignore_inherited_scale;
					let affected = Locator.selected.filter(locator => locator.ignore_inherited_scale != value);
					Undo.initEdit({elements: affected});
					affected.forEach(locator => {
						locator.ignore_inherited_scale = value;
					})
					Undo.finishEdit('Change locator ignore inherit scale option');
				}
			},
			new MenuSeparator('manage'),
			'rename',
			'toggle_visibility',
			'delete'
		])
	
new Property(Locator, 'string', 'name', {default: 'locator'})
new Property(Locator, 'vector', 'position')
new Property(Locator, 'vector', 'rotation')
new Property(Locator, 'boolean', 'ignore_inherited_scale')
new Property(Locator, 'boolean', 'visibility', {default: true});
new Property(Locator, 'boolean', 'locked');

OutlinerElement.registerType(Locator, 'locator');

(function() {

	const map = new THREE.TextureLoader().load( 'assets/locator.png' );
	map.magFilter = map.minFilter = THREE.NearestFilter;

	new NodePreviewController(Locator, {
		setup(element) {
			let mesh = new THREE.Object3D();
			Project.nodes_3d[element.uuid] = mesh;
			mesh.name = element.uuid;
			mesh.type = element.type;
			mesh.isElement = true;
			mesh.visible = element.visibility;
			mesh.rotation.order = 'ZYX';

			let material = new THREE.SpriteMaterial({
				map,
				alphaTest: 0.1,
				sizeAttenuation: false
			});
			let sprite = new THREE.Sprite(material);
			sprite.name = element.uuid;
			sprite.type = element.type;
			sprite.isElement = true;
			mesh.add(sprite);
			mesh.sprite = sprite;

			this.updateTransform(element);

			this.dispatchEvent('setup', {element});
		},
		updateTransform(element) {
			NodePreviewController.prototype.updateTransform.call(this, element);
			this.updateWindowSize(element);
		},
		updateSelection(element) {
			let {mesh} = element;

			mesh.sprite.material.color.set(element.selected ? gizmo_colors.outline : CustomTheme.data.colors.text);
			mesh.sprite.material.depthTest = !element.selected;
			mesh.renderOrder = element.selected ? 100 : 0;

			this.dispatchEvent('update_selection', {element});
		},
		updateWindowSize(element) {
			let size = 0.4 * Preview.selected.camera.fov / Preview.selected.height;
			element.mesh.sprite.scale.set(size, size, size);
		}
	})

	let locator_suggestion_list = $('<datalist id="locator_suggestion_list" hidden></datalist>').get(0);
	document.body.append(locator_suggestion_list);
	
	Locator.updateAutocompleteList = function() {
		locator_suggestion_list.innerHTML = '';
		Locator.all.forEach(locator => {
			let option = document.createElement('option');
			option.value = locator.name;
			locator_suggestion_list.append(option);
		})
	}

})()


BARS.defineActions(function() {
	new Action('add_locator', {
		icon: 'fa-anchor',
		category: 'edit',
		condition: () => {return Format.locators && Modes.edit},
		click: function () {
			var objs = []
			Undo.initEdit({elements: objs, outliner: true});
			var locator = new Locator().addTo(Group.first_selected||selected[0]).init();
			locator.select().createUniqueName();
			objs.push(locator);
			Undo.finishEdit('Add locator');
			Vue.nextTick(function() {
				if (settings.create_rename.value) {
					locator.rename();
				}
			})
		}
	})
})
