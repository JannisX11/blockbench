
class Locator extends NonGroup {
	constructor(data, uuid) {
		super(data, uuid);
		this.from = new Array().V3_set(0, 0, 0);
		this.name = 'locator';

		if (data) {
			this.extend(data);
		}
	}
	extend(object) {
		Merge.string(this, object, 'name');
		this.sanitizeName();
		Merge.boolean(this, object, 'locked')
		Merge.boolean(this, object, 'export');
		Merge.arrayVector(this, object, 'from');
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
		var el = {
			name: this.name,
			export: this.export ? undefined : false,
			locked: this.locked,
			from: this.from,
			uuid: this.uuid,
			type: 'locator'
		};
		return el;
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
		return this;
	}
	getWorldCenter() {
		var pos = new THREE.Vector3();
		var q = new THREE.Quaternion();
		if (this.parent instanceof Group) {
			this.parent.mesh.getWorldPosition(pos);
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
