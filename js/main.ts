//import { createApp } from 'vue'
//import App from './App.vue'

import "../lib/libs"
import "../lib/jquery-ui.min"
import "../lib/targa"
import "../lib/VuePrismEditor.min"
import "../lib/molang-prism-syntax"
import "../lib/lzutf8"
import "../lib/spectrum.js"
import "../lib/color-picker.min"
import "../lib/GLTFExporter"
import "../lib/CanvasFrame"
import "../lib/canvas2apng"
import "../lib/easing"
import "./preview/OrbitControls"

import './languages'
import "./util/util"
import "./util/json"
import "./util/three_custom"
import "./util/math_util"
import "./util/array_util"
import "./util/event_system"
import "./util/property"
import "./interface/menu"
import "./interface/actions"
import "./interface/themes"
import "./interface/shared_actions"
import "./interface/keyboard"
import "./misc"
import "./api"
import "./modes"
import "./file_system"
import "./interface/vue_components"
import "./interface/panels"
import "./interface/interface"
import "./interface/menu_bar"
import "./interface/start_screen"
import "./interface/form"
import "./interface/dialog"
import "./interface/keybinding"
import "./interface/settings"
import "./interface/about"
import "./interface/action_control"
import "./copy_paste"
import "./undo"

import './desktop.js';

import "./interface/setup_settings"
import "./edit_sessions"
import "./validator"
import "./outliner/outliner"
import "./outliner/element_panel"
import "./outliner/collections"
import "./outliner/group"
import "./outliner/mesh"
import "./outliner/cube"
import "./outliner/billboard"
import "./outliner/texture_mesh"
import "./outliner/locator"
import "./outliner/null_object"
import "./preview/preview"
import "./preview/reference_images"
import "./preview/screenshot"
import "./preview/canvas"
import "./modeling/edit"
import "./modeling/transform_gizmo"
import "./modeling/transform"
import "./modeling/scale"
import "./modeling/mesh_editing"
import "./modeling/mirror_modeling"
import "./texturing/layers"
import "./texturing/textures"
import "./texturing/texture_groups"
import "./texturing/texture_flipbook"
import "./texturing/uv"
import "./texturing/painter"
import "./texturing/texture_generator"
import "./texturing/edit_image"
import "./display_mode"
import "./animations/animation_mode"
import "./animations/animation"
import "./animations/molang"
import "./animations/timeline_animators"
import "./animations/keyframe"
import "./animations/timeline"
import "./animations/animation_controllers"
import "./preview/preview_scenes"
import "./predicate_editor"
import "./plugin_loader"
import "./io/codec"
import "./io/format"
import "./io/project"
import "./io/io"
import "./io/share"
import "./texturing/color"
import "./io/formats/generic"
import "./io/formats/bbmodel"
import "./io/formats/java_block"
import "./io/formats/bedrock"
import "./io/formats/bedrock_old"
import "./io/formats/obj"
import "./io/formats/gltf"
import "./io/formats/fbx"
import "./io/formats/collada"
import "./io/formats/modded_entity"
import "./io/formats/optifine_jem"
import "./io/formats/optifine_jpm"
import "./io/formats/skin"
import "./io/formats/image"
import "./boot_loader"
import "./globals"

import {
	settings as _settings,
	Setting as _Setting,
	SettingsProfile as _SettingsProfile,
	Settings as _Settings,
} from './interface/settings'
declare global {
	const settings: typeof _settings
	const Setting: typeof _Setting
	const SettingsProfile: typeof _SettingsProfile
	const Settings: typeof _Settings
	namespace Blockbench {
		const settings: typeof _settings
		const Setting: typeof _Setting
		const SettingsProfile: typeof _SettingsProfile
		const Settings: typeof _Settings
	}
}
import {
	Modes as _Modes,
	Mode as _Mode,
} from './modes'
declare global {
	const Modes: typeof _Modes
	const Mode: typeof _Mode
	namespace Blockbench {
		const Modes: typeof _Modes
		const Mode: typeof _Mode
	}
}
