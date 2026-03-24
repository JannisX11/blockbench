import { Prop } from "../misc"

interface ResizeLinePositionData {
	top?: number
	bottom?: number
	left?: number
	right?: number
}

interface ResizeLineOptions {
	id?: string
	horizontal?: boolean
	condition: ConditionResolvable
	width?: number
	get: (this: ResizeLine) => number
	set: (this: ResizeLine, original: number, difference: number) => void
	reset?: (this: ResizeLine) => void
	position?: (this: ResizeLine) => void
}
export interface ResizeLine extends ResizeLineOptions {}


export class ResizeLine implements ResizeLineOptions {
	before?: number
	node: HTMLDivElement

	constructor(id: string, data: ResizeLineOptions) {
		var scope = this;
		if (typeof id == 'object') {
			data = id;
			id = data.id;
		}
		this.id = id
		ResizeLine.resizers[this.id] = this;
		this.horizontal = data.horizontal === true
		this.position = data.position
		this.condition = data.condition
		this.width = 0;
		this.get = data.get;
		this.set = data.set;
		this.reset = data.reset;
		this.node = document.createElement('div');
		this.node.className = 'resizer '+(data.horizontal ? 'horizontal' : 'vertical');
		this.node.id = 'resizer_'+this.id;

		this.node.addEventListener('pointerdown', (event: PointerEvent) => {
			this.before = this.get();
			this.node.classList.add('dragging');
			let move = (e2: PointerEvent) => {
				let difference = scope.horizontal
					? e2.clientY - event.clientY
					: e2.clientX - event.clientX;
				this.set(scope.before, difference);
				updateInterface();
				this.update();
				Blockbench.setCursorTooltip(Math.round(this.get()).toString());
			}
			let stop = (e2: PointerEvent) => {
				document.removeEventListener('pointermove', move, false);
				document.removeEventListener('pointerup', stop, false);
				updateInterface()
				this.update();
				this.node.classList.remove('dragging');
				Blockbench.setCursorTooltip();
			}
			document.addEventListener('pointermove', move, false);
			document.addEventListener('pointerup', stop, false);
		})
		if (this.reset) {
			this.node.addEventListener('dblclick', event => {
				this.reset();
				updateInterface();
				this.update();
			})
		}
	}
	update() {
		if (Condition(this.condition)) {
			$(this.node).show()
			if (this.position) {
				this.position.call(this, this)
			}
		} else {
			$(this.node).hide()
		}
	}
	setPosition(data: ResizeLinePositionData) {
		this.node.style.top = 	data.top 	!== undefined ? data.top+	'px' : '';
		this.node.style.bottom =data.bottom !== undefined ? data.bottom+'px' : '';
		this.node.style.left = 	data.left 	!== undefined ? data.left+	'px' : '';
		this.node.style.right = data.right 	!== undefined ? data.right+	'px' : '';

		if (data.top !== undefined) {
			this.node.style.top = data.top+'px';
		}
		if (data.bottom !== undefined && (!this.horizontal || data.top === undefined)) {
			this.node.style.bottom = data.bottom+'px';
		}
		if (data.left !== undefined) {
			this.node.style.left = data.left+'px';
		}
		if (data.right !== undefined && (this.horizontal || data.left === undefined)) {
			this.node.style.right = data.right+'px';
		}
	}

	static resizers: Record<string, ResizeLine> = {};
}

