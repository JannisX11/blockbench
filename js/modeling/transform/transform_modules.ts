interface TransformContext {
	event: Event
}
interface TransformContextMove extends TransformContext {
	point: THREE.Vector3
	axis: 'x'|'y'|'z'
	axis_number: 0|1|2
	second_axis?: 'x'|'y'|'z'
	second_axis_number?: 0|1|2
	rotate_normal: THREE.Vector3
	direction: 1 | -1
	angle?: number
	value?: number
}
interface TransformContextEnd extends TransformContext {
	has_changed: boolean
	keep_changes: boolean
}

interface TransformerModuleOptions {
	priority: number
	condition: ConditionResolvable
	use_condition: ConditionResolvable

	updateGizmo: (this: TransformerModule) => void
	onPointerDown: (this: TransformerModule, context: TransformContext) => void
	calculateOffset: (this: TransformerModule, context: TransformContextMove) => number
	onStart: (this: TransformerModule, context: TransformContextMove) => void
	onMove: (this: TransformerModule, context: TransformContextMove) => void
	onEnd: (this: TransformerModule, context: TransformContextEnd) => void
	onCancel: (this: TransformerModule, context: TransformContextEnd) => void
}
export interface TransformerModule extends TransformerModuleOptions {}

export class TransformerModule implements TransformerModuleOptions {
	id: string
	priority: number
	condition: any
	use_condition: any

	previous_value: number | null
	initial_value: number | null
	has_changed: boolean

	constructor(id: string, options: TransformerModuleOptions) {
		this.id = id;
		this.priority = options.priority ?? 0;
		this.condition = options.condition;
		this.use_condition = options.use_condition;

		this.previous_value = null;
		this.initial_value = null;
		this.has_changed = false;

		this.updateGizmo = options.updateGizmo;
		this.onPointerDown = options.onPointerDown;
		this.calculateOffset = options.calculateOffset;
		this.onStart = options.onStart;
		this.onMove = options.onMove;
		this.onEnd = options.onEnd;
		this.onCancel = options.onCancel;

		TransformerModule.modules[id] = this;
	}

	dispatchPointerDown(context: TransformContext) {
		this.previous_value = null;
		this.initial_value = null;

		if (this.onPointerDown) this.onPointerDown(context);
	}
	dispatchMove(context: TransformContextMove) {
		if (!Condition(this.use_condition)) return;

		let value = this.calculateOffset(context);
		if (this.previous_value == null) this.previous_value = value;
		if (this.initial_value == null) this.initial_value = value;

		if (value != this.previous_value) {
			context.value = value;
			if (!this.has_changed && this.onStart) {
				this.onStart(context)
			}
			if (this.onMove) {
				this.onMove(context)
			}
			this.previous_value = value;
			this.has_changed = true;
		}
	}
	dispatchEnd(context: TransformContextEnd) {
		if (this.onEnd) {
			context.has_changed = this.has_changed;
			this.onEnd(context);
		}
		this.has_changed = false;
	}
	dispatchCancel(context: TransformContextEnd) {
		if (this.onCancel) {
			context.has_changed = this.has_changed;
			this.onCancel(context);
		}
		this.has_changed = false;
	}

	delete() {
		delete TransformerModule.modules[this.id];
	}
	
	static modules: Record<string, TransformerModule> = {};
	static get active(): TransformerModule | undefined {
		let match: TransformerModule | undefined;
		for (let id in TransformerModule.modules) {
			let module = TransformerModule.modules[id];
			if (!Condition(module.condition)) continue;

			if (!match || module.priority > match.priority) {
				match = module;
			}
		}
		return match;
	}
}

const globals = {
	TransformerModule
}
declare global {
	const TransformerModule: typeof globals.TransformerModule
	type TransformerModule = import('./transform_modules').TransformerModule
}
Object.assign(window, globals);
