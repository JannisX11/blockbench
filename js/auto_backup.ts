import { FormElementOptions } from "./interface/form";
import { addStartScreenSection } from "./interface/start_screen";
import { currentwindow } from "./native_apis";
import { getDateDisplay } from "./util/util";

type ProjectSave = {
	uuid: UUID
	data: string
	name?: string
	date?: number
}

//Backup
export const AutoBackup = {
	/**
	 * IndexedDB Database
	 */
	db: null as (null | IDBDatabase),
	initialize(): void {
		let request = indexedDB.open('auto_backups', 1);
		request.onerror = function(e) {
			console.error('Failed to load backup database', e);
		}
		request.onblocked = function(e) {
			console.error('Another instance of Blockbench is opened, the backup database cannot be upgraded at the moment');
		}
		request.onupgradeneeded = function() {
			let db = request.result;
			let store = db.createObjectStore('projects', {keyPath: 'uuid'});

			// Legacy system
			let backup_models = localStorage.getItem('backup_model')
			if (backup_models) {
				let parsed_backup_models = JSON.parse(backup_models);
				for (let uuid in parsed_backup_models) {
					let model = JSON.stringify(parsed_backup_models[uuid]);
					store.put({uuid, data: model});
				}
				console.log(`Upgraded ${Object.keys(parsed_backup_models).length} project back-ups to indexedDB`);
			}
		}
		request.onsuccess = async function() {
			AutoBackup.db = request.result;
			
			// Start Screen Message
			let has_backups = await AutoBackup.hasBackups();
			// @ts-expect-error
			if (has_backups && (!isApp || !currentwindow.webContents.second_instance)) {

				let section = addStartScreenSection('recover_backup', {
					graphic: {type: 'icon', icon: 'fa-archive'},
					// @ts-ignore Idk
					insert_before: 'start_files',
					text: [
						{type: 'h3', text: tl('message.recover_backup.title')},
						{type: 'p', text: tl('message.recover_backup.message')},
						{type: 'button', text: tl('message.recover_backup.recover'), click: (e) => {
							AutoBackup.recoverAllBackups(true).then(() => {
								section.delete();
							});
						}},
						{type: 'button', text: tl('dialog.discard'), click: (e) => {
							AutoBackup.removeAllBackups();
							section.delete();
						}}
					]
				})
			}

			AutoBackup.backupProjectLoop(false);
		}
	},
	async backupOpenProject() {
		if (!Project) return;
		let transaction = AutoBackup.db.transaction('projects', 'readwrite');
		let store = transaction.objectStore('projects');

		let model = Codecs.project.compile({compressed: false, backup: true, raw: true});
		let model_json = JSON.stringify(model);
		let project_save: ProjectSave = {
			uuid: Project.uuid,
			data: model_json,
			name: Project.name,
			date: Math.round(Date.now() / 1000)
		}
		store.put(project_save);
		
		await new Promise((resolve) => {
			transaction.oncomplete = resolve;
		})
	},
	/**
	 * Test if saved backups exist
	 */
	async hasBackups(): Promise<boolean> {
		let transaction = AutoBackup.db.transaction('projects', 'readonly');
		let store = transaction.objectStore('projects');
		return await new Promise(resolve => {
			let request = store.count();
			request.onsuccess = function() {
				resolve(!!request.result);
			}
			request.onerror = function(e) {
				console.error(e);
				resolve(false);
			}
		})
	},
	/**
	 * Recover all saved backups
	 */
	recoverAllBackups(confirm_selection: boolean = false): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			let transaction = AutoBackup.db.transaction('projects', 'readonly');
			let store = transaction.objectStore('projects');
			let request = store.getAll();
			request.onsuccess = async function() {
				let projects = request.result as ProjectSave[];

				// Confirm selection
				if (confirm_selection && projects.length > 1) {
					let form: Record<string, FormElementOptions | '_'> = {};
					let keys: UUID[] = [];

					projects.sort((a, b) => (b.date??0) - (a.date??0));
					for (let project of projects) {
						let label = project.name ?? tl('message.recover_backup.unknown_project');
						let description: string;
						if (project.date) {
							let date = getDateDisplay(project.date * 1000);
							label += ` (${date.short})`;
							description = date.full;
						}
						form[project.uuid] = {
							label,
							description,
							type: 'checkbox',
							value: true
						}
						keys.push(project.uuid);
					}
					form.select_all_none = {
						type: 'buttons',
						buttons: ['generic.select_all', 'generic.select_none'],
						click(index) {
							let values = {};
							keys.forEach(key => values[key] = (index == 0));
							Dialog.open.setFormValues(values);
						}
					}
					form.delete_others = {
						type: 'checkbox',
						label: 'message.recover_backup.discard_others',
						value: false,
					}
					
					projects = await new Promise<ProjectSave[]>((resolve, reject) => {
						new Dialog({
							id: 'recover_backup',
							title: 'message.recover_backup.title',
							form,
							onConfirm(form_result) {
								let to_open: ProjectSave[] = [];
								for (let project of projects) {
									if (form_result[project.uuid]) {
										to_open.push(project);
									} else if (form_result[project.uuid] == false && form_result.delete_others) {
										AutoBackup.removeBackup(project.uuid);
									}
								}
								resolve(to_open);
							}
						}).show();
					})
				}

				projects.sort((a, b) => (a.date??0) - (b.date??0));
				for (let project of projects) {
					try {
						let parsed_content = JSON.parse(project.data);
						setupProject(Formats[parsed_content.meta.model_format] || Formats.free, project.uuid);
						Codecs.project.parse(parsed_content, 'backup.bbmodel');
						await new Promise(r => setTimeout(r, 40));
					} catch(err) {
						console.error(err);
					}
				}
				resolve();
			}
			request.onerror = function(e) {
				console.error(e);
				reject(e);
			}
		})
	},
	async removeBackup(uuid: string) {
		let transaction = AutoBackup.db.transaction('projects', 'readwrite');
		let store = transaction.objectStore('projects');
		let request = store.delete(uuid);
		
		return await new Promise((resolve, reject) => {
			request.onsuccess = resolve;
			request.onerror = function(e) {
				reject();
			}
		});
	},
	async removeAllBackups() {
		let transaction = AutoBackup.db.transaction('projects', 'readwrite');
		let store = transaction.objectStore('projects');
		let request = store.clear();
		
		return await new Promise((resolve, reject) => {
			request.onsuccess = resolve;
			request.onerror = function(e) {
				console.error(e);
				reject();
			}
		});
	},
	loop_timeout: null,
	backupProjectLoop(run_save: boolean = true) {
		if (run_save && Project && (Outliner.root.length || Project.textures.length)) {
			try {
				AutoBackup.backupOpenProject();
			} catch (err) {
				console.error('Unable to create backup. ', err)
			}
		}
		let interval = settings.recovery_save_interval.value as number;
		if (interval != 0) {
			interval = Math.max(interval, 5);
			AutoBackup.loop_timeout = setTimeout(() => AutoBackup.backupProjectLoop(true), interval * 1000);
		}
	}
}
const global = {
	AutoBackup
};
declare global {
	const AutoBackup: typeof global.AutoBackup
}
Object.assign(window, global);
