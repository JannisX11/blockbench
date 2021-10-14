
class NullObject extends OutlinerElement {
	constructor(data, uuid) {
		super(data, uuid);
		this.ik_enabled = false;
		this.ik_chain_length = 0;

		for (var key in NullObject.properties) {
			NullObject.properties[key].reset(this);
		}

		if (data) {
			this.extend(data);
		}
	}
	get origin() {
		return this.from;
	}
	extend(object) {
		for (var key in NullObject.properties) {
			NullObject.properties[key].merge(this, object)
		}
		this.sanitizeName();
		//Merge.boolean(this, object, 'export');
		return this;
	}
	getUndoCopy() {
		var copy = new NullObject(this)
		copy.uuid = this.uuid
		copy.type = this.type;
		delete copy.parent;
		return copy;
	}
	getSaveCopy() {
		let save = {};
		for (var key in NullObject.properties) {
			NullObject.properties[key].copy(this, save)
		}
		//save.export = this.export ? undefined : false;
		save.uuid = this.uuid;
		save.type = 'null_object';
		return save;
	}
	init() {
		if (this.parent instanceof Group == false) {
			this.addTo(Group.selected)
		}
		super.init();
		return this;
	}
	flip(axis, center) {
		var offset = this.from[axis] - center
		this.from[axis] = center - offset;
		// Name
		if (axis == 0 && this.name.includes('right')) {
			this.name = this.name.replace(/right/g, 'left').replace(/2$/, '');
		} else if (axis == 0 && this.name.includes('left')) {
			this.name = this.name.replace(/left/g, 'right').replace(/2$/, '');
		}
		this.createUniqueName();
		return this;
	}
	getWorldCenter() {
		var pos = Reusable.vec1.set(0, 0, 0);
		var q = Reusable.quat1.set(0, 0, 0, 1);
		if (this.parent instanceof Group) {
			THREE.fastWorldPosition(this.parent.mesh, pos);
			this.parent.mesh.getWorldQuaternion(q);
			var offset2 = Reusable.vec2.fromArray(this.parent.origin).applyQuaternion(q);
			pos.sub(offset2);
		}
		var offset = Reusable.vec3.fromArray(this.from).applyQuaternion(q);
		pos.add(offset);

		return pos;
	}
}
	NullObject.prototype.title = tl('data.null_object');
	NullObject.prototype.type = 'null_object';
	NullObject.prototype.icon = 'fa far fa-circle';
	//NullObject.prototype.name_regex = 'a-z0-9_'
	NullObject.prototype.movable = true;
	NullObject.prototype.visibility = true;
	NullObject.prototype.buttons = [
		//Outliner.buttons.export,
		Outliner.buttons.locked,
	];
	//NullObject.prototype.needsUniqueName = true;
	NullObject.prototype.menu = new Menu([
			'group_elements',
			'_',
			'copy',
			'paste',
			'duplicate',
			'_',
			'rename',
			'delete'
		])
	
	new Property(NullObject, 'string', 'name', {default: 'null_object'})
	new Property(NullObject, 'vector', 'from')
	new Property(NullObject, 'boolean', 'ik_enabled', {condition: () => Format.animation_mode});
	new Property(NullObject, 'number', 'ik_chain_length', {condition: () => Format.animation_mode});
	new Property(NullObject, 'boolean', 'locked');
	
	OutlinerElement.registerType(NullObject, 'null_object');

	new NodePreviewController(NullObject)

BARS.defineActions(function() {
	new Action('add_null_object', {
		icon: 'far.fa-circle',
		category: 'edit',
		condition: () => Format.animation_mode,
		click: function () {
			var objs = []
			Undo.initEdit({elements: objs, outliner: true});
			var null_object = new NullObject().addTo(Group.selected||selected[0]).init();
			null_object.select();
			objs.push(null_object);
			Undo.finishEdit('Add null object');
			Vue.nextTick(function() {
				if (settings.create_rename.value) {
					null_object.rename();
				}
			})
		}
	})
})
