
class Locator extends NonGroup {
	constructor(data, uuid) {
		super(data, uuid);
		this.from = [0, 0, 0];
		this.name = 'locator';
		this.export = true;

		if (data) {
			this.extend(data);
		}
	}
	extend(object) {
		Merge.string(this, object, 'name');
		this.sanitizeName();
		Merge.boolean(this, object, 'export');
		if (object.from) {
			Merge.number(this.from, object.from, 0);
			Merge.number(this.from, object.from, 1);
			Merge.number(this.from, object.from, 2);
		}
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
	move(val, axis) {

		if (Blockbench.globalMovement) {
			var m = new THREE.Vector3();
			m[getAxisLetter(axis)] = val;
			if (this.parent instanceof Group) {
				var rotation = new THREE.Quaternion();
				this.parent.mesh.getWorldQuaternion(rotation);
				m.applyQuaternion(rotation.inverse());
			}

			this.from[0] += m.x;
			this.from[1] += m.y;
			this.from[2] += m.z;
		} else {
			this.from[axis] += val
		}
		TickUpdates.selection = true;
		return this;
	}
}
	Locator.prototype.title = tl('data.locator');
	Locator.prototype.type = 'locator';
	Locator.prototype.icon = 'fa fa-anchor';
	Locator.prototype.name_regex = 'a-zA-Z0-9_'
	Locator.prototype.movable = true;
	Locator.prototype.visibility = true;
	Locator.prototype.buttons = [
		Outliner.buttons.remove,
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
