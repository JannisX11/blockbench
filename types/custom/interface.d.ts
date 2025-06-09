/// <reference path="./blockbench.d.ts"/>

interface ResizeLineOptions {
	condition?: ConditionResolvable
	horizontal?: boolean
	position(): void
	get(): void
	set(): void
}
declare class ResizeLine {
	constructor(id: string, options: ResizeLineOptions)

	id: string
	horizontal: boolean
	condition?: ConditionResolvable
	width: number
	get(): void
	set(): void
	node: HTMLElement
	update(): void
	setPosition(data: { top?: number; bottom?: number; left?: number; right?: number }): void
}

declare namespace Interface {
	function createElement(
		type: keyof HTMLElementTagNameMap,
		attributes?: {},
		content?: string | HTMLElement | HTMLElement[]
	): HTMLElement

	const data: {
		left_bar_width: number
		right_bar_width: number
		quad_view_x: number
		quad_view_y: number
		timeline_head: number
		left_bar: string[]
		right_bar: string[]
	}
	let left_bar_width: number
	let right_bar_width: number
	let top_panel_height: number
	let bottom_panel_height: number
	function getTopPanel(): Panel
	function getBottomPanel(): Panel
	function getLeftPanels(): Panel[]
	function getRightPanels(): Panel[]
	const Resizers: {
		left: ResizeLine
		right: ResizeLine
		quad_view_x: ResizeLine
		quad_view_y: ResizeLine
		top: ResizeLine
		bottom: ResizeLine
		timeline_head: ResizeLine
	}
	const status_bar: {
		menu: Menu
		vue: Vue.Component
	}
	const Panels: {
		[key: string]: Panel
	}
	function toggleSidebar(side: any, status: any): void

	const text_edit_menu: Menu

	function addSuggestedModifierKey(key: 'ctrl' | 'shift' | 'alt', text: string): void
	function removeSuggestedModifierKey(key: 'ctrl' | 'shift' | 'alt', text: string): void

	const center_screen: HTMLElement
	const page_wrapper: HTMLElement
	const preview: HTMLElement
	const work_screen: HTMLElement
	const right_bar: HTMLElement
	const left_bar: HTMLElement

	namespace CustomElements {
		class SelectInput<T extends Record<string, string>> {
			node: HTMLElement
			constructor(
				id: string,
				options: {
					value?: T[keyof T]
					default?: T[keyof T]
					options: T
					onChange?(value: T[keyof T]): void
				}
			)
			set(value: T[keyof T]): void
		}
		const ResizeLine: any
	}
}
