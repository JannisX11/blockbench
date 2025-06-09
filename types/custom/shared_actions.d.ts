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
 *
 */
declare namespace SharedActions {
	const checks: {
		[id: SharedActionID]: SharedActionHandler
	}

	const actions: Record<string, Array<SharedActionHandler>>

	/**
	 * Add a new handler to a shared action
	 * @param action_id Action ID
	 * @param handler Handler options
	 */
	function add(action_id: SharedActionID, handler: SharedActionHandler): Deletable
	/**
	 * Run the active handler for a specific subject manually
	 * @param action_id Action ID
	 * @param event Event that triggered the interaction
	 * @param context Optional context variable
	 */
	function run(action_id: SharedActionID, event?: Event, context?: any): boolean
	/**
	 * Run a specific handler manually
	 * @param action_id Action ID
	 * @param subject Subject to run on
	 * @param event Event that triggered the interaction
	 * @param context Optional context variable
	 * @param force Force the specified handler to run and ignore its condition
	 */
	function runSpecific(
		action_id: SharedActionID,
		subject: string,
		event?: Event,
		context?: any,
		force?: boolean
	): boolean
	/**
	 * Check if there is an active and available handler in the current situation for a shared action
	 * @param action_id
	 */
	function condition(action_id: SharedActionID): boolean
	/**
	 * Find the active handler in the current situation for a shared action
	 * @param action_id
	 * @param event
	 * @param context
	 */
	function find(
		action_id: SharedActionID,
		event?: Event,
		context?: any
	): SharedActionHandler | null
}

interface SharedActionHandler {
	priority?: number
	subject: string
	condition: ConditionResolvable
	run: (event?: Event, context?: any) => void
}

type SharedActionID =
	| string
	| 'rename'
	| 'delete'
	| 'duplicate'
	| 'select_all'
	| 'unselect_all'
	| 'invert_selection'
