import { nextTick } from "vue"
import { Blockbench } from "../../api"
import { Vue } from "../../lib/libs"
import { Property } from "../../util/property"

export abstract class OutlinerNode {

	name: string
	uuid: UUID
	export: boolean
	locked: boolean
	scope: number
	parent: (OutlinerNode & OutlinerNodeParentTraits) | 'root'
	selected: boolean
	readonly _static: {
		properties: any
		temp_data: Record<string, any>
	}
	declare children?: OutlinerNode[]
	declare menu?: Menu
	declare type: string

	public name_regex: ((element?: OutlinerNode) => string | boolean) | undefined = undefined;

	static animator?: BoneAnimator
	static isParent: false
	static all: OutlinerNode[]
	static selected: OutlinerNode[]
	static preview_controller: NodePreviewController
	static properties: Record<string, Property<any>>
	static behavior: Record<string, any>
	constructor(uuid: UUID) {
		this.uuid = uuid || guid()
		this.export = true;
		this.locked = false;
		this.scope = 0;
		
		this._static = Object.freeze({
			properties: {},
			temp_data: {},
		});
	}
	/**
	 * Initializes the node. This should always be called when creating nodes that will be used in the outliner.
	 */
	init(): this {
		OutlinerNode.uuids[this.uuid] = this;
		if (!this.parent || (this.parent === 'root' && Outliner.root.indexOf(this) === -1)) {
			this.addTo('root')
		}
		return this;
	}
	extend?(data: any): void
	select(event?: Event, outliner_click?: boolean): false | this {
		return false;
	}
	unselect(unselect_parent?: boolean) {}
	clickSelect(event: MouseEvent, outliner_click?: boolean) {}
	getTypeBehavior(flag: string): boolean | string | any {
		// @ts-ignore
		let constructor = (this.type == 'group' ? Group : OutlinerElement.types[this.type]) as typeof OutlinerNode;
		if (!constructor) return;
		for (let override of constructor.behavior_overrides) {
			if (Condition(override.condition)) {
				if (override.behavior[flag] != undefined) return override.behavior[flag];
			}
		}
		return constructor.behavior[flag];
	}
	//Sorting
	sortInBefore(element?: OutlinerNode, index_modifier?: number): this {
		if (this.getTypeBehavior('parent_types')) {
			let types = this.getTypeBehavior('parent_types');
			let is_allowed = (element.parent == 'root' && types.includes('root')) |
				(element.parent instanceof OutlinerNode && types.includes(element.parent.type));
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
			arr.splice(index + index_modifier, 0, this)
		}
		return this;
	}
	addTo(target?: OutlinerNode | 'root', index: number = -1): this {
		//Resolve Group Argument
		if (!target) {
			target = 'root'
		} else if (target !== 'root') {
			if ('children' in target == false) {
				if (target.parent === 'root') {
					index = Outliner.root.indexOf(target)+1
					target = 'root'
				} else {
					index = target.parent.children.indexOf(target)+1
					target = target.parent
				}
			}
		}
		
		if (this.getTypeBehavior('parent_types')) {
			let types = this.getTypeBehavior('parent_types');
			let is_allowed = (target == 'root' && types.includes('root')) ||
					(target instanceof OutlinerNode && types.includes(target.type));
			if (!is_allowed) return;
		}

		this.removeFromParent()
		//Get Array
		let arr;
		if (target === 'root') {
			arr = Outliner.root
			this.parent = 'root'
		} else if ('children' in target) {
			arr = target.children;
			this.parent = target as OutlinerNode & OutlinerNodeParentTraits;
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
	getParentArray(): OutlinerNode[] {
		if (this.parent === 'root') {
			return Outliner.root as OutlinerNode[];
		} else if (typeof this.parent === 'object') {
			return this.parent.children;
		}
	}
	getAllAncestors(): OutlinerNode[] {
		let list: OutlinerNode[] = [];
		let parent = this.parent;
		while (parent instanceof OutlinerNode) {
			if (list.includes(parent)) break;
			list.push(parent);
			parent = parent.parent;
		}
		return list;
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
	/**
	 * Unfolds the outliner and scrolls up or down if necessary to show the group or element.
	 */
	showInOutliner() {
		var scope = this;
		if (this.parent !== 'root') {
			this.parent.openUp()
		}
		nextTick(() => {
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
	/**
	 * Updates the Vue node of the element. This is only necessary in some rare situations
	 */
	updateElement(): this {
		var scope = this;
		var old_name = this.name;
		scope.name = '_&/3%6-7A';
		scope.name = old_name;
		return this;
	}
	get mesh() {
		return Project.nodes_3d[this.uuid];
	}
	get scene_object(): THREE.Object3D {
		return Project.nodes_3d[this.uuid];
	}
	get temp_data(): Record<string, any> {
		return this._static.temp_data;
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
	duplicate(): OutlinerNode {
		return null as OutlinerNode;
	}
	/**
	 * Removes the node.
	 */
	remove(remove_children?: boolean) {
		if (this.preview_controller) this.preview_controller.remove(this);
		if (OutlinerNode.uuids[this.uuid] == this) delete OutlinerNode.uuids[this.uuid];
		this.removeFromParent();
	}
	/**
	 * Marks the name of the group or element in the outliner for renaming.
	 */
	rename() {
		this.showInOutliner();
		let node = document.getElementById(this.uuid);
		let input_element = node?.querySelector('div.outliner_object > input.cube_name') as HTMLInputElement;
		if (!input_element) return this;
		input_element.removeAttribute('disabled');
		input_element.classList.add('renaming');
		input_element.select();
		input_element.focus();
		Blockbench.addFlag('renaming');
		this.temp_data.old_name = this.name;
		return this;
	}
	/**
	 * Saves the changed name of the element by creating an undo point and making the name unique if necessary.
	 */
	saveName(save: boolean = true): this {
		if (save !== false && this.name.trim().length > 0 && this.name != this.temp_data.old_name) {
			let name = this.name.trim();
			this.name = this.temp_data.old_name;
			if (this instanceof OutlinerElement) {
				Undo.initEdit({elements: [this], mirror_modeling: false});
			} else if (this instanceof Group) {
				Undo.initEdit({groups: [this], mirror_modeling: false});
			}
			if ((this.constructor as typeof OutlinerElement).animator) {
				// @ts-expect-error
				Animation.all.forEach((animation) => {
					if (animation.animators[this.uuid] && animation.animators[this.uuid].keyframes.length) {
						animation.saved = false;
					}
				})
			}
			this.name = name
			this.sanitizeName();
			delete this.temp_data.old_name
			if (Condition(this.getTypeBehavior('unique_name'))) {
				this.createUniqueName()
			}
			Undo.finishEdit('Rename element')
		} else {
			this.name = this.temp_data.old_name
			delete this.temp_data.old_name
		}
		return this;
	}
	sanitizeName(): string {
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
		return this.name;
	}
	/**
	 * Create a unique name for the group or element by adding a number at the end or increasing it.
	 */
	createUniqueName(additional?: OutlinerNode[]): string | false {
		if (!Condition(this.getTypeBehavior('unique_name'))) return;
		var scope = this;
		let others = (this.constructor as typeof OutlinerNode).all.filter(node => node.scope == this.scope);
		if (additional && additional.length) {
			additional.forEach(g => {
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
	isIconEnabled(toggle): true {
		if (typeof toggle.getState == 'function') {
			return toggle.getState(this);
		} else if (this[toggle.id] !== undefined) {
			return this[toggle.id];
		} else {
			return true;
		}
	}
	matchesFilter(search_term_lowercase: string): boolean {
		if (this.name.toLowerCase().includes(search_term_lowercase)) return true;
		if ('children' in this) {
			return this.children.some(child => child.matchesFilter(search_term_lowercase));
		}
		return false;
	}
	/**
	 * Checks of the group or element is a child of `group`.
	 * @param max_levels The maximum number of generations that can be between the element and the group
	 */
	isChildOf(node: OutlinerNode, max_levels: number): boolean {
		function iterate(obj: OutlinerNode | 'root', level: number) {
			if (!obj || obj === 'root') {
				return false;
			} else if (obj === node) {
				return true;
			} else if (!max_levels || level < max_levels-1) {
				return iterate(obj.parent, level+1)
			}
			return false;
		}
		return iterate(this.parent, 0)
	}
	

	get preview_controller(): NodePreviewController {
		return (this.constructor as typeof OutlinerNode).preview_controller;
	}

	/**
	 * Mark the element as selected
	 */
	markAsSelected(descendants?: boolean): void {}

	/**
	 * Displays the context menu of the element
	 * @param event Mouse event, determines where the context menu spawns.
	 */
	showContexMenu(event: Event | HTMLElement): this {
		return this;
	}
	getSaveCopy?(...args: any[]): Record<string, any>

	static addBehaviorOverride(override_options: {condition: ConditionResolvable, priority?: number, behavior: Record<string, any>}): Deletable {
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

	static uuids: {
		[uuid: UUID]: OutlinerNode
	}
}

const global = {
	OutlinerNode
}
declare global {
	type OutlinerNode = import('./outliner_node').OutlinerNode
	const OutlinerNode: typeof global.OutlinerNode
}
Object.assign(window, global);