export function setupResizeLines() {
	new ResizeLine('left', {
		condition() {
			if (Blockbench.isMobile) return false;
			if (!Prop.show_left_bar) return false;
			if (!Mode.selected) return false;
			for (let p of Interface.getLeftPanels(false)) {
				if (p && BARS.condition(p.condition) && p.slot == 'left_bar') {
					return true;
				}
			}
		},
		get() {return Interface.left_bar_width},
		set(o, diff) {
			let min = 128;
			let calculated = limitNumber(o + diff, min, window.innerWidth- 120 - Interface.right_bar_width)
			Interface.getModeData().left_bar_width = Math.snapToValues(calculated, [Interface.default_data.left_bar_width], 16);
			
			if (calculated == min) {
				Prop.show_left_bar = false;
				Interface.getModeData().left_bar_width = Interface.default_data.left_bar_width;
			} else {
				Prop.show_left_bar = true;
			}
		},
		reset() {
			Interface.getModeData().left_bar_width = Interface.default_data.left_bar_width;
			Prop.show_left_bar = true;
		},
		position() {
			this.setPosition({
				top: 0,
				bottom: 0,
				left: Interface.left_bar_width+2
			})
		}
	});
	new ResizeLine('right', {
		condition() {
			if (Blockbench.isMobile) return false;
			if (!Prop.show_right_bar) return false;
			if (!Mode.selected) return false;
			for (let p of Interface.getRightPanels(false)) {
				if (p && BARS.condition(p.condition) && p.slot == 'right_bar') {
					return true;
				}
			}
		},
		get() {return Interface.right_bar_width},
		set(o, diff) {
			let min = 128;
			let calculated = limitNumber(o - diff, min, window.innerWidth- 120 - Interface.left_bar_width);
			Interface.getModeData().right_bar_width = Math.snapToValues(calculated, [Interface.default_data.right_bar_width], 12);
			
			if (calculated == min) {
				Prop.show_right_bar = false;
				Interface.getModeData().right_bar_width = Interface.default_data.right_bar_width;
			} else {
				Prop.show_right_bar = true;
			}
		},
		reset() {
			Interface.getModeData().right_bar_width = Interface.default_data.right_bar_width;
			Prop.show_right_bar = true;
		},
		position() {
			this.setPosition({
				top: 30,
				bottom: 0,
				right: Interface.right_bar_width-2
			})
		}
	});
	new ResizeLine('quad_view_x', {
		condition() {return Preview.split_screen.enabled && Preview.split_screen.mode != 'double_horizontal'},
		get() {return Interface.data.quad_view_x},
		set(o, diff) {Interface.data.quad_view_x = limitNumber(o + diff/Interface.preview.clientWidth*100, 5, 95)},
		reset() {
			Interface.data.quad_view_x = Interface.default_data.quad_view_x;
		},
		position() {
			let p = Interface.preview;
			if (!p) return;
			let top = Interface.center_screen.offsetTop;
			let bottom = window.innerHeight - (p.clientHeight + $(p).offset().top);
			let left = Interface.left_bar_width + 3 + p.clientWidth*Interface.data.quad_view_x/100;
			if (Preview.split_screen.mode == 'triple_top') {
				top = top + p.clientHeight * (Interface.data.quad_view_y/100);
			} else if (Preview.split_screen.mode == 'triple_bottom') {
				bottom = bottom + p.clientHeight * (1 - Interface.data.quad_view_y/100);
			}
			this.setPosition({top, bottom, left});
		}
	});
	new ResizeLine('quad_view_y', {
		horizontal: true,
		condition() {return Preview.split_screen.enabled && Preview.split_screen.mode != 'double_vertical'},
		get() {return Interface.data.quad_view_y},
		set(o, diff) {
			Interface.data.quad_view_y = limitNumber(o + diff/Interface.preview.clientHeight*100, 5, 95)
		},
		reset() {
			Interface.data.quad_view_y = Interface.default_data.quad_view_y;
		},
		position() {
			let p = Interface.preview;
			if (!p) return;
			let left = Interface.left_bar_width+2;
			let right = Interface.right_bar_width+2;
			let top = Interface.center_screen.offsetTop + Interface.preview.clientHeight*Interface.data.quad_view_y/100;
			if (Preview.split_screen.mode == 'triple_left') {
				left = left + p.clientWidth * (Interface.data.quad_view_x/100);
			} else if (Preview.split_screen.mode == 'triple_right') {
				right = right + p.clientWidth * (1 - Interface.data.quad_view_x/100);
			}
			this.setPosition({left, right, top});
		}
	});
	new ResizeLine('top', {
		horizontal: true,
		condition() {return !Blockbench.isMobile && !!Interface.getTopPanel()},
		get() {
			let panel = Interface.getTopPanel();
			return panel.folded ? panel.tab_bar.clientHeight : panel.height;
		},
		set(o, diff) {
			let panel = Interface.getTopPanel();
			panel.position_data.height = Math.max(o + diff, 150);
			if (panel.folded) panel.fold(false);
			panel.update();
			if (Interface.getBottomPanel()) Interface.getBottomPanel().update();
		},
		position() {this.setPosition({
			left: Interface.left_bar_width+2,
			right: Interface.right_bar_width+2,
			top: this.get() + Interface.center_screen.offsetTop + 4
		})}
	});
	new ResizeLine('bottom', {
		horizontal: true,
		condition() {return !Blockbench.isMobile && !!Interface.getBottomPanel()},
		get() {
			let panel = Interface.getBottomPanel();
			return panel.folded ? panel.tab_bar.clientHeight : panel.height;
		},
		set(o, diff) {
			let panel = Interface.getBottomPanel();
			panel.position_data.height = Math.max(o - diff, 150);
			if (panel.folded) panel.fold(false);
			panel.update();
			if (Interface.getTopPanel()) Interface.getTopPanel().update();
		},
		position() {this.setPosition({
			left: Interface.left_bar_width+2,
			right: Interface.right_bar_width+2,
			top: Interface.work_screen.clientHeight - document.getElementById('status_bar').clientHeight - this.get()
		})}
	});
	new ResizeLine('timeline_head', {
		horizontal: false,
		condition() {return Modes.animate && !Blockbench.isMobile},
		get() {return Interface.data.timeline_head},
		set(o, diff) {
			let value = limitNumber(o + diff, 90, Panels.timeline.node.clientWidth - 40);
			value = Math.snapToValues(value, [Interface.default_data.timeline_head], 12);
			Interface.data.timeline_head = Timeline.vue.$data.head_width = value;
		},
		reset() {
			Interface.data.timeline_head = Interface.default_data.timeline_head;
		},
		position() {
			let offset = $(Panels.timeline.vue.$el).offset();
			this.setPosition({
				left: offset.left + 2 + Interface.data.timeline_head,
				top: offset.top - Interface.work_screen.offsetTop + 30,
				bottom: Interface.work_screen.clientHeight - offset.top + Interface.work_screen.offsetTop - Panels.timeline.vue.$el.clientHeight + 10
			})
		}
	});
}

const global = {
	ResizeLine
}
declare global {
	const ResizeLine: typeof global.ResizeLine
	type ResizeLine = import('./resize_lines').ResizeLine
}
Object.assign(window, global);
