
class Locator extends NonGroup {
	constructor(data, uuid) {
		super(data, uuid);

		for (var key in Locator.properties) {
			Locator.properties[key].reset(this);
		}

		if (data) {
			this.extend(data);
		}
	}
	extend(object) {
		for (var key in Locator.properties) {
			Locator.properties[key].merge(this, object)
		}
		this.sanitizeName();
		Merge.boolean(this, object, 'locked')
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
		save.locked = this.locked;
		save.uuid = this.uuid;
		save.type = 'locator';
		return save;
	}
	init() {
		if (this.parent instanceof Group == false) {
			this.addTo(Group.selected)
		}
		super.init();
		TickUpdates.outliner = true;
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
		var pos = new THREE.Vector3();
		var q = new THREE.Quaternion();
		if (this.parent instanceof Group) {
			THREE.fastWorldPosition(this.parent.mesh, pos);
			this.parent.mesh.getWorldQuaternion(q);
			var offset2 = new THREE.Vector3().fromArray(this.parent.origin).applyQuaternion(q);
			pos.sub(offset2);
		}
		var offset = new THREE.Vector3().fromArray(this.from).applyQuaternion(q);
		pos.add(offset);

		return pos;
	}
}
	Locator.prototype.title = tl('data.locator');
	Locator.prototype.type = 'locator';
	Locator.prototype.icon = 'fa fa-anchor';
	Locator.prototype.name_regex = 'a-z0-9_'
	Locator.prototype.movable = true;
	Locator.prototype.visibility = true;
	Locator.prototype.buttons = [
		Outliner.buttons.locked,
		Outliner.buttons.export
	];
	Locator.prototype.needsUniqueName = true;
	Locator.prototype.menu = new Menu([
			'copy',
			'rename',
			'delete'
		])
	Locator.selected = [];
	Locator.all = [];
	
	new Property(Locator, 'string', 'name', {default: 'locator'})
	new Property(Locator, 'vector', 'from')

BARS.defineActions(function() {
	new Action('add_locator', {
		icon: 'fa-anchor',
		category: 'edit',
		condition: () => {return Format.locators && Modes.edit},
		click: function () {
			var objs = []
			Undo.initEdit({elements: objs, outliner: true});
			var locator = new Locator().addTo(Group.selected||selected[0]).init();
			locator.select().createUniqueName();
			objs.push(locator);
			Undo.finishEdit('add locator');
		}
	})
})
