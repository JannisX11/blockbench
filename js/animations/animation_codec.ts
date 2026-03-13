import { Filesystem } from "../file_system";
import { Animation, AnimationItem } from "./animation";
import { AnimationController } from "./animation_controllers";

type FileResult = Filesystem.FileResult;

interface SharedOptions {
	/**
	 * Set to true if multiple animations can be included per animation file
	 */
	multiple_per_file: boolean
	/**
	 * Opens a file picker to select and import animations using the codec
	 */
	pickFile?: () => void
	/**
	 * Given a file input, imports the animations from the file into the current project, while adding undo entries and handling other logic
	 * @param file File to import
	 * @param auto_loaded For specific formats, set to true if the file was automatically loaded instead of based on explicit user input
	 */
	importFile?: (file: FileResult, auto_loaded?: boolean) => void
	/**
	 * Load the animations from an animation file into the project. Not required on generic codecs
	 * @param file File to load
	 * @param animation_filter If specified, only animations with an ID in the list get imported
	 */
	loadFile?: (file: FileResult, animation_filter?: string[]) => void
	/**
	 * Reload a given animation from its file on disk
	 */
	reloadAnimation?: (animation: Animation) => void
	/**
	 * Compile a specified animation into animation file content
	 * @param animation Animation to compile
	 * @returns Compiled subpart of an animation file
	 */
	compileAnimation?: (animation: Animation) => any
	/**
	 * Save the specified animation to its file. If no file exists, or save_as is true, this can open a file save dialog
	 * @param animation Animation to save
	 * @param save_as If true, pick a new location to save to
	 */
	saveAnimation?: (animation: Animation, save_as?: boolean) => void
}
interface AnimationCodecSingleFileOptions extends SharedOptions {}
interface AnimationCodecMultiplePerFileOptions extends SharedOptions {
	multiple_per_file: true
	/**
	 * Reload all currently loaded animations that match the path from the file on disk
	 */
	reloadFile?: (path: string) => void
	/**
	 * Compile the specified list of animations into animation file content
	 * @returns 
	 */
	compileFile?: (animations: AnimationItem[]) => any
	/**
	 * Export all animations that match the path to a file on disk. If a path is specified and a file exists under that path, overwrite that file. Otherwise, or if save_as is true, open a file save dialog
	 * @param path Path to match and export to
	 * @param save_as If true, export the file to a new location
	 * @returns 
	 */
	exportFile?: (path: string, save_as?: boolean) => void
}

export interface AnimationCodec extends SharedOptions {}
/**
 * AnimationCodecs serve as a way to bundle import and export functionality of a specific animation format in one place, that way completely different animation formats can be supported.
 * When creating a new animation codec, add it to the respective ModelFormat as `animation_codec`.
 */
export class AnimationCodec implements SharedOptions {
	id: string

	constructor(id: string, options: AnimationCodecSingleFileOptions | AnimationCodecMultiplePerFileOptions) {
		this.id = id;
		this.multiple_per_file = true;
		Object.assign(this, options);
		AnimationCodec.codecs[id] = this;
	}
	static codecs: Record<string, AnimationCodec> = {}
	static getCodec(animation?: AnimationItem): AnimationCodec {
		if (animation instanceof AnimationController) {
			return AnimationCodec.codecs.bedrock_controller;
		} else if (Format.animation_codec) {
			return Format.animation_codec;
		} else if (Format.animation_files) {
			return AnimationCodec.codecs.bedrock;
		}
	}
}
const global = {
	AnimationCodec,
}
declare global {
	type AnimationCodec = import('./animation_codec').AnimationCodec
	const AnimationCodec: typeof global.AnimationCodec
}
Object.assign(window, global);