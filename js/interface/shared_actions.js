const SharedActions = {
	/**
	 * Add a method to handle a specific use case of a shared action
	 * @param {('delete'|'rename'|'duplicate'|'select_all'|'unselect_all')} action_id 
	 * @param {Object} handler Case handler
	 * @param {*} handler.condition Condition
	 * @param {number} handler.priority Handler priority.
	 * 		Unset or 0 is typically used for relatively specific handlers, like those that check for a specific active panel.
	 * 		Higher priorities are used for even more specific conditions, like when multiple handlers work in a panel.
	 * 		Lower priorities are used for more fallback-like handlers, like deleting elements in edit mode, regardless of active panel.
	 * @param {function} handler.run 
	 * @returns 
	 */
	add(action_id, handler) {
		if (!this.actions[action_id]) this.actions[action_id] = [];
		let list = this.actions[action_id];

		if (!handler.priority) handler.priority = 0;
		list.push(handler);
		list.sort((a, b) => (b.priority - a.priority));

		return {
			delete() {
				list.remove(handler);
			}
		}
	},
	run(action_id, event, context) {
		let list = this.actions[action_id];
		if (!list) return;
		for (let handler of list) {
			if (Condition(handler.condition)) {
				handler.run(event, context);
				return true;
			}
		}
		return false;
	},
	runSpecific(action_id, subject, event, context, force) {
		let list = this.actions[action_id];
		if (!list) return;
		for (let handler of list) {
			if (handler.subject == subject && (force || Condition(handler.condition))) {
				handler.run(event, context);
				return true;
			}
		}
		return false;
	},
	condition(action_id) {
		let list = this.actions[action_id];
		if (!list) return;
		for (let handler of list) {
			if (Condition(handler.condition)) {
				return true;
			}
		}
		return false;
	},
	find(action_id, event, context) {
		let list = this.actions[action_id];
		if (!list) return;
		for (let handler of list) {
			if (Condition(handler.condition, context)) {
				return handler;
			}
		}
		return null;
	},
	actions: {}
};


BARS.defineActions(() => {
	new Action('rename', {
		icon: 'text_format',
		category: 'edit',
		keybind: new Keybind({key: 113}),
		click() {
			SharedActions.run('rename');
		}
	})
	new Action('delete', {
		icon: 'delete',
		category: 'edit',
		keybind: new Keybind({key: 46}),
		condition: () => !Dialog.open,
		click() {
			SharedActions.run('delete');
		}
	})
	new Action('duplicate', {
		icon: 'content_copy',
		category: 'edit',
		condition: () => SharedActions.condition('duplicate'),
		keybind: new Keybind({key: 'd', ctrl: true}),
		click() {
			SharedActions.run('duplicate');
		}
	})
	new Action('select_all', {
		icon: 'select_all',
		category: 'edit',
		condition: () => !Modes.display,
		keybind: new Keybind({key: 'a', ctrl: true}),
		click() {
			SharedActions.run('select_all');
			Blockbench.dispatchEvent('select_all');
		}
	})
	new Action('unselect_all', {
		icon: 'border_clear',
		category: 'edit',
		condition: () => !Modes.display,
		click() {
			SharedActions.run('unselect_all');
			Blockbench.dispatchEvent('unselect_all');
		}
	})
	new Action('invert_selection', {
		icon: 'swap_vert',
		category: 'edit',
		keybind: new Keybind({key: 'i', ctrl: true}),
		click() {
			SharedActions.run('invert_selection');
			Blockbench.dispatchEvent('invert_selection');
		}
	})
})
