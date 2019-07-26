
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
		Merge.string(this, object, 'name')
		Merge.boolean(this, object, 'export')
		if (object.from) {
			Merge.number(this.from, object.from, 0)
			Merge.number(this.from, object.from, 1)
			Merge.number(this.from, object.from, 2)
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
	move(val, axis, absolute) {
		if (absolute) {
			this.from[axis] = val
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
Locator.prototype.movable = true;
Locator.prototype.visibility = true;
Locator.prototype.buttons = [
	Outliner.buttons.remove,
	Outliner.buttons.export
];
Locator.prototype.menu = new Menu([
		'copy',
		'rename',
		'delete'
	])
Locator.selected = [];
Locator.all = [];

BARS.defineActions(function() {
	new Action({
		id: 'add_locator',
		icon: 'fa-anchor',
		category: 'edit',
		condition: () => {return Format.locators && Modes.edit},
		click: function () {
			var elements = []
			Undo.initEdit({elements, outliner: true});
			elements.push(new Locator().addTo(Group.selected||selected[0]).init().select());
			Undo.finishEdit('add locator');
		}
	})
})
