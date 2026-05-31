export interface ToastNotificationOptions {
	id?: string
	/**
	 * Text message
	 */
	text: string
	/**
	 * Blockbench icon string
	 */
	icon?: IconString
	/**
	 * Expire time in miliseconds
	 */
	expire?: number
	/**
	 * Background color, accepts any CSS color string
	 */
	color?: string
	/**
	 * Method to run on click. 
	 * @returns Return `true` to close toast
	 */
	click?: (event: Event) => boolean | void
	/**
	 * Method to run on close via the close button. 
	 * @returns Return `falce` to cancel the close
	 */
	onClose?: (event: Event) => boolean | void
}

export class ToastNotification {
	node: HTMLLIElement
	id: string
	options: ToastNotificationOptions
	constructor(id: string, options: ToastNotificationOptions) {
		this.id = id || guid();
		this.options = options;
		let notification = document.createElement('li');
		notification.className = 'toast_notification';
		if (options.icon) {
			let icon = Blockbench.getIconNode(options.icon);
			notification.append(icon);
		}
		this.node = notification;

		let text = document.createElement('span');
		text.innerText = tl(options.text);
		notification.append(text);

		let close_button = document.createElement('div');
		close_button.innerHTML = '<i class="material-icons">clear</i>';
		close_button.className = 'toast_close_button';
		close_button.addEventListener('click', (event) => {
			if (options.onClose) {
				let result = options.onClose(event);
				if (result == false) return;
			}
			this.delete();
		})
		notification.append(close_button);

		if (options.color) {
			notification.style.backgroundColor = options.color;
		}
		if (typeof options.click == 'function') {
			notification.addEventListener('click', (event) => {
				if (event.target == close_button || (event.target as HTMLElement).parentElement == close_button) return;
				let result = options.click(event);
				if (result == true) {
					this.delete();
				}
			})
			notification.style.cursor = 'pointer';
		}

		if (options.expire) {
			setTimeout(() => {
				this.delete();
			}, options.expire);
		}

		if (ToastNotification.notifications[this.id]) {
			ToastNotification.notifications[this.id].delete();
		}
		ToastNotification.notifications[this.id] = this;

		document.getElementById('toast_notification_list').append(notification);
	}
	delete() {
		this.node.remove();
	}
	static notifications: Record<string, ToastNotification> = {};
}

const global = {
	ToastNotification,
}
declare global {
	type ToastNotification = import('./toast_notification').ToastNotification
	const ToastNotification: typeof global.ToastNotification
}
Object.assign(window, global);
