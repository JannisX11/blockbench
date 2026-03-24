/**
 * Shared Actions is a system in Blockbench to allow actions (including in toolbars, menus, via action control, or keybinding) to run different code in different cases, such as in different modes or different panels.
 * As an example, the "Duplicate" action runs code to duplicate elements when used in the outliner, and duplicates textures when used in the textures panel.
 *
 *
 * Handlers can be added for existing actions like this:

### Example:
```javascript
	// Duplicate layers when using "Duplicate" in the layers panel
	SharedActions.add('duplicate', {
		subject: 'layer',
		condition: () => Prop.active_panel == 'layers' && TextureLayer.selected,
		run() {
			let texture = Texture.selected;
			let original = texture.getActiveLayer();
			let copy = original.getUndoCopy(true);
			copy.name += '-copy';
			Undo.initEdit({textures: [texture]});
			let layer = new TextureLayer(copy, texture);
			layer.addForEditing();
			Undo.finishEdit('Duplicate layer');
		}
	})
```
 */
export const SharedActions = {
	/**
	 * Add a method to handle a specific use case of a shared action
	 * @param action_id Action ID
	 * @param handler Handler options
	 */
	add(action_id: SharedActionID, handler: SharedActionHandler): Deletable {
		if (!SharedActions.actions[action_id]) SharedActions.actions[action_id] = [];
		let list = SharedActions.actions[action_id];

		if (!handler.priority) handler.priority = 0;
		list.push(handler);
		list.sort((a, b) => (b.priority - a.priority));

		return {
			delete() {
				list.remove(handler);
			}
		}
	},
	/**
	 * Run the active handler for a specific subject manually
	 * @param action_id Action ID
	 * @param event Event that triggered the interaction
	 * @param context Optional context variable
	 */
	run(action_id: SharedActionID, event?: Event, context?: any): boolean {
		let list = SharedActions.actions[action_id];
		if (!list) return;
		for (let handler of list) {
			if (Condition(handler.condition)) {
				handler.run(event, context);
				return true;
			}
		}
		return false;
	},
	/**
	 * Run a specific handler manually
	 * @param action_id Action ID
	 * @param subject Subject to run on
	 * @param event Event that triggered the interaction
	 * @param context Optional context variable
	 * @param force Force the specified handler to run and ignore its condition
	 */
	runSpecific(
		action_id: SharedActionID,
		subject: string,
		event?: Event,
		context?: any,
		force?: boolean
	): boolean {
		let list = SharedActions.actions[action_id];
		if (!list) return;
		for (let handler of list) {
			if (handler.subject == subject && (force || Condition(handler.condition))) {
				handler.run(event, context);
				return true;
			}
		}
		return false;
	},
	/**
	 * Check if there is an active and available handler in the current situation for a shared action
	 * @param action_id
	 */
	condition(action_id: SharedActionID): boolean {
		let list = SharedActions.actions[action_id];
		if (!list) return;
		for (let handler of list) {
			if (Condition(handler.condition)) {
				return true;
			}
		}
		return false;
	},
	/**
	 * Find the active handler in the current situation for a shared action
	 * @param action_id
	 * @param event
	 * @param context
	 */
	find(
		action_id: SharedActionID,
		event?: Event,
		context?: any
	): SharedActionHandler | null {
		let list = SharedActions.actions[action_id];
		if (!list) return;
		for (let handler of list) {
			if (Condition(handler.condition, context)) {
				return handler;
			}
		}
		return null;
	},
	actions: {} as Record<string, SharedActionHandler[]>
};

export interface SharedActionHandler {
	condition: ConditionResolvable
	/**
	 * Subject type
	 */
	subject: string
	/**
	 * Handler priority
	 * Unset or 0 is typically used for relatively specific handlers, like those that check for a specific active panel.
	 * Higher priorities are used for even more specific conditions, like when multiple handlers work in a panel.
	 * Lower priorities are used for more fallback-like handlers, like deleting elements in edit mode, regardless of active panel.
	 */
	priority?: number
	/**
	 * Function running the handler
	 */
	run(event: Event, context: any): void
}
type SharedActionID =
	| string
	| 'rename'
	| 'delete'
	| 'duplicate'
	| 'select_all'
	| 'unselect_all'
	| 'invert_selection'

BARS.defineActions(() => {
	new Action('rename', {
		icon: 'text_format',
		category: 'edit',
		keybind: new Keybind({key: 113}),
		click() {
			SharedActions.run('rename');
		}
	})
	Blockbench.onUpdateTo('5.1.0-beta.0', () => {
		const isMac = SystemInfo?.platform == 'darwin' || navigator.userAgent.includes('Mac OS');
		if (!isMac) return;
		delete Keybinds.stored.delete;
	})
	new Action('delete', {
		icon: 'delete',
		category: 'edit',
		keybind: new Keybind({key: 46}, {
			keep_vertices: 'alt'
		}),
		variations: {
			keep_vertices: {name: 'action.delete.keep_vertices'}
		},
		condition: () => !Dialog.open,
		click(event) {
			SharedActions.run('delete', event);
		}
	})
	new Action('duplicate', {
		icon: 'content_copy',
		category: 'edit',
		condition: () => SharedActions.condition('duplicate'),
		keybind: new Keybind({key: 'd', ctrl: true}),
		click(event) {
			SharedActions.run('duplicate', event);
		}
	})
	new Action('select_all', {
		icon: 'select_all',
		category: 'select',
		condition: () => !Modes.display,
		keybind: new Keybind({key: 'a', ctrl: true}),
		click(event) {
			SharedActions.run('select_all', event);
			Blockbench.dispatchEvent('select_all', {});
		}
	})
	new Action('unselect_all', {
		icon: 'border_clear',
		category: 'select',
		condition: () => !Modes.display,
		click(event) {
			SharedActions.run('unselect_all', event);
			Blockbench.dispatchEvent('unselect_all', {});
		}
	})
	new Action('invert_selection', {
		icon: 'swap_vert',
		category: 'select',
		keybind: new Keybind({key: 'i', ctrl: true}),
		click(event) {
			SharedActions.run('invert_selection', event);
			Blockbench.dispatchEvent('invert_selection', {});
		}
	})
})

const global = {SharedActions};
declare global {
	const SharedActions: typeof global.SharedActions;
}
Object.assign(window, global);
