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
			return {
				delete: () => {
					this.events[event_name].remove(cb);
				}
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
		return this.on(event_name, listener);
	}
	addListener(event_name, cb) {
		return this.on(event_name, cb);
	}
	removeListener(event_name, cb) {
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