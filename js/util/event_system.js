class EventSystem {
	constructor() {
		this.events = {};
	}
	dispatchEvent(event_name, data) {
		var list = this.events[event_name];
		if (!list) return;
		for (var i = 0; i < list.length; i++) {
			list[i](data);
		}
	}
	on(event_name, cb) {
		if (typeof cb !== 'function') {
			console.warn(cb, 'is not a function!');
			return;
		}
		if (!this.events[event_name]) {
			this.events[event_name] = [];
		}
		this.events[event_name].safePush(cb);
		return {
			delete: () => {
				this.events[event_name].remove(cb);
			}
		}
	}
	once(event_name, cb) {
		if (typeof cb !== 'function') {
			console.warn(cb, 'is not a function!');
			return;
		}
		let listener = (data) => {
			this.removeListener(event_name, listener);
			cb(data);
		}
		if (!this.events[event_name]) {
			this.events[event_name] = [];
		}
		this.events[event_name].safePush(listener);
		return {
			delete: () => {
				this.events[event_name].remove(listener);
			}
		}
	}
	addListener(event_name, cb) {
		return this.on(event_name, cb);
	}
	removeListener(event_name, cb) {
		if (this.events[event_name]) {
			this.events[event_name].remove(cb);
		}
	}
}