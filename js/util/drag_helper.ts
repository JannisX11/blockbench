/**
 * Utility to implement dragging UI elements such as draggable elements, resize bars, etc.
 */


export interface DragOptions {
	start_distance?: number
	onStart?(context: DragContext): void
	onMove?(context: DragContext): void
	onEnd?(context: DragContext): void
}
export interface DragContext {
	start_event: PointerEvent | MouseEvent
	event: PointerEvent | null
	delta: {x: number, y: number}
	distance: number
}
/**
 * Initialize a drag helper once a pointer-down event has been fired
 * IMPORTANT: To make it work correctly with stylus, ensure "touch-action" is set to "none" on the target element
 * @param e1 Initial pointer-down event
 * @param options Drag options
 */
export function dragHelper(e1: PointerEvent | MouseEvent, options: DragOptions): void {
	let started = false;
	let context: DragContext = {
		start_event: e1,
		event: e1 as PointerEvent,
		delta: {x: 0, y: 0},
		distance: 0
	};
	let drag = (e2: PointerEvent) => {
		let delta = {
			x: e2.clientX - e1.clientX,
			y: e2.clientY - e1.clientY,
		};
		let distance = Math.sqrt(Math.pow(delta.x, 2) + Math.pow(delta.y, 2));
		context.delta = delta;
		context.distance = distance;
		context.event = e2;
		if (!started) {
			if (distance > (options.start_distance ?? 6)) {
				started = true;
				if (options.onStart) options.onStart(context);
			} else {
				return;
			}
		}
		if (options.onMove) options.onMove(context);
	}
	let stop = (e2: PointerEvent) => {
		document.removeEventListener('pointermove', drag);
		document.removeEventListener('pointerup', stop);
		context.event = e2;
		if (options.onEnd) options.onEnd(context);
	};
	document.addEventListener('pointermove', drag);
	document.addEventListener('pointerup', stop);
}