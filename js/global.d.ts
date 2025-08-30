import { ModelFormat as _ModelFormat } from './io/format'
import {
	settings as _settings,
	Setting as _Setting,
	SettingsProfile as _SettingsProfile,
	Settings as _Settings,
} from './interface/settings'
import { Modes as _Modes, Mode as _Mode } from './modes'
import {
	Dialog as _Dialog,
	ConfigDialog as _ConfigDialog,
	DialogSidebar as _DialogSidebar,
	MessageBox as _MessageBox,
	ShapelessDialog as _ShapelessDialog,
	ToolConfig as _ToolConfig,
} from './interface/dialog'
import {
	Property as _Property,
} from './util/property'

declare global {
	const ModelFormat: typeof _ModelFormat
	const Format: _ModelFormat
	const Formats: Record<string, _ModelFormat>
}
declare global {
	const settings: typeof _settings
	const Setting: typeof _Setting
	const SettingsProfile: typeof _SettingsProfile
	const Settings: typeof _Settings
}
declare global {
	const Modes: typeof _Modes
	const Mode: typeof _Mode
}
declare global {
	const Dialog: typeof _Dialog
	const ConfigDialog: typeof _ConfigDialog
	const DialogSidebar: typeof _DialogSidebar
	const MessageBox: typeof _MessageBox
	const ShapelessDialog: typeof _ShapelessDialog
	const ToolConfig: typeof _ToolConfig
}
declare global {
	const Property: typeof _Property
}
