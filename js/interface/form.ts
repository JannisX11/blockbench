import { Clipbench } from "../copy_paste"
import { EventSystem } from "../util/event_system"
import { getStringWidth } from "../util/util"
import { Interface } from "./interface"

export interface FormElementOptions {
	label?: string
	/**
	 * Detailed description of the field, available behind the questionmark icon or on mouse hover
	 */
	description?: string
	type:
		| 'text'
		| 'password'
		| 'number'
		| 'range'
		| 'checkbox'
		| 'select'
		| 'radio'
		| 'textarea'
		| 'vector'
		| 'color'
		| 'file'
		| 'folder'
		| 'save'
		| 'inline_select'
		| 'inline_multi_select'
		| 'info'
		| 'num_slider'
		| 'buttons'
	/**
	 * If true, the label will be displayed without colon at the end
	 */
	nocolon?: boolean
	/**
	 * Stretch the input field across the whole width of the form
	 */
	full_width?: boolean
	/** Set the input to read-only */
	readonly?: boolean
	/** Add buttons to allow copying and sharing the text or link */
	share_text?: boolean
	/**
	 * The default value
	 */
	value?: any
	/**
	 * The default selected option for 'select', 'inline_select' and 'radio' types. Alias for 'value'
	 */
	default?: any
	placeholder?: string
	list?: string[]
	/**
	 * When using 'text' type, the text to display. Markdown is supported
	 */
	text?: string
	condition?: ConditionResolvable
	/**
	 * When using 'range' type, allow users to modify the numeric input
	 */
	editable_range_label?: boolean
	colorpicker?: any
	/**
	 * On numeric inputs, the minimum possible value
	 */
	min?: number
	/**
	 * On numeric inputs, the maximum possible value
	 */
	max?: number
	/**
	 * The step in which the value can be increased / decreased
	 */
	step?: number
	/**
	 * If enabled, the value is forced to multiples of the "step" value. This can be used to create integer-only inputs etc.
	 */
	force_step?: boolean
	/**
	 * The number of dimensions when using a vector type
	 */
	dimensions?: number
	/**
	 * The height of the input on textareas, in pixels
	 */
	height?: number
	/**
	 * Available options on select or inline_select inputs
	 */
	options?: { [key: string]: string | { name: string } }
	/**
	 * List of buttons for the button type
	 */
	buttons?: string[]

	/**
	 * Function to get the interval value for a num_slider based on the input event
	 * @returns Interval value
	 */
	getInterval?: (event: Event) => number
	/**
	 * For num_sliders, the sliding interval mode
	 */
	interval_type?: 'position' | 'rotation'
	/**
	 * Allow users to toggle the entire option on or off
	 */
	toggle_enabled?: boolean
	/**
	 * Set whether the setting is toggled on or off by default. Requires 'toggle_enabled' field to be set to true
	 */
	toggle_default?: boolean
	/**
	 * Lock the ratio of a vector
	 */
	linked_ratio?: boolean
	/**
	 * Set the return type of files on file inputs
	 */
	return_as?: 'file'
	/**
	 * Runs when any of the buttons is pressed
	 * @param button_index Index of the clicked button in the buttons list
	 */
	click?: (button_index: number) => void

	readtype?: ReadType | ((file: string) => ReadType)
	resource_id?: string
	extensions?: string[]
	filetype?: string
}

type FormResultValue = string | number | boolean | any[] | {}

type InputFormConfig = {
	[formElement: string]: '_' | FormElementOptions
}
type FormValues = Record<string, FormResultValue>


// MARK: InputForm
export class InputForm extends EventSystem {
	uuid: string
	form_config: InputFormConfig
	form_data: { [formElement: string]: FormElement }
	node: HTMLDivElement
	max_label_width: number
	uses_wide_inputs: boolean

