// Dummy exports for native APIs when running on web

const NULL = null
/** @internal */
export {
	NULL as electron,
	NULL as clipboard,
	NULL as shell,
	NULL as nativeImage,
	NULL as ipcRenderer,
	NULL as webUtils,
	NULL as app,
	NULL as fs,
	NULL as NodeBuffer,
	NULL as zlib,
	NULL as child_process,
	NULL as https,
	NULL as PathModule,
	NULL as os,
	NULL as currentwindow,
	NULL as dialog,
	NULL as openFileInEditor,
	NULL as getPluginScopedRequire,
	NULL as process,
	NULL as SystemInfo,
	NULL as revokePluginPermissions,
}

/**
 * @internal
 */
export function getPCUsername() {
	return ''
}
