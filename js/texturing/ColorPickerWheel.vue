<template>
	<div class="wheel_color_picker" :style="{height: height + 'px', '--size': height + 'px', '--hue': hsv.h + 'deg'}" @pointerdown="pointerDown($event, 'hue')">
		<div class="wheel_color_picker--ring" ref="reference">
			<div class="wheel_color_picker--island" @pointerdown.stop="pointerDown($event, 'triangle')">
				<div class="wheel_color_picker--triangle" ref="triangle"></div>
				<div class="wheel_color_picker--cursor"
					:style="{left: `calc(7.5% + ${position.x}px)`, top: position.y + 'px'}"
				></div>
			</div>
			<div class="wheel_color_picker--hue_cursor"></div>
		</div>
	</div>
</template>

<script lang="js">
import { tl } from '../languages';

function trianglePositionToSV(pt, top, bottomLeft, bottomRight) {
	// 1. Calculate standard barycentric coordinates (u, v, w) using determinants
	const det = (bottomLeft.y - bottomRight.y) * (top.x - bottomRight.x) + 
				(bottomRight.x - bottomLeft.x) * (top.y - bottomRight.y);

	// Weights associated with each vertex
	let wColor = ((bottomLeft.y - bottomRight.y) * (pt.x - bottomRight.x) + 
				(bottomRight.x - bottomLeft.x) * (pt.y - bottomRight.y)) / det;
				
	let wBlack = ((bottomRight.y - top.y) * (pt.x - bottomRight.x) + 
				(top.x - bottomRight.x) * (pt.y - bottomRight.y)) / det;
				
	let wWhite = 1 - wColor - wBlack;

	// 2. Clamp weights to keep the resulting point strictly inside the triangle boundaries
	if (wColor < 0) wColor = 0;
	if (wBlack < 0) wBlack = 0;
	if (wWhite < 0) wWhite = 0;
	
	const sum = wColor + wBlack + wWhite;
	wColor /= sum;
	wBlack /= sum;
	wWhite /= sum;

	// 3. Map the clamped barycentric weights back to HSV (S and V)
	// From forward formula: wBlack = 1 - V  ==>  V = 1 - wBlack
	const v = 1 - wBlack;

	// Avoid division by zero at absolute black (v = 0)
	// From forward formula: wColor = S * V ==> S = wColor / V
	const s = v === 0 ? 0 : wColor / v;

	return { 
		s: Math.clamp(s, 0, 1), 
		v: Math.clamp(v, 0, 1) 
	};
}

export default {
	name: 'color-picker-wheel',
	props: {
		width: Number,
		height: Number,
		hsv: Object
	},
	data() {return {
		update: 0
	}},
	computed: {
		position() {
			this.update;
			let hsv = this.hsv;
			let triangle = this.$refs.triangle;
			let dimensions = [
				triangle ? triangle.clientWidth : 20,
				triangle ? triangle.clientHeight : 20
			];

			const {s, v} = hsv;
			const top   = { x: dimensions[0]/2, y: 0  };
			const left  = { x: 0,  y: dimensions[1] };
			const right = { x: dimensions[0], y: dimensions[1] };

			const w_color = s * v;
			const w_white = (1 - s) * v;
			const w_black = 1 - v;

			return {
				x: w_color * top.x + w_black * left.x + w_white * right.x,
				y: w_color * top.y + w_black * left.y + w_white * right.y,
			}
		}
	},
	methods: {
		pointerDown(e1, channel) {
			let main_ref = this.$refs.reference;
			let triangle = this.$refs.triangle;
			let bounding_box = main_ref.getBoundingClientRect();
			let onMove = (e2) => {
				let x = e2.clientX - bounding_box.x;
				let y = e2.clientY - bounding_box.y;
				let hsv = this.hsv;

				if (channel == 'hue') {
					let angle = Math.atan2(
						y - bounding_box.height/2,
						x - bounding_box.width/2,
					);
					let hue = Math.radToDeg(angle);
					hsv.h = (360 + 90 + hue) % 360;
				} else {
					const pos = new THREE.Vector2(x, y);
					pos.rotateAround({x: bounding_box.width/2, y: bounding_box.height/2}, Math.degToRad(-this.hsv.h));
					pos.y -= triangle.parentElement.offsetTop;
					pos.x -= triangle.parentElement.offsetLeft + triangle.offsetLeft;
					const top   = { x: triangle.clientWidth/2, y: 0  };
					const left  = { x: 0,  y: triangle.clientHeight };
					const right = { x: triangle.clientWidth, y: triangle.clientHeight };
					Object.assign(hsv, trianglePositionToSV(pos, top, left, right));

				}
				this.$emit('input', this.hsv);
			}
			let onUp = (e2) => {
				document.removeEventListener('pointermove', onMove);
				document.removeEventListener('pointerup', onUp);
			}
			document.addEventListener('pointermove', onMove);
			document.addEventListener('pointerup', onUp);
			onMove(e1);
		},
		tl,
	},
	mounted() {
		this.update++;
	}
}
</script>

<style>
	.wheel_color_picker {
		position: relative;
		max-width: var(--size);
		margin: auto;
		touch-action: none;
	}
	.wheel_color_picker--ring {
		position: relative;
		margin: 5px;
		height: calc(100% - 10px);
		width: calc(100% - 10px);
		border-radius: 50%;
		background: conic-gradient(red, yellow, lime, cyan, blue, magenta, red);
		--ring-width: 16px;
	}
	.wheel_color_picker--island {
		position: absolute;
		right: var(--ring-width);
		left: var(--ring-width);
		top: var(--ring-width);
		bottom: var(--ring-width);
		border-radius: 50%;
		background-color: var(--color-ui);
		rotate: var(--hue);
	}
	.wheel_color_picker--hue_cursor {
		position: absolute;
		cursor: pointer;
		height: 0;
		width: 0;
		top: 50%;
		left: 50%;
		right: 50%;
		bottom: 50%;
		transform: rotate(calc(var(--hue) - 90deg));
	}
	.wheel_color_picker--hue_cursor::before {
		border-width: 8px;
		margin-top: -8px;
		border-color: var(--color-border);
	}
	.wheel_color_picker--hue_cursor::after {
		border-width: 7px;
		margin-top: -7px;
		border-color: var(--color-light);
	}
	.wheel_color_picker--hue_cursor::before,
	.wheel_color_picker--hue_cursor::after {
		position: absolute;
		content: "";
		margin-left: calc((var(--size) - 42px) / 2);
		width: calc(var(--ring-width));
		border-style: solid;
		border-top-color: transparent;
		border-bottom-color: transparent;
		border-radius: 3px;
	}
	.wheel_color_picker--cursor {
		position: absolute;
		border-radius: 6px;
		height: 10px;
		width: 10px;
		border: 1px solid var(--color-border);
		background: var(--color-light);
		cursor: pointer;
		top: 0;
		left: 0;
		z-index: 2;
		margin: -5px;
	}

    .wheel_color_picker--triangle {
		width: 85%;
		height: 74%;
		margin: auto;
		--pct: 84%;
		background:
			linear-gradient(to bottom, hsl(var(--hue), 100%, 50%) 0, transparent 100%),
			linear-gradient(300deg, white 0, transparent 66.6%)
			black;
		clip-path: polygon(50% 0%, 0% 100%, 100% 100%);
    }
</style>