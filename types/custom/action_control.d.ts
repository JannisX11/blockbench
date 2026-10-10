/**
 * Keybindings and action control
 */
/// <reference types="./blockbench"/>

declare global {



	/**
	 * A dialog-based interface to search and trigger actions and other things
	 */
	namespace ActionControl {
		const open: boolean
		const type: string
		const max_length: number
		const vue: Vue
		function select(input?: string): void
		function show(input?: string): void
		function hide(): void
		function confirm(event: Event): void
		function cancel(): void
		function trigger(action: any, event: Event): void
		function click(action: any, event: Event): void
		function handleKeys(event: Event): boolean
	}
	const Vertexsnap: any
}

export {}