	constructor(form_config: InputFormConfig, options = {}) {
		super();
		this.uuid = guid();
		this.form_config = form_config;
		this.form_data = {};
		this.node = Interface.createElement('div', {class: 'form'}) as HTMLDivElement;
		this.max_label_width = 0;
		this.uses_wide_inputs = false;

		this.buildForm();
		this.updateValues({cause: 'setup'});
	}
	buildForm() {
		let jq_node = $(this.node);
		jq_node.empty();
		for (let form_id in this.form_config) {
			let input_config = this.form_config[form_id];
			form_id = form_id.replace(/"/g, '');
			if (input_config === '_') {
				jq_node.append('<hr />');
				continue;
			}
			let InputType = FormElement.types[input_config.type] ?? FormElement.types.text;
			let form_element = this.form_data[form_id] = new InputType(form_id, input_config, this);
			let bar = Interface.createElement('div', {class: `dialog_bar bar form_bar form_bar_${form_id}`});
			form_element.build(bar);
			form_element.setup();
			if (form_element.uses_wide_inputs) this.uses_wide_inputs = true;
			jq_node.append(bar);
		}
		this.updateLabelWidth();
	}
	updateLabelWidth(ignore_hidden: boolean = false) {
		this.max_label_width = 0;
		for (let form_id in this.form_config) {
			form_id = form_id.replace(/"/g, '');
			let form_element = this.form_data[form_id];
			if (ignore_hidden && !Condition(form_element.condition)) continue;

			if (form_element.uses_wide_inputs) this.uses_wide_inputs = true;
			this.max_label_width = Math.max(form_element.label_width, this.max_label_width);
		}
		this.node.style.setProperty('--max_label_width', this.max_label_width+'px');
	}
	update(form_result: FormValues) {
		for (let form_id in this.form_config) {
			let form_element = this.form_data[form_id];
			let input_config = this.form_config[form_id];
			if (typeof input_config == 'object' && form_element.bar) {
				let show = Condition(input_config.condition, form_result);
				form_element.bar.style.display = show ? null : 'none';
			}
		}
	}
	updateValues(context: {cause?: string, changed_keys?: string[]} = {}) {
		let form_result = this.getResult();
		this.update(form_result);
		if (context.cause != 'setup') {
			this.dispatchEvent('change', {result: form_result, cause: context.cause, changed_keys: context.changed_keys});
		}
		if (context.cause == 'input') {
			this.dispatchEvent('input', {result: form_result, changed_keys: context.changed_keys});
		}
		return form_result;
	}
	setValues(values: FormValues, update = true) {
		for (let form_id in this.form_config) {
			let form_element = this.form_data[form_id];
			let input_config = this.form_config[form_id];
			if (form_element && 'setValue' in form_element && values[form_id] != undefined && typeof input_config == 'object') {
				form_element.setValue(values[form_id]);
			}
		}
		if (update) this.updateValues({cause: 'update_value'});
	}
	setToggles(values: Record<string, boolean>, update = true) {
		for (let form_id in this.form_config) {
			let input_config = this.form_config[form_id];
			let form_element = this.form_data[form_id];
			if (values[form_id] != undefined && typeof input_config == 'object' && form_element.input_toggle && form_element.bar) {
				form_element.input_toggle.checked = values[form_id];
				form_element.bar.classList.toggle('form_toggle_disabled', !form_element.input_toggle.checked);
			}
		}
		if (update) this.updateValues({cause: 'update_toggle'});
	}
	getResult(): FormValues {
		let result = {}
		for (let form_id in this.form_data) {
			let form_element = this.form_data[form_id];
			if (form_element) {
				if (form_element.input_toggle && form_element.input_toggle.checked == false) {
					result[form_id] = null;
					continue;
				} else {
					result[form_id] = form_element.getValue();
				}
			}
		}
		return result;
	}
	static getDefaultValue(input_config: FormElementOptions): FormResultValue {
		let set_value = input_config.value ?? input_config.default;
		if (set_value) return set_value;
		let type = FormElement.types[input_config.type];
		if (type) {
			return type.prototype.getDefault.call({options: input_config});
		}
		return '';
	}
}

// MARK: FormElement
export class FormElement extends EventSystem {
	id: string
	form: InputForm
	condition: ConditionResolvable
	options: FormElementOptions
	bar: HTMLElement
	input_toggle?: HTMLInputElement
	label_width: number
	constructor(id: string, options: FormElementOptions, form: InputForm) {
		super();
		this.id = id;
		this.options = options;
		this.form = form;
		this.condition = options.condition;
	}
	build(bar: HTMLDivElement) {
		this.bar = bar;
		if (typeof this.options.label == 'string') {
			let label = Interface.createElement('label', {class: 'name_space_left', for: this.id}, tl(this.options.label)+((this.options.nocolon || !this.options.label)?'':':'))
			bar.append(label);
			if (!this.options.full_width && this.condition !== false/*Weed out inputs where the condition is always false*/) {
				this.label_width = getStringWidth(label.textContent);
			}
		}
		if (this.options.full_width) {
			bar.classList.add('full_width_dialog_bar');
		}
		if (this.options.description) {
			bar.setAttribute('title', tl(this.options.description));
		}
	}
	get uses_wide_inputs() {
		return this.options.full_width;
	}
	getValue(): any {
		return this.getDefault();
	}
	setValue(value: any) {
	}
	getDefault(): any {
		return null;
	}
	change() {
		this.dispatchEvent('change', {changed_keys: [this.id]});
		this.form.updateValues({cause: 'input', changed_keys: [this.id]});
	}
	setup() {
		if (this.options.readonly && 'input' in this) {
			$(this.input).attr('readonly', 'readonly').removeClass('focusable_input');
		}
		if (this.options.description) {
			let icon = document.createElement('i');
			icon.className = 'fa fa-question dialog_form_description';
			icon.onclick = () => {
				Blockbench.showQuickMessage(this.options.description, 3600);
			}
			this.bar.append(icon);
		}
		if (this.options.toggle_enabled) {
			let toggle = Interface.createElement('input', {
				type: 'checkbox',
				class: 'focusable_input form_input_toggle',
				id: this.id + '_toggle',
			}) as HTMLInputElement;
			toggle.checked = this.options.toggle_default != false;
			this.bar.append(toggle);
			this.bar.classList.toggle('form_toggle_disabled', !toggle.checked);
			toggle.addEventListener('input', () => {
				this.change();
				this.bar.classList.toggle('form_toggle_disabled', !toggle.checked);
			});
			this.input_toggle = toggle;
		}
	}

	static types: Record<string, typeof FormElement> = {};
	static registerType(id: string, type_class: typeof FormElement) {
		FormElement.types[id] = type_class;
	}
}

// MARK: FormElement Types
FormElement.types.range = class FormElementRange extends FormElement {
	input: HTMLInputElement
	numeric_input?: {value: number}
	build(bar: HTMLDivElement) {
		super.build(bar);
		let scope = this;

		let input_element = $(`<input class="half focusable_input" type="range" id="${this.id}"
			value="${this.options.value||0}" min="${this.options.min}" max="${this.options.max}" step="${this.options.step||1}">`)
		bar.append(input_element[0]);
		this.input = input_element[0] as HTMLInputElement;

		if (!this.options.editable_range_label) {
			let display = Interface.createElement('span', {class: 'range_input_label'}, (this.options.value||0).toString())
			bar.append(display);
			input_element.on('input', () => {
				let result = this.form.getResult();
				display.textContent = trimFloatNumber(result[this.id] as number);
			})
		} else {
			bar.classList.add('slider_input_combo');
			let numeric_input = new Interface.CustomElements.NumericInput(this.id + '_number', {
				value: this.options.value ?? 0,
				min: this.options.min, max: this.options.max, step: this.options.step,
				onChange() {
					input_element.val(numeric_input.value);
					scope.change();
				}
			});
			this.numeric_input = numeric_input;
			bar.append(numeric_input.node);
			input_element.on('input', () => {
				let result = parseFloat(input_element.val() as string);
				numeric_input.value = result;
			})
		}
		input_element.on('input', () => {
			this.change();
		})
	}
	getValue(): number {
		let result: number;
		if (this.options.editable_range_label && this.numeric_input) {
			result = this.numeric_input.value;
		} else {
			result = parseFloat(this.input.value);
		}
		if (this.options.force_step && this.options.step) {
			result = Math.round(result / this.options.step) * this.options.step;
		}
		return Math.clamp(result||0, this.options.min, this.options.max);
	}
	setValue(value: number): void {
		this.input.value = value.toString();
	}
	getDefault(): number {
		return Math.clamp(0, this.options.min, this.options.max);
	}
};
FormElement.types.info = class FormElementInfo extends FormElement {
	get uses_wide_inputs(): boolean {
		return true;
	}
	build(bar: HTMLDivElement) {
		this.bar = bar;
		let html_content = pureMarked(tl(this.options.text))
		bar.innerHTML = `<p>${html_content}</p>`;
		bar.classList.add('small_text');
	}
};
FormElement.types.text = class FormElementText extends FormElement {
	password_toggle?: HTMLElement
	input: HTMLInputElement
	build(bar: HTMLDivElement) {
		super.build(bar);
		let scope = this;
		let input_element = Object.assign(document.createElement('input'), {
			type: 'text',
			className: 'dark_bordered half focusable_input',
			id: this.id,
			value: this.options.value||'',
			placeholder: this.options.placeholder||'',
			oninput() {
				scope.change();
			}
		});
		this.input = input_element;
		bar.append(input_element)

		if (this.options.list) {
			let list_id = `${this.form.uuid}_${this.id}_list`;
			input_element.setAttribute('list', list_id);
			let list = Interface.createElement('datalist', {id: list_id});
			for (let value of this.options.list) {
				let node = document.createElement('option');
				node.value = value;
				list.append(node);
			}
			bar.append(list[0]);
		}
		if (this.options.type == 'password') {

			bar.append(`<div class="password_toggle form_input_tool tool">
					<i class="fas fa-eye-slash"></i>
				</div>`)
			input_element.type = 'password';
			let hidden = true;
			let this_bar = $(bar);
			let this_input_element = input_element;
			this_bar.find('.password_toggle').on('click', e => {
				hidden = !hidden;
				this_input_element.setAttribute('type', hidden ? 'password' : 'text');
				this_bar.find('.password_toggle i')[0].className = hidden ? 'fas fa-eye-slash' : 'fas fa-eye';
			})
		}
		if (this.options.share_text && this.options.value) {
			let text = this.options.value.toString();
			let is_url = text.startsWith('https://');

			let copy_button = Interface.createElement('div', {class: 'form_input_tool tool', title: tl('dialog.copy_to_clipboard')}, Blockbench.getIconNode('content_paste'));
			copy_button.addEventListener('click', e => {
				if (isApp || navigator.clipboard) {
					Clipbench.setText(text);
					Blockbench.showQuickMessage('dialog.copied_to_clipboard');
					input_element.focus();
					document.execCommand('selectAll');

				} else if (is_url) {
					Blockbench.showMessageBox({
						title: 'dialog.share_model.title',
						message: `[${text}](${text})`,
					})
				}
			});
			bar.append(copy_button);

			if (is_url) {
				let open_button = Interface.createElement('div', {class: 'form_input_tool tool', title: tl('dialog.open_url')}, Blockbench.getIconNode('open_in_browser'));
				open_button.addEventListener('click', e => {
					Blockbench.openLink(text);
				});
				bar.append(open_button);
			}
			if (navigator.share) {
				let share_button = Interface.createElement('div', {class: 'form_input_tool tool', title: tl('generic.share')}, Blockbench.getIconNode('share'));
				share_button.addEventListener('click', e => {
					navigator.share({
						title: this.options.label ? tl(this.options.label) : 'Share',
						[is_url ? 'url' : 'text']: text
					});
				});
				bar.append(share_button);
			}
		}
	}
	getValue(): string {
		return this.input.value;
	}
	setValue(value: string) {
		this.input.value = value;
	}
	getDefault(): string {
		return '';
	}
};
FormElement.types.textarea = class FormElementTextarea extends FormElement {
	textarea: HTMLTextAreaElement
	build(bar: HTMLDivElement) {
		super.build(bar);
		let scope = this;
		this.textarea = Object.assign(document.createElement('textarea'), {
			className: 'focusable_input',
			id: this.id,
			value: this.options.value||'',
			placeholder: this.options.placeholder||'',
			oninput() {
				scope.change();
			}
		});
		this.textarea.style.height = (this.options.height || 150) + 'px';
		bar.append(this.textarea);
	}
	getValue() {
		return this.textarea.value;
	}
	setValue(value: string) {
		this.textarea.value = value;
	}
	getDefault(): string {
		return '';
	}
};
FormElement.types.number = class FormElementNumber extends FormElement {
	numeric_input: {value: number, node: HTMLElement}
	build(bar: HTMLDivElement) {
		super.build(bar);
		let scope = this;
		this.numeric_input = new Interface.CustomElements.NumericInput(this.id, {
			value: this.options.value,
			min: this.options.min, max: this.options.max, step: this.options.step,
			onChange() {
				scope.change();
			}
		});
		bar.append(this.numeric_input.node)
	}
	getValue() {
		let result = Math.clamp(this.numeric_input.value, this.options.min, this.options.max);
		if (this.options.force_step && this.options.step) {
			result = Math.round(result / this.options.step) * this.options.step;
		}
		return result;
	}
	setValue(value: number) {
		this.numeric_input.value = value;
	}
	getDefault(): number {
		return Math.clamp(0, this.options.min, this.options.max);
	}
};
FormElement.types.select = class FormElementSelect extends FormElement {
	select_input: {node: HTMLElement, set: (value: string) => void}
	build(bar: HTMLDivElement) {
		super.build(bar);
		let scope = this;
		this.select_input = new Interface.CustomElements.SelectInput(this.id, {
			options: this.options.options,
			value: this.options.value || this.options.default,
			onInput() {
				scope.change();
			}
		});
		bar.append(this.select_input.node);
	}
	getValue(): string {
		return this.select_input.node.getAttribute('value');
	}
	setValue(value: string) {
		this.select_input.set(value);
	}
	getDefault(): string {
		return Object.keys(this.options.options)[0] ?? '';
	}
};
FormElement.types.inline_select = class FormElementInlineSelect extends FormElement {
	build(bar: HTMLDivElement) {
		super.build(bar);
		let options = [];
		let val = this.options.value || this.options.default;
		let i = 0;
		for (let key in this.options.options) {
			let is_selected = val ? key == val : i == 0;
			let text: string = typeof this.options.options[key] == 'string' ? this.options.options[key] : this.options.options[key].name;
			let node = Interface.createElement('li', {class: is_selected ? 'selected' : '', key: key}, tl(text));
			node.onclick = () => {
				options.forEach(li => {
					li.classList.toggle('selected', li == node);
				})
				this.change();
			}
			options.push(node);
			i++;
		}
		let wrapper = Interface.createElement('ul', {class: 'form_inline_select'}, options);
		bar.append(wrapper);
	}
	getValue(): string {
		return $(this.bar).find('li.selected')[0]?.getAttribute('key') || '';
	}
	setValue(value: string) {
		$(this.bar).find('li').each((i, el) => {
			el.classList.toggle('selected', el.getAttribute('key') == value);
		})
	}
	getDefault(): string {
		return Object.keys(this.options.options)[0] ?? '';
	}
};
FormElement.types.inline_multi_select = class FormElementInlineMultiSelect extends FormElement {
	value: Record<string, boolean>
	build(bar: HTMLDivElement) {
		super.build(bar);
		let val = this.options.value || this.options.default;
		this.value = {};
		if (val) {
			for (let key in this.options.options) {
				this.value[key] = !!val[key];
			}
		}
		let i = 0;
		let options = [];
		for (let key in this.options.options) {
			let is_selected = val && val[key];
			let text = this.options.options[key];
			if (typeof text != 'string') text = text.name;
			let node = Interface.createElement('li', {class: is_selected ? 'selected' : '', key: key}, tl(text));
			node.onclick = () => {
				this.value[key] = !this.value[key];
				node.classList.toggle('selected', this.value[key]);
				this.change();
			}
			options.push(node);
			i++;
		}
		let wrapper = Interface.createElement('ul', {class: 'form_inline_select multi_select'}, options);
		bar.append(wrapper)
	}
	getValue(): Record<string, boolean> {
		return this.value;
	}
	setValue(value: Record<string, boolean>) {
		for (let key in value) {
			if (this.value[key] !== undefined)  {
				this.value[key] = value[key];
			}
		}
		$(this.bar).find('li').each((i, el) => {
			el.classList.toggle('selected', !!this.value[el.getAttribute('key')]);
		})
	}
	getDefault(): Record<string, boolean> {
		return {};
	}
};
FormElement.types.radio = class FormElementRadio extends FormElement {
	input: HTMLInputElement
	build(bar: HTMLDivElement) {
		super.build(bar);
		let el = $(`<div class="half form_part_radio" id="${this.id}"></div>`)
		for (let key in this.options.options) {
			let name = tl(typeof this.options.options[key] == 'string' ? this.options.options[key] : this.options.options[key].name)
			el.append(`<div class="form_bar_radio">
				<input type="radio" class="focusable_input" name="${this.id}_radio" id="${key}" ${(this.options.default || this.options.value) === key ? 'selected' : ''}>
				<label for="${key}">${name}</label>
			</div>`)
			this.input = el.find(`input#${key}`)[0] as HTMLInputElement;
			this.input.addEventListener('change', (args) => {
				this.change();
			})
		}
		bar.append(el[0]);
	}
	getValue(): string {
		return $(this.bar).find('.form_part_radio#'+this.id+' input:checked').attr('id');
	}
	setValue(value: string) {
		$(this.bar).find('.form_part_radio input#'+value).prop('checked', true);
	}
	getDefault() {
		return Object.keys(this.options.options)[0] ?? '';
	}
};
FormElement.types.buttons = class FormElementButtons extends FormElement {
	get uses_wide_inputs(): boolean {
		return true;
	}
	build(bar: HTMLDivElement) {
		this.bar = bar;
		let list = document.createElement('div');
		list.className = 'dialog_form_buttons';
		this.options.buttons.forEach((button_text, index) => {
			let button = document.createElement('a');
			button.innerText = tl(button_text);
			button.addEventListener('click', e => {
				this.options.click(index);
			})
			list.append(button);
		})
		bar.append(list);
	}
};
FormElement.types.num_slider = class FormElementNumSlider extends FormElement {
	slider: NumSlider
	build(bar: HTMLDivElement) {
		super.build(bar);
		let getInterval = this.options.getInterval;
		// @ts-ignore
		if (this.options.interval_type == 'position') getInterval = getSpatialInterval;
		// @ts-ignore
		if (this.options.interval_type == 'rotation') getInterval = getRotationInterval;
		this.slider = new NumSlider('form_slider_'+this.id, {
			private: true,
			// @ts-ignore
			onChange: () => {
				this.change();
			},
			getInterval,
			settings: {
				default: this.options.value || 0,
				min: this.options.min,
				max: this.options.max,
				step: this.options.step||1,
			},
		});
		bar.append(this.slider.node);
		this.slider.update();
	}
	getValue(): number {
		return this.slider.get();
	}
	setValue(value: number) {
		this.slider.setValue(value);
	}
	getDefault() {
		return Math.clamp(0, this.options.min, this.options.max);
	}
};
FormElement.types.vector = class FormElementVector extends FormElement {
	linked_ratio: boolean
	constructor(id: string, options: FormElementOptions, form: InputForm) {
		super(id, options, form);
		this.linked_ratio = false;
	}
	build(bar: HTMLDivElement) {
		super.build(bar);
		let scope = this;
		let group = $(`<div class="dialog_vector_group half"></div>`)
		bar.append(group[0])
		let vector_inputs = [];
		let initial_value = this.options.value instanceof Array ? this.options.value.slice() : [1, 1, 1];
		let updateInputs = (changed_input) => {
			let i2 = -1;
			for (let vector_input_2 of vector_inputs) {
				i2++;
				if (vector_input_2 == changed_input) continue;
				let new_value = initial_value[i2] * (changed_input.value / initial_value[vector_inputs.indexOf(changed_input)]);
				new_value = Math.clamp(new_value, this.options.min, this.options.max)
				if (this.options.force_step && this.options.step) {
					new_value = Math.round(new_value / this.options.step) * this.options.step;
				}
				vector_input_2.value = new_value;
			}
		}
		for (let i = 0; i < (this.options.dimensions || 3); i++) {
			let numeric_input = new Interface.CustomElements.NumericInput(this.id + '_' + i, {
				value: this.options.value ? this.options.value[i] : 0,
				min: this.options.min, max: this.options.max, step: this.options.step,
				onChange() {
					if (scope.linked_ratio) {
						updateInputs(numeric_input);
					}
					scope.change();
				}
			});
			group.append(numeric_input.node)
			vector_inputs.push(numeric_input);
		}
		if (typeof this.options.linked_ratio == 'boolean') {
			let updateState = () => {
				icon.textContent = scope.linked_ratio ? 'link' : 'link_off';
				linked_ratio_toggle.classList.toggle('enabled', scope.linked_ratio);
			};
			this.linked_ratio = this.options.linked_ratio;
			let icon = Blockbench.getIconNode('link');
			let linked_ratio_toggle = Interface.createElement('div', {class: 'tool linked_ratio_toggle'}, icon);
			linked_ratio_toggle.addEventListener('click', event => {
				this.linked_ratio = !this.linked_ratio;
				if (this.linked_ratio) {
					initial_value = vector_inputs.map(v => v.value);
					// updateInputs(vector_inputs[0]);
					// scope.change()
				}
				updateState();
			})
			updateState();
			group.append(linked_ratio_toggle)
		}
	}
	getValue(): number[] {
		let result: number[] = [];
		for (let i = 0; i < (this.options.dimensions || 3); i++) {
			let input_value = $(this.bar).find(`input#${this.id}_${i}`).val() as string;
			let num = Math.clamp(parseFloat(input_value)||0, this.options.min, this.options.max);
			if (this.options.force_step && this.options.step) {
				num = Math.round(num / this.options.step) * this.options.step;
			};

			result.push(num);
		}
		return result;
	}
	setValue(value: number[]) {
		for (let i = 0; i < (this.options.dimensions || 3); i++) {
			$(this.bar).find(`input#${this.id}_${i}`).val(value[i]);
		}
	}
	getDefault(): number[] {
		return new Array(this.options.dimensions??3).fill(Math.clamp(0, this.options.min, this.options.max))
	}
};
FormElement.types.color = class FormElementColor extends FormElement {
	colorpicker: ColorPicker
	build(bar: HTMLDivElement) {
		super.build(bar);
		if (this.options.colorpicker) this.colorpicker = this.options.colorpicker;
		let scope = this;
		if (!this.colorpicker) {
			this.colorpicker = new ColorPicker({
				id: 'cp_'+this.id,
				name: tl(this.options.label),
				// @ts-ignore
				label: false,
				private: true,
				value: this.options.value
			})
		}
		// @ts-ignore
		this.colorpicker.onChange = function() {
			scope.change();
		};
		this.colorpicker.on('modify_color', ({color}) => {
			scope.change();
		})
		bar.append(this.colorpicker.getNode())
	}
	getValue(): tinycolor.Instance {
		return this.colorpicker.get();
	}
	setValue(value: string | any) {
		this.colorpicker.set(value);
	}
	getDefault() {
		return '#ffffff';
	}
};
FormElement.types.checkbox = class FormElementCheckbox extends FormElement {
	input: HTMLInputElement
	build(bar: HTMLDivElement) {
		super.build(bar);
		this.input = Interface.createElement('input', {
			type: 'checkbox',
			class: 'focusable_input',
			id: this.id,
			checked: this.options.value
		})
		bar.append(this.input)
		this.input.addEventListener('change', () => {
			this.change();
		})
	}
	setValue(value: boolean) {
		this.input.checked = value;
	}
	getValue(): boolean {
		return this.input.checked;
	}
	getDefault() {
		return false;
	}
};

class FormElementFile extends FormElement {
	file: FileResult
	value: string
	content: any
	input: HTMLInputElement
	build(bar: HTMLDivElement) {
		super.build(bar);
		if (this.options.type == 'folder' && !isApp) return;
		this.value = this.options.value;
		let scope = this;

		let input = $(`<input class="dark_bordered half" class="focusable_input" type="text" id="${this.id}" style="pointer-events: none;" disabled>`);
		this.input = input[0] as HTMLInputElement;
		this.input.value = settings.streamer_mode.value ? `[${tl('generic.redacted')}]` : this.value || '';
		let input_wrapper = $('<div class="input_wrapper"></div>');
		input_wrapper.append(input);
		bar.append(input_wrapper[0]);
		bar.classList.add('form_bar_file');

		switch (this.options.type) {
			case 'file': 	input_wrapper.append('<i class="material-icons">insert_drive_file</i>'); break;
			case 'folder':	input_wrapper.append('<i class="material-icons">folder</i>'); break;
			case 'save':	input_wrapper.append('<i class="material-icons">save</i>'); break;
		}
		let remove_button = $('<div class="tool" style="float: none; vertical-align: top;"><i class="material-icons">clear</i></div>');
		bar.append(remove_button[0]);
		remove_button.on('click', e => {
			e.stopPropagation();
			this.value = '';
			delete this.content;
			delete this.file;
			input.val('');
		})

		input_wrapper.on('click', e => {
			function fileCB(files) {
				this.value = files[0].path;
				this.content = files[0].content;
				this.file = files[0];
				input.val(settings.streamer_mode.value ? `[${tl('generic.redacted')}]` : this.value);
				scope.change();
			}
			switch (this.options.type) {
				case 'file':
					Blockbench.import({
						resource_id: this.options.resource_id,
						extensions: this.options.extensions,
						type: this.options.filetype,
						startpath: this.value,
						readtype: this.options.readtype
					}, fileCB);
					break;
				case 'folder':
					let path = Blockbench.pickDirectory({
						startpath: this.value,
					})
					if (path) fileCB([{path}]);
					break;
				case 'save':
					Blockbench.export({
						resource_id: this.options.resource_id,
						extensions: this.options.extensions,
						type: this.options.filetype,
						startpath: this.value,
						custom_writer: () => {},
					}, path => {
						this.value = path;
						input.val(settings.streamer_mode.value ? `[${tl('generic.redacted')}]` : this.value);
						scope.change();
					});
					break;
			}
		})
	}
	getValue(): FileResult | string | any {
		if (this.options.return_as == 'file') {
			return this.file;
		} else {
			return isApp ? this.value : this.content;
		}
	}
	setValue(value: string) {
		delete this.file;
		if (this.options.return_as == 'file' && typeof value == 'object') {
			this.file = value;
			this.value = this.file.name;
		} else if (isApp) {
			this.value = value;
		} else {
			this.content = value;
		}
		$(this.input).val(settings.streamer_mode.value ? `[${tl('generic.redacted')}]` : this.value);
	}
	getDefault() {
		return '';
	}
};
FormElement.types.file = FormElementFile;
FormElement.types.folder = FormElementFile;
FormElement.types.save = FormElementFile;


Object.assign(window, {InputForm, FormElement});
