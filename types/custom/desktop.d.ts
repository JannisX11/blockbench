
declare function updateRecentProjects(): void
declare function addRecentProject(data: any): void
declare function updateRecentProjectData(): void
declare function updateRecentProjectThumbnail(): Promise<void>
declare function loadDataFromModelMemory(): void
declare function changeImageEditor(texture: any, from_settings: any): void
declare function openDefaultTexturePath(): void

declare function createBackup(init: any): void
declare function closeBlockbenchWindow(): any

type ScopedFS = Pick<typeof import("node:fs"), 
	"copyFile" |
	"copyFileSync" |
	"readFile" |
	"readFileSync" |
	"writeFile" |
	"writeFileSync" |
	"appendFile" |
	"appendFileSync" |
	"existsSync" |
	"mkdir" |
	"mkdirSync" |
	"readdir" |
	"readdirSync" |
	"rename" |
	"renameSync" |
	"rm" |
	"rmSync" |
	"rmdir" |
	"rmdirSync" |
	"unlink" |
	"unlinkSync" |
	"stat" |
	"statSync"
> & {
	promises: Pick<typeof import("node:fs").promises, 
		"copyFile" |
		"readFile" |
		"writeFile" |
		"appendFile" |
		"mkdir" |
		"readdir" |
		"rename" |
		"rm" |
		"rmdir" |
		"unlink" |
		"stat"
	>
}
interface RequireDialogOptions {
	message?: string
	optional?: boolean
}
declare function requireNativeModule(module: 'fs', options?: {scope?: string} & RequireDialogOptions): ScopedFS | undefined
declare function requireNativeModule(module: 'path'): typeof import("node:path");
declare function requireNativeModule(module: 'crypto'): typeof import("node:crypto");
declare function requireNativeModule(module: 'events'): typeof import("node:events");
declare function requireNativeModule(module: 'zlib'): typeof import("node:zlib");
declare function requireNativeModule(module: 'timers'): typeof import("node:timers");
declare function requireNativeModule(module: 'url'): typeof import("node:url");
declare function requireNativeModule(module: 'string_decoder'): typeof import("node:string_decoder");
declare function requireNativeModule(module: 'querystring'): typeof import("node:querystring");
declare function requireNativeModule(module: 'child_process', options?: RequireDialogOptions): (typeof import("node:child_process")) | undefined;
declare function requireNativeModule(module: 'electron', options?: RequireDialogOptions): (typeof import("node:electron")) | undefined;
declare function requireNativeModule(module: 'https', options?: RequireDialogOptions): (typeof import("node:https")) | undefined;
declare function requireNativeModule(module: 'net', options?: RequireDialogOptions): (typeof import("node:net")) | undefined;
declare function requireNativeModule(module: 'tls', options?: RequireDialogOptions): (typeof import("node:tls")) | undefined;
declare function requireNativeModule(module: 'util', options?: RequireDialogOptions): (typeof import("node:util")) | undefined;
declare function requireNativeModule(module: 'os', options?: RequireDialogOptions): (typeof import("node:os")) | undefined;
declare function requireNativeModule(module: 'v8', options?: RequireDialogOptions): (typeof import("node:v8")) | undefined;
