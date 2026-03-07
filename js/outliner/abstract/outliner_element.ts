import { Blockbench } from "../../api";
import { Property } from "../../util/property";
import { OutlinerNode } from "./outliner_node";

type ElementTypeConstructor = {
	new (...args: any[]): OutlinerElement,
	init?(): void,
	properties: Record<string, Property<any>>
	behavior: any
	selected: OutlinerElement[]
}
interface OutlinerElementData {
	name?: string
}

export abstract class OutlinerElement extends OutlinerNode {
	allow_mirror_modeling?: boolean
	static animator?: BoneAnimator
	static isParent: false
	static all: OutlinerElement[]
	static selected: OutlinerElement[]

	constructor(data: OutlinerElementData, uuid?: string) {
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
		if ('animator' in (this.constructor as any)) {
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
	showContextMenu(event: MouseEvent) {
		if (this.locked) return this;
		if (!this.selected) {
			this.clickSelect(event)
		}
		this.menu.open(event, this)
		return this;
	}
	forSelected(fc: (element: OutlinerElement) => void, undo_tag?: string, selection_method?: 'all_selected' |'all_in_group') {
		let selected: OutlinerElement[] = (this.constructor as any).selected;
		let edited: OutlinerElement[] = selected;
		if (selected.length <= 1 || !selected.includes(this)) {
			edited = [this];
		}
		if (selection_method == 'all_in_group') {
			edited = edited.slice();
			edited.slice().forEach(element => {
				element.getParentArray().forEach(child => {
					if ('faces' in child) edited.safePush(child);
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
		let copy = new (this.constructor as ElementTypeConstructor)(this);
		//Numeration
		let number: number | undefined;
		let matches = copy.name.match(/[0-9]+$/);
		if (matches) {
			number = parseInt(matches[0]);
			copy.name = copy.name.split((number).toString()).join((number+1).toString())
		}
		if (Condition(this.getTypeBehavior('unique_name'))) {
			copy.temp_data.old_name = this.name;
		}
		//Rest
		let last_selected = this.getParentArray().findLast(el => el.selected || el == this);
		copy.sortInBefore(last_selected, 1).init();
		let index = Outliner.selected.indexOf(this)
		if (index >= 0) {
			Outliner.selected[index] = copy
		} else {
			Outliner.selected.push(copy)
		}
		Property.resetUniqueValues(this.constructor, copy);
		if (Condition(copy.getTypeBehavior('unique_name'))) {
			copy.createUniqueName()
		}
		if (copy.getTypeBehavior('parent')) {
			for (let child of this.children) {
				child.duplicate().addTo(copy)
			}
			(copy as OutlinerElement & OutlinerNodeParentTraits).isOpen = true;
			Canvas.updatePositions();
		}
		TickUpdates.selection = true;
		return copy;
	}
	select(event?: Event, is_outliner_click?: boolean): false | this {
		if (Modes.animate && !(this.constructor as typeof OutlinerElement).animator) {
			Blockbench.showQuickMessage('message.group_required_to_animate');
			return false;
		}
		Undo.initSelection();
		//Shift
		var just_selected = [];
		let allow_multi_select = (!Modes.paint || (Toolbox.selected.id == 'fill_tool' && (BarItems.fill_mode as BarSelect).value == 'selected_elements'));
		if (
			event &&
			allow_multi_select &&
			(event.shiftKey === true || Pressing.overrides.shift) &&
			this.getParentArray().includes(Outliner.selected.last() as OutlinerElement) &&
			is_outliner_click
		) {
			var starting_point: boolean;
			var last_selected = Outliner.selected.last();
			this.getParentArray().forEach((s, i) => {
				if ((s as OutlinerElement) === last_selected || s === this) {
					if (starting_point) {
						starting_point = false
					} else {
						starting_point = true
					}
					if (s.type !== 'group') {
						if (!Outliner.selected.includes(s as OutlinerElement)) {
							s.markAsSelected(true)
							just_selected.push(s)
						}
					} else {
						s.markAsSelected(true)
					}
				} else if (starting_point) {
					if (s.type !== 'group') {
						if (!Outliner.selected.includes(s as OutlinerElement)) {
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
	clickSelect(event, outliner_click?: boolean) {
		if (Blockbench.hasFlag('renaming')) return;
		Undo.initSelection();
		let result = this.select(event, outliner_click);
		if (result === false) {
			Undo.cancelSelection();
			return;
		}
		Undo.finishSelection('Select element');
	}
	markAsSelected(select_children?: boolean) {
		Project.selected_elements.safePush(this);
		this.selected = true;
		TickUpdates.selection = true;
		return this;
	}
	unselect(unselect_parent?: boolean) {
		Project.selected_elements.remove(this);
		this.selected = false;
		if (UVEditor.selected_element_faces[this.uuid]) {
			delete UVEditor.selected_element_faces[this.uuid];
		}
		if (unselect_parent &&
			this.parent instanceof OutlinerNode &&
			this.parent.selected &&
			this.parent.getTypeBehavior('select_children') != 'self_first'
		) {
			this.parent.unselect(unselect_parent);
		}
		TickUpdates.selection = true;
		return this;
	}
	getUndoCopy(): any {
		let copy = new (this.constructor as ElementTypeConstructor)(this)
		copy.uuid = this.uuid
		copy.type = this.type;
		delete copy.parent;
		return copy;
	}
	getSaveCopy(): any {
		let save: any = {};
		for (let key in (this.constructor as typeof OutlinerElement).properties) {
			(this.constructor as typeof OutlinerElement).properties[key].copy(this, save)
		}
		save.export = this.export ? undefined : false;
		save.uuid = this.uuid;
		save.type = this.type;
		return save;
	}

	
	static fromSave(obj: any, keep_uuid: boolean = false): OutlinerElement {
		let Type = (OutlinerElement.types[obj.type] || Cube) as ElementTypeConstructor;
		if (Type) {
			return new Type(obj, keep_uuid ? obj.uuid : 0).init()
		}
	}
	static isTypePermitted(type: string): boolean {
		return !(
			(type == 'locator' && !Format.locators) ||
			(type == 'mesh' && !Format.meshes) ||
			(type == 'spline' && !Format.splines)
		)
	}
	/**Check if any elements of the type are in the project */
	static hasAny() {
		return Outliner.elements.length > 0 && Outliner.elements.findIndex(element => element instanceof this) !== -1;
	}
	/**Check if any elements of the type are currently selected */
	static hasSelected() {
		return Outliner.selected.length > 0 && Outliner.selected.findIndex(element => element instanceof this) !== -1;
	}
	static types: Record<string, ElementTypeConstructor> = {};


	
	static registerType(constructor: ElementTypeConstructor, id: string) {
		OutlinerElement.types[id] = constructor;
		constructor.prototype.type = id;
		if (!constructor.behavior) constructor.behavior = {};
		
		if (!constructor.properties?.name) new Property(constructor, 'string', 'name');
		if (!constructor.properties?.export) new Property(constructor, 'boolean', 'export', {default: true});
		if (!constructor.properties?.locked) new Property(constructor, 'boolean', 'locked', {default: false});
		if (!constructor.properties?.scope) new Property(constructor, 'number', 'scope');

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

const global = {
	OutlinerElement
}
declare global {
	type OutlinerElement = import('./outliner_element').OutlinerElement
	const OutlinerElement: typeof global.OutlinerElement
}
Object.assign(window, global);
