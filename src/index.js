import './languages'

import blender from './../keymaps/blender.bbkeymap';
import cinema4d from './../keymaps/cinema4d.bbkeymap';
import maya from './../keymaps/maya.bbkeymap';

window.KeymapPresets = {
	blender,
	cinema4d,
	maya,
}

import DarkTheme from './../themes/dark.bbtheme'
import LightTheme from './../themes/light.bbtheme'
import ContrastTheme from './../themes/contrast.bbtheme'

window.CustomThemeOptions = [
	DarkTheme,
	LightTheme,
	ContrastTheme
]
