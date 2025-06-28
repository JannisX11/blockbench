/// <reference types="vue" />
/// <reference types="./three" />
/// <reference types="@types/prismjs" />
/// <reference types="@types/jquery" />
/// <reference types="wintersky" />

/// <reference types="./texture_layers" />
/// <reference types="./texture_group" />
/// <reference types="./action" />
/// <reference types="./animation" />
/// <reference types="./animation_controller" />
/// <reference types="./canvas_frame" />
/// <reference types="./canvas" />
/// <reference types="./codec" />
/// <reference types="./cube" />
/// <reference types="./desktop" />
/// <reference types="./dialog" />
/// <reference types="./display_mode" />
/// <reference types="./format" />
/// <reference types="./global" />
/// <reference types="./group" />
/// <reference types="./interface" />
/// <reference types="./keyframe" />
/// <reference types="./menu" />
/// <reference types="./mesh" />
/// <reference types="./misc" />
/// <reference types="./molang" />
/// <reference types="./outliner" />
/// <reference types="./painter" />
/// <reference types="./preview" />
/// <reference types="./preview_scene" />
/// <reference types="./project" />
/// <reference types="./screencam" />
/// <reference types="./textures" />
/// <reference types="./timeline" />
/// <reference types="./undo" />
/// <reference types="./util" />
/// <reference types="./uveditor" />
/// <reference types="./validator" />
/// <reference types="./shared_actions" />
/// <reference types="./display_mode" />
/// <reference types="./misc" />
/// <reference types="./util" />
/// <reference types="./math_util" />
/// <reference types="./canvas_frame" />
/// <reference types="./io" />

/**
 * Provides access to global Javascript/DOM variables that are overwritten by Blockbench's own variables
 */
declare const NativeGlobals: {
	Animation: {
		new (
			effect?: AnimationEffect | null | undefined,
			timeline?: AnimationTimeline | null | undefined
		): Animation
		prototype: Animation
	}
}

/**
 * Shader support
 */
declare module "*.glsl" {
	const value: string;
	export default value;
}
declare module "*.bbtheme" {
	const value: string | any;
	export default value;
}
