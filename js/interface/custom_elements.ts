import { ResizeLine } from "./resize_lines";

type SelectInputOptions = Record<string, string | {name: string, icon?: string, color?: string | number}>;
class SelectInput<T extends SelectInputOptions = any> {
	node: HTMLElement
	constructor(
		id: string,
		data: {
			value?: keyof T
			default?: keyof T
			options: T | (() => T)
			/**
			 * Set to true to display the specified icon of the selected option in the UI element
			 */
			display_icon?: boolean
			onChange?(value: keyof T): void
			onInput?(value: keyof T, event: Event): void
		}
	) {
		const select_input = this;
		function getNameFor(opt_config: T[keyof T]): string {
			if (!opt_config) return '';
			if (typeof opt_config == 'object') {
				return tl(opt_config.name);
			}
			return tl(opt_config);
		}
		let options = typeof data.options == 'function' ? data.options() : data.options as T;
		let value: keyof T = data.value || data.default || Object.keys(options).find(key => options[key]) as keyof T;
		let select = Interface.createElement('div', {id, class: 'bb-select half', value: value}, getNameFor(options[value]));
		if (data.display_icon && options[value] && typeof options[value] == 'object') {
			let opt_config = options[value] as any;
			let icon_string = opt_config.icon ?? '';
			select.prepend(Blockbench.getIconNode(icon_string, opt_config?.color));
		}
		this.set = function setKey(key: keyof T, options: T, input_event?: Event) {
			if (!options) {
				options = typeof data.options == 'function' ? data.options() : data.options as any;
			}
			value = key;
			select.setAttribute('value', key as string);
			select.textContent = getNameFor(options[value]);
			let opt_config = options[value] as any;
			if (data.display_icon && opt_config && typeof opt_config == 'object') {
				if (select.firstElementChild?.classList.contains('icon')) select.firstElementChild.remove();
				let icon_string = opt_config.icon ?? '';
				select.prepend(Blockbench.getIconNode(icon_string, opt_config?.color));
			}
			if (typeof data.onChange == 'function') {
				data.onChange(value);
			}
			if (input_event && typeof data.onInput == 'function') {
				data.onInput(value, input_event);
			}
		}
		select.addEventListener('click', function(event) {
			if (Menu.closed_in_this_click == id) return this;
			let items = [];
			let options = typeof data.options == 'function' ? data.options() : data.options;
			for (let key in options) {
				let opt_config = options[value] as any;
				if (!opt_config) continue;
				if (opt_config instanceof MenuSeparator) {
					items.push(opt_config);
					continue;
				}
				items.push({
					name: getNameFor(options[key]),
					icon: opt_config.icon || ((value == key) ? 'far.fa-dot-circle' : 'far.fa-circle'),
					color: opt_config.color,
					condition: opt_config.condition,
					click: (context, event2) => {
						select_input.set(key, options, event2 ?? event);
					}
				})
			}
			let menu = new Menu(id, items, {searchable: items.length > 16});
			menu.node.style['min-width'] = select.clientWidth+'px';
			menu.open(select);
		})
		this.node = select;
	}
	set(value: keyof T, options?: T, input_event?: Event): void {}
}

export interface NumericInputData {
	value?: number
	min?: number
	max?: number
	step?: number
	readonly?: boolean
	onChange?: (value: number, event?: Event) => void
}
export const CustomElements = {
	ResizeLine: ResizeLine,
	SelectInput,
	NumericInput: class NumericInput {
		node: HTMLDivElement
		input: HTMLInputElement
		config: NumericInputData
		constructor(id: string, data: NumericInputData) {
			this.config = data;
			let input = this.input = Interface.createElement('input', {id, class: 'dark_bordered focusable_input', value: data.value || 0, inputmode: data.min >= 0 ? 'decimal' : ''});
			let slider = Interface.createElement('div', {class: 'tool numeric_input_slider'}, Blockbench.getIconNode('code'));
			this.node = Interface.createElement('div', {class: 'numeric_input'}, [
				input, slider
			]);
			if (data.readonly) {
				input.readOnly = true;
				slider.remove();
			}

			addEventListeners(slider, 'mousedown touchstart', (e1: MouseEvent) => {
				if (data.readonly) return;
				convertTouchEvent(e1);
				let last_difference = 0;
				let move = (e2) => {
					convertTouchEvent(e2);
					let difference = Math.trunc((e2.clientX - e1.clientX) / 10) * (data.step || 1);
					if (difference != last_difference) {
						let value = Math.clamp((parseFloat(input.value) || 0) + (difference - last_difference), data.min, data.max);
						input.value = trimFloatNumber(value, 8);
						if (data.onChange) data.onChange(NumSlider.MolangParser.parse(input.value), e2);
						last_difference = difference;
					}
				}
				let stop = e2 => {
					removeEventListeners(document, 'mousemove touchmove', move);
					removeEventListeners(document, 'mouseup touchend', stop);
				}
				addEventListeners(document, 'mousemove touchmove', move);
				addEventListeners(document, 'mouseup touchend', stop);
			})

			addEventListeners(input, 'focusout dblclick', () => {
				if (data.readonly) return;
				input.value = Math.clamp(NumSlider.MolangParser.parse(input.value), data.min, data.max).toString();
			})
			input.addEventListener('input', (event) => {
				if (data.onChange) data.onChange(Math.clamp(NumSlider.MolangParser.parse(input.value), data.min, data.max), event);
			})
		}
		get value(): number {
			return Math.clamp(NumSlider.MolangParser.parse(this.input.value), this.config.min, this.config.max);
		}
		set value(value: number) {
			this.input.value = trimFloatNumber(value, 8);
		}
	}
}