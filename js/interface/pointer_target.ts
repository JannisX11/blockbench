
export type PointerTargetType = {
	id: string
	priority: number
	persist_after_pointerup?: boolean
}

/**
 * Tracks which function the pointer / pointer drag is currently targeting. E. g. painting, using gizmos etc.
 */
export class PointerTarget {
	static active: PointerTargetType | null = null;
	static types = {
		navigate: {
			id: 'navigate',
			priority: 0
		},
		paint: {
			id: 'paint',
			priority: 1
		},
		gizmo_transform: {
			id: 'gizmo_transform',
			priority: 2
		},
		global_drag_slider: {
			id: 'global_drag_slider',
			priority: 3
		}
	};
	static checkTarget(target: PointerTargetType): boolean {
		if (PointerTarget.active && PointerTarget.active.priority > target.priority) {
			return false;
		} else {
			return true;
		}
	}
	static requestTarget(target: PointerTargetType): boolean {
		if (PointerTarget.checkTarget(target) == false) return false;
		PointerTarget.active = target;
		return true;
	}
	static endTarget(target?: PointerTargetType): void {
		if (target && target != PointerTarget.active) return;
		PointerTarget.active = null;
	}
	static hasMinPriority(priority: number) {
		return PointerTarget.active && PointerTarget.active.priority >= priority;
	}
}
document.addEventListener('pointerup', event => {
	if (PointerTarget.active && !PointerTarget.active.persist_after_pointerup) {
		PointerTarget.endTarget();
	}
});
Object.assign(window, {
	PointerTarget
})
