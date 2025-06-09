declare function initializeDesktopApp(): void
declare function loadOpenWithBlockbenchFile(): void
declare function updateRecentProjects(): void
declare function addRecentProject(data: any): void
declare function updateRecentProjectData(): void
declare function updateRecentProjectThumbnail(): Promise<void>
declare function loadDataFromModelMemory(): void
declare function updateWindowState(e: any, type: any): void
declare function changeImageEditor(texture: any, from_settings: any): void
declare function selectImageEditorFile(texture: any): void
declare function openDefaultTexturePath(): void
declare function findExistingFile(paths: string[]): any
declare function createBackup(init: any): void
declare function closeBlockbenchWindow(): any
