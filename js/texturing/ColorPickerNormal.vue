<template>
	<div
		class="normal_map_color_picker"
		:style="{ height: height + 'px' }"
		@pointerdown="pointerDown($event)"
	>
		<div class="normal_map_color_picker--bg_x" ref="reference"></div>
		<div class="normal_map_color_picker--bg_y"></div>
		<div
			class="normal_map_color_picker--cursor"
			:style="{ left: position.x + 'px', top: position.y + 'px' }"
		></div>
	</div>
</template>

<script lang="js">
import tinycolor from 'tinycolor2'
import { tl } from '../languages'

export default {
	name: 'color-picker-normal',
	props: {
		width: Number,
		height: Number,
		value: String,
	},
	data() {
		return {}
	},
	computed: {
		position() {
			let color = new tinycolor(this.value)
			let rgb = color.toRgb()
			let square = {
				x: (rgb.r / 255 - 0.5) * 100,
				y: (rgb.g / 255 - 0.5) * 100,
			}
			let angle = Math.atan2(square.y, square.x)
			let distance = Math.sqrt(Math.pow(square.x, 2) + Math.pow(square.y, 2))
			distance = Math.clamp(distance, -50, 50)
			return {
				x: ((50 + Math.cos(angle) * distance) / 100) * (this.height - 10) + 5,
				y: ((50 - Math.sin(angle) * distance) / 100) * (this.width - 10) + 5,
			}
		},
	},
	methods: {
		pointerDown(e1) {
			let bounding_box = this.$refs.reference.getBoundingClientRect()
			let onMove = e2 => {
				let x = e2.clientX - bounding_box.x
				let y = e2.clientY - bounding_box.y
				let color = new tinycolor({
					r: (x / (this.width - 10)) * 255,
					g: (1 - y / (this.height - 10)) * 255,
					b: 255,
				})
				this.$emit('input', '#' + color.toHex())
			}
			let onUp = e2 => {
				document.removeEventListener('pointermove', onMove)
				document.removeEventListener('pointerup', onUp)
			}
			document.addEventListener('pointermove', onMove)
			document.addEventListener('pointerup', onUp)
			onMove(e1)
		},
		tl,
	},
}
</script>

<style>
.normal_map_color_picker {
	position: relative;
	height: 300px;
}
.normal_map_color_picker--bg_x,
.normal_map_color_picker--bg_y {
	top: 5px;
	left: 5px;
	height: calc(100% - 10px);
	width: calc(100% - 10px);
	position: absolute;
	pointer-events: none;
	border-radius: 50%;
}
.normal_map_color_picker--bg_x {
	background: linear-gradient(to right, rgb(0, 0, 255), rgb(255, 0, 255));
}
.normal_map_color_picker--bg_y {
	background: linear-gradient(to top, rgb(0, 0, 255), rgb(0, 255, 255));
	mix-blend-mode: lighten;
}
.normal_map_color_picker--bg_x::before,
.normal_map_color_picker--bg_x::after {
	content: '';
	width: 2px;
	height: 2px;
	position: absolute;
	background-color: var(--color-light);
	opacity: 0.2;
	z-index: 1;
}
.normal_map_color_picker--bg_x::before {
	width: 100%;
	top: calc(50% - 1px);
	left: 0;
	right: 0;
}
.normal_map_color_picker--bg_x::after {
	height: 100%;
	top: 0;
	bottom: 0;
	left: calc(50% - 1px);
}
.normal_map_color_picker--cursor {
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
</style>
