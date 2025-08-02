import { ModelFormat as _ModelFormat } from "./io/format"
declare global {
	const ModelFormat: typeof _ModelFormat
	const Format: _ModelFormat
	const Formats: Record<string, _ModelFormat>
	namespace Blockbench {
		const ModelFormat: typeof _ModelFormat
		const Format: _ModelFormat
	}
}
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
