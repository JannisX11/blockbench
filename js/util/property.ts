import { FormElementOptions } from "../interface/form"

interface PropertyOptions {
	default?: any
	condition?: ConditionResolvable
	exposed?: boolean
	export?: boolean
	copy_value?: boolean
	description?: string
	placeholder?: string
	label?: string
	/**
	 * Options used for select types
	 */
	options?: any
	/**
	 * Enum possible values
	 */
	values?: string[]
	merge?(instance: any, data: any): void
	reset?(instance: any): void
	merge_validation?(value: any): boolean
	inputs?: {
		[key: 'element_panel' | 'dialog' | string]: {
			input: FormElementOptions,
			shared?: boolean
			onChange?: (value: any, nodes: OutlinerNode[]) => void
		}
	}
}

interface IPropertyType {
	string: string
	enum: string
	molang: string
	number: number
	boolean: boolean
	array: any[]
	object: any
	instance: any
	vector: ArrayVector3
	vector2: ArrayVector2
	vector4: ArrayVector2
}

/**
 * Creates a new property on the specified target class
 */
export class Property<T extends keyof IPropertyType> implements Deletable {

	class: any
	name: string
	type: T
	default: IPropertyType[T]
	export?: boolean

	isString: boolean
	isEnum: boolean
	isMolang: boolean
	isNumber: boolean
	isBoolean: boolean
	isArray: boolean
	isVector: boolean
	isVector2: boolean
	isObject: boolean
	isInstance: boolean

	enum_values?: string[]
	merge_validation: undefined | ((value: IPropertyType[T]) => boolean)
	condition: ConditionResolvable
	exposed: boolean
	label: any
	inputs?: any
	copy_value?: boolean
	description?: string
	placeholder?: string
	options?: Record<string, string>

	constructor(target_class: any, type: T, name: string, options: PropertyOptions = {}) {
		if (!target_class.properties) {
			target_class.properties = {};
		}
		target_class.properties[name] = this;

		this.class = target_class;
		this.name = name;
		this.type = type;

		if (options.default != undefined) {
			this.default = options.default;
		} else {
			switch (this.type) {
				case 'string': this.default = '' as any; break;
				case 'enum': this.default = options.values?.[0] || '' as any; break;
				case 'molang': this.default = '0' as any; break;
				case 'number': this.default = 0 as any; break;
				case 'boolean': this.default = false as any; break;
				case 'array': this.default = [] as any; break;
				case 'object': this.default = {} as any; break;
				case 'instance': this.default = null as any; break;
				case 'vector': this.default = [0, 0, 0] as any; break;
				case 'vector2': this.default = [0, 0] as any; break;
				case 'vector4': this.default = [0, 0, 0, 0] as any; break;
			}
		}
		switch (this.type) {
			case 'string': this.isString = true; break;
			case 'enum': this.isEnum = true; break;
			case 'molang': this.isMolang = true; break;
			case 'number': this.isNumber = true; break;
			case 'boolean': this.isBoolean = true; break;
			case 'array': this.isArray = true; break;
			case 'object': this.isObject = true; break;
			case 'instance': this.isInstance = true; break;
			case 'vector':
			case 'vector2':
			case 'vector4': this.isVector = true; break;
		}

		if (this.isMolang) {
			Object.defineProperty(target_class.prototype, `${name}_string`, {
				get() {
					return typeof this[name] == 'number' ? trimFloatNumber(this[name]) || '0' : this[name];
				},
				set(val) {
					this[name] = val;
				}
			})
		}
		if (this.isEnum) {
			this.enum_values = options.values;
		}

		if (typeof options.merge == 'function') this.merge = options.merge;
		if (typeof options.reset == 'function') this.reset = options.reset;
		if (typeof options.merge_validation == 'function') this.merge_validation = options.merge_validation;
		if (options.condition) this.condition = options.condition;
		if (options.exposed == false) this.exposed = false;
		if (options.export == false) this.export = false;
		if (options.copy_value == false) this.copy_value = false;
		if (options.label) this.label = options.label;
		if (options.description) this.description = options.description;
		if (options.placeholder) this.placeholder = options.placeholder;
		if (options.inputs) this.inputs = options.inputs;
		if (options.options) this.options = options.options;
	}
	delete() {
		delete this.class.properties[this.name];
	}
	getDefault(instance: IPropertyType[T]): IPropertyType[T] {
		if (typeof this.default == 'function') {
			return this.default(instance);
		} else if (this.isArray) {
			// @ts-ignore
			return this.default ? this.default.slice() : [] as any;
		} else if (this.isObject) {
			return Object.keys(this.default).length ? structuredClone(this.default) : {} as any;
		} else {
			return this.default;
		}
	}
	merge(instance: IPropertyType[T], data: IPropertyType[T]): void {
		if (data[this.name] == undefined || !Condition(this.condition, instance)) return;

		if (this.isString) {
			Merge.string(instance, data, this.name, this.merge_validation)
		}
		else if (this.isEnum) {
			Merge.string(instance, data, this.name, val => (!this.enum_values || this.enum_values.includes(val)));
		}
		else if (this.isNumber) {
			Merge.number(instance, data, this.name)
		}
		else if (this.isMolang) {
			Merge.molang(instance, data, this.name)
		}
		else if (this.isBoolean) {
			Merge.boolean(instance, data, this.name, this.merge_validation)
		}
		else if (this.isArray || this.isVector) {
			if (data[this.name] instanceof Array) {
				if (instance[this.name] instanceof Array == false) {
					instance[this.name] = [];
				}
				instance[this.name].replace(data[this.name]);
			}
		}
		else if (this.isObject) {
			if (typeof data[this.name] == 'object') {
				instance[this.name] = structuredClone(data[this.name]);
			}
		}
		else if (this.isInstance) {
			if (typeof data[this.name] === 'object') {
				instance[this.name] = data[this.name];
			}
		}
	}
	copy(instance: IPropertyType[T], target: IPropertyType[T]): void {
		if (!Condition(this.condition, instance)) return;

		if (this.isArray || this.isVector) {
			if (instance[this.name] instanceof Array) {
				target[this.name] = instance[this.name].slice();
				if (this.isArray) {
					try {
						instance[this.name].forEach((item, i) => {
							if (typeof item == 'object') {
								instance[this.name][i] = JSON.parse(JSON.stringify(item));
							}
						})
					} catch (err) {
						console.error(err);
					}
				}
			}
		} else if (this.isObject) {
			if (typeof instance[this.name] == 'object') {
				target[this.name] = structuredClone(instance[this.name]);
			}
		} else {
			target[this.name] = instance[this.name];
		}
	}
	reset(instance: IPropertyType[T], force: boolean = false): void {
		if (instance[this.name] == undefined && !Condition(this.condition, instance) && !force) return;
		var dft = this.getDefault(instance)

		if (this.isArray || this.isVector) {
			if (instance[this.name] instanceof Array == false) {
				instance[this.name] = [];
			}
			instance[this.name].replace(dft || []);
		} else {
			instance[this.name] = dft;
		}
	}
	static resetUniqueValues = function(type: any, instance: any) {
		for (var key in type.properties) {
			let property = type.properties[key];
			if (property.copy_value == false) {
				property.reset(instance);
			}
		}
	}
}

Object.assign(window, {Property});
