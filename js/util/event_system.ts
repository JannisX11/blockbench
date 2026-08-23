type EventListener = (data: any) => void | Promise<void>;
type Deletable = {
	delete(): void
}

const listener_origins = new WeakMap<EventListener, string>();

export class EventSystem {
	events: Record<string, EventListener[]>
	constructor() {
		this.events = {};
	}
	#reportListenerError(event_name: string, callback: EventListener, error: any) {
		let origin = listener_origins.get(callback);
		console.error(`Error in "${event_name}" listener${origin ? ` from plugin "${origin}"` : ''}:`, error);
	}
	dispatchEvent(event_name: string, data: any): any {
		var list = this.events[event_name];
		if (!list) return;
		let return_value: any;
		for (let callback of list.slice()) {
			try {
				return_value = callback(data) ?? return_value;
			} catch (error) {
				this.#reportListenerError(event_name, callback, error);
			}
		}
		return return_value;
	}
	async dispatchEventAsync(event_name: string, data: any): Promise<void> {
		var list = this.events[event_name];
		if (!list) return;
		for (let callback of list.slice()) {
			try {
				await callback(data);
			} catch (error) {
				this.#reportListenerError(event_name, callback, error);
			}
		}
	}
	on(event_name: string, cb: EventListener): Deletable {
		if (typeof cb !== 'function') {
			console.warn(cb, 'is not a function!');
			return;
		}
		if (event_name.includes(' ')) {
			let event_names = event_name.split(' ');
			for (let name of event_names) {
				if (!this.events[name]) {
					this.events[name] = [];
				}
				this.events[name].safePush(cb);
			}
			return {
				delete: () => {
					for (let name of event_names) {
						this.events[name].remove(cb);
					}
				}
			}

		} else {
			if (!this.events[event_name]) {
				this.events[event_name] = [];
			}
			this.events[event_name].safePush(cb);
			if (typeof Plugins != 'undefined' && Plugins.currently_loading) {
				listener_origins.set(cb, Plugins.currently_loading);
			}
			return {
				delete: () => {
					this.events[event_name].remove(cb);
				}
			}
		}
	}
	once(event_name: string, cb: EventListener): Deletable {
		if (typeof cb !== 'function') {
			console.warn(cb, 'is not a function!');
			return;
		}
		let listener = (data) => {
			this.removeListener(event_name, listener);
			cb(data);
		}
		return this.on(event_name, listener);
	}
	addListener(event_name: string, cb: EventListener) {
		return this.on(event_name, cb);
	}
	removeListener(event_name: string, cb: EventListener) {
		if (event_name.includes(' ')) {
			let event_names = event_name.split(' ');
			for (let name of event_names) {
				if (this.events[name]) this.events[name].remove(cb);
			}

		} else if (this.events[event_name]) {
			this.events[event_name].remove(cb);
		}
	}
}
const global = {
	EventSystem
};
declare global {
	const EventSystem: typeof global.EventSystem
	type EventSystem = import('./event_system').EventSystem
}
Object.assign(window, global);