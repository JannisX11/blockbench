const electron = require('@electron/remote');
const {clipboard, shell, nativeImage, ipcRenderer, dialog, webUtils} = require('electron');
const app = electron.app;
const fs = require('fs');
const NodeBuffer = require('buffer');
const zlib = require('zlib');
const exec = require('child_process').exec;
const originalFs = require('original-fs');
const https = require('https');
const PathModule = require('path');

const currentwindow = electron.getCurrentWindow();
var dialog_win	 = null,
	latest_version = false;
const recent_projects = (function() {
	let array = [];
	var raw = localStorage.getItem('recent_projects')
	if (raw) {
		try {
			array = JSON.parse(raw).slice().reverse()
		} catch (err) {}
		array = array.filter(project => {
			return fs.existsSync(project.path);
		})
	}
	return array
})();


app.setAppUserModelId('blockbench')


function initializeDesktopApp() {

	//Setup
	$(document.body).on('click auxclick', 'a[href]', (event) => {
		event.preventDefault();
		shell.openExternal(event.currentTarget.href);
		return true;
	});

	if (Blockbench.startup_count <= 1 && electron.nativeTheme.inForcedColorsMode) {
		let theme = CustomTheme.themes.find(t => t.id == 'contrast');
		CustomTheme.loadTheme(theme);
	}

	function makeUtilFolder(name) {
		let path = PathModule.join(app.getPath('userData'), name)
		if (!fs.existsSync(path)) fs.mkdirSync(path)
	}
	['backups', 'thumbnails'].forEach(makeUtilFolder)

	createBackup(true)

	$('.web_only').remove()
	if (__dirname.includes('C:\\xampp\\htdocs\\blockbench')) {
		Blockbench.addFlag('dev')
	}

	settings.interface_scale.onChange();

	if (Blockbench.platform == 'darwin') {
		//Placeholder
		$('#mac_window_menu').show()
		currentwindow.on('enter-full-screen', () => {
			$('#mac_window_menu').hide()
		})
		currentwindow.on('leave-full-screen', () => {
			$('#mac_window_menu').show()
		})
	} else {
		$('#windows_window_menu').show()
	}
	if (Blockbench.platform == 'linux') {
		// Clear GPU cache: https://github.com/JannisX11/blockbench/issues/1964
		let gpu_cache_path = PathModule.join(app.getPath('userData'), 'GPUCache');
		try {
			let cache_files = fs.readdirSync(gpu_cache_path);
			for (let file_name of cache_files) {
				fs.unlinkSync(PathModule.join(gpu_cache_path, file_name));
			}
			console.log(`Cleared ${cache_files.length} GPU-cache files`);
		} catch (err) {
			console.error('Attempted and failed to clear GPU cache', err);
		}
	}
}
//Load Model
function loadOpenWithBlockbenchFile() {
	function load(path) {
		var extension = pathToExtension(path);
		if (extension == 'png') {
			Blockbench.read([path], {readtype: 'image'}, (files) => {
				loadImages(files);
			})
		} else if (Codec.getAllExtensions().includes(extension)) {
			Blockbench.read([path], {}, (files) => {
				loadModelFile(files[0])
			})
		}
	}
	ipcRenderer.on('open-model', (event, path) => {
		load(path);
	})
	ipcRenderer.on('load-tab', (event, model) => {
		let fake_file = {
			path: model.editor_state?.save_path || ''
		};
		Codecs.project.load(model, fake_file);
		if (model.detached_uuid) {
			ipcRenderer.send('close-detached-project', model.detached_window_id, model.detached_uuid);
		}
	})
	ipcRenderer.on('accept-detached-tab', (event, value) => {
		Interface.page_wrapper.classList.toggle('accept_detached_tab', value);
	})
	ipcRenderer.on('close-detached-project', (event, uuid) => {
		let tab = ModelProject.all.find(project => project.uuid == uuid && project.detached);
		if (tab) tab.close(true);
	})
	if (electron.process.argv.length >= 2) {
		let path = electron.process.argv.last();
		load(path);
	}
}
(function() {
	console.log('Electron '+process.versions.electron+', Node '+process.versions.node)
})()

window.confirm = function(message, title) {
	let index = electron.dialog.showMessageBoxSync(currentwindow, {
		title: title || electron.app.name,
		detail: message,
		type: 'none',
		noLink: true,
		buttons: [tl('dialog.ok'), tl('dialog.cancel')]
	});
	return index == 0;
}
window.alert = function(message, title) {
	electron.dialog.showMessageBoxSync(electron.getCurrentWindow(), {
		title: title || electron.app.name,
		detail: message
	});
}

//Recent Projects
function updateRecentProjects() {
	recent_projects.splice(Math.clamp(settings.recent_projects.value, 0, 512));
	let fav_count = 0;
	recent_projects.forEach((project, i) => {
		if (project.favorite) {
			recent_projects.splice(i, 1);
			recent_projects.splice(fav_count, 0, project);
			fav_count++;
		}
	})
	//Set Local Storage
	localStorage.setItem('recent_projects', JSON.stringify(recent_projects.slice().reverse()));
}
function addRecentProject(data) {
	var i = recent_projects.length-1;
	let former_entry;
	while (i >= 0) {
		var p = recent_projects[i]
		if (p.path === data.path) {
			recent_projects.splice(i, 1);
			former_entry = p;
		}
		i--;
	}
	if (data.name.length > 48) data.name = data.name.substr(0, 20) + '...' + data.name.substr(-20);
	let project = {
		name: data.name,
		path: data.path,
		icon: data.icon,
		favorite: former_entry ? former_entry.favorite : false,
		day: new Date().dayOfYear(),
	}
	recent_projects.splice(0, 0, project)
	ipcRenderer.send('add-recent-project', data.path);
	StartScreen.vue.updateThumbnails([data.path]);
	Settings.updateSettingsInProfiles();
	updateRecentProjects()
}
function updateRecentProjectData() {
	let project = Project.getProjectMemory();
	if (!project) return;
	
	if (project.name.length > 48) project.name = project.name.substr(0, 20) + '...' + project.name.substr(-20);

	project.textures = Texture.all.filter(t => t.path).map(t => t.path);

	if (Format.animation_files) {
		project.animation_files = [];
		Animation.all.forEach(anim => {
			if (anim.path) project.animation_files.safePush(anim.path);
		})
	}

	Blockbench.dispatchEvent('update_recent_project_data', {data: project});
	updateRecentProjects()
}
async function updateRecentProjectThumbnail() {
	let project = Project && Project.getProjectMemory();
	if (!project) return;

	let thumbnail;
	const resolution = [270, 150];

	if (Format.image_editor && Texture.all.length) {		
		await new Promise((resolve, reject) => {
			let tex = Texture.getDefault();
			let frame = new CanvasFrame(resolution[0], resolution[1]);
			frame.ctx.imageSmoothingEnabled = false;

			let {width, height} = tex;
			if (width > resolution[0])   {height /= width / resolution[0];  width = resolution[0];}
			if (height > resolution[1]) {width /= height / resolution[1]; height = resolution[1];}
			if (width < resolution[0] && height < resolution[1]) {
				let factor = Math.min(resolution[0] / width, resolution[1] / height);
				factor *= 0.92;
				height *= factor; width *= factor;
			}
			frame.ctx.drawImage(tex.img, (resolution[0] - width)/2, (resolution[1] - height)/2, width, height)

			let url = frame.canvas.toDataURL();

			let hash = project.path.hashCode().toString().replace(/^-/, '0');
			let path = PathModule.join(app.getPath('userData'), 'thumbnails', `${hash}.png`)
			thumbnail = url;
			Blockbench.writeFile(path, {
				savetype: 'image',
				content: url
			}, resolve)
		})
	} else {
		if (Outliner.elements.length == 0) return;

		MediaPreview.resize(resolution[0], resolution[1])
		MediaPreview.loadAnglePreset(DefaultCameraPresets[0])
		MediaPreview.setFOV(30);
		let center = getSelectionCenter(true);
		MediaPreview.controls.target.fromArray(center);
		MediaPreview.controls.target.add(scene.position);

		let box = Canvas.getModelSize();
		let size = Math.max(box[0], box[1]*2)
		MediaPreview.camera.position.multiplyScalar(size/50)
		
		await new Promise((resolve, reject) => {
			MediaPreview.screenshot({crop: false}, url => {
				let hash = project.path.hashCode().toString().replace(/^-/, '0');
				let path = PathModule.join(app.getPath('userData'), 'thumbnails', `${hash}.png`)
				thumbnail = url;
				Blockbench.writeFile(path, {
					savetype: 'image',
					content: url
				}, resolve)
				let store_path = project.path;
				project.path = '';
				project.path = store_path;
			})
		})
	}
	Blockbench.dispatchEvent('update_recent_project_thumbnail', {data: project, thumbnail});
	StartScreen.vue.updateThumbnails([project.path]);

	// Clean old files
	if (Math.random() < 0.2) {
		let folder_path = PathModule.join(app.getPath('userData'), 'thumbnails')
		let existing_names = [];
		recent_projects.forEach(project => {
			let hash = project.path.hashCode().toString().replace(/^-/, '0');
			existing_names.safePush(hash)
		})
		fs.readdir(folder_path, (err, files) => {
			if (!err) {
				files.forEach((name, i) => {
					if (existing_names.includes(name.replace(/\..+$/, '')) == false) {
						try {
							fs.unlinkSync(folder_path +osfs+ name)
						} catch (err) {}
					}
				})
			}
		})
	}
}
function loadDataFromModelMemory() {
	let project = Project && Project.getProjectMemory();
	if (!project) return;

	if (project.textures) {
		Blockbench.read(project.textures, {}, files => {
			files.forEach(f => {
				if (!Texture.all.find(t => t.path == f.path)) {
					new Texture({name: f.name}).fromFile(f).add(false).fillParticle();
				}
			})
		})
	}
	if (project.animation_files && Format.animation_files) {
		Project.memory_animation_files_to_load = project.animation_files;
	}
	Blockbench.dispatchEvent('load_from_recent_project_data', {data: project});
}

function showItemInFolder(path) {
	ipcRenderer.send('show-item-in-folder', path);
}

//Window Controls
function updateWindowState(e, type) {
	let maximized = currentwindow.isMaximized();
	$('#header_free_bar').toggleClass('resize_space', !maximized);
	document.body.classList.toggle('maximized', maximized);
}
currentwindow.on('maximize', e => updateWindowState(e, 'maximize'));
currentwindow.on('unmaximize', e => updateWindowState(e, 'unmaximize'));
currentwindow.on('enter-full-screen', e => updateWindowState(e, 'screen'));
currentwindow.on('leave-full-screen', e => updateWindowState(e, 'screen'));
currentwindow.on('ready-to-show', e => updateWindowState(e, 'load'));

//Image Editor
function changeImageEditor(texture, not_found) {
	let app_file_extension = {
		'win32': ['exe'],
		'linux': [],
		'darwin': ['app'],
	};
	new Dialog({
		title: tl('message.image_editor.title'),
		id: 'image_editor',
		form: {
			not_found_text: {type: 'info', text: 'message.image_editor.not_found', condition: not_found == true},
			editor: {type: 'select', full_width: true, options: {
				ps: Blockbench.platform == 'win32' ? 'Photoshop' : undefined,
				gimp: 'GIMP',
				pdn: Blockbench.platform == 'win32' ? 'Paint.NET' : undefined,
				other: 'message.image_editor.file'
			}},
			file: {
				label: 'message.image_editor.file',
				nocolon: true,
				type: 'file',
				file_type: 'Program',
				extensions: app_file_extension[Blockbench.platform],
				readtype: 'none',
				description: 'message.image_editor.exe',
				condition: result => result.editor == 'other'
			}
		},
		onConfirm(result) {
			let id = result.editor;
			let path;
			if (id == 'other') {
				path = result.file;

			} else if (Blockbench.platform == 'darwin') {
				switch (id) {
					case 'ps':  path = '/Applications/Adobe Photoshop 2024/Adobe Photoshop 2024.app'; break;
					case 'gimp':path = '/Applications/Gimp-2.10.app'; break;
				}
			} else if (Blockbench.platform == 'linux') {
				switch (id) {
					case 'ps':  path = '/usr/share/applications//photoshop.desktop'; break;
					case 'gimp':path = '/usr/share/applications//gimp.desktop'; break;
				}
			} else {
				switch (id) {
					case 'ps':  path = 'C:\\Program Files\\Adobe\\Adobe Photoshop 2024\\Photoshop.exe'; break;
					case 'gimp':path = 'C:\\Program Files\\GIMP 2\\bin\\gimp-2.10.exe'; break;
					case 'pdn': path = 'C:\\Program Files\\paint.net\\PaintDotNet.exe'; break;
				}
			}
			if (path && fs.existsSync(path)) {
				settings.image_editor.value = path
				if (texture) {
					texture.openEditor()
				}
			} else {
				changeImageEditor(texture, true);
			}
		},
	}).show()
}
//Default Pack
function openDefaultTexturePath() {
	let detail = tl('message.default_textures.detail');
	if (settings.default_path.value) {
		detail += '\n\n' + tl('message.default_textures.current') + ': ' + settings.default_path.value;
	}
	let buttons = (
		settings.default_path.value ? 	[tl('dialog.continue'), tl('generic.remove'), tl('dialog.cancel')]
									:	[tl('dialog.continue'), tl('dialog.cancel')]
	)
	var answer = electron.dialog.showMessageBoxSync(currentwindow, {
		type: 'info',
		buttons,
		noLink: true,
		title: tl('message.default_textures.title'),
		message: tl('message.default_textures.message'),
		detail
	})
	if (answer === buttons.length-1) {
		return;
	} else if (answer === 0) {

		let path = Blockbench.pickDirectory({
			title: tl('message.default_textures.select'),
			resource_id: 'texture',
		});
		if (path) {
			settings.default_path.value = path;
			Settings.saveLocalStorages();
		}
	} else {
		settings.default_path.value = false;
		Settings.saveLocalStorages();
	}
}
function findExistingFile(paths) {
	for (var path of paths) {
		if (fs.existsSync(path)) {
			return path;
		}
	}
}
//Backup
function createBackup(init) {
	setTimeout(createBackup, limitNumber(parseFloat(settings.backup_interval.value), 1, 10e8)*60000)

	let duration = parseInt(settings.backup_retain.value)+1
	let folder_path = app.getPath('userData')+osfs+'backups'
	let d = new Date()
	let days = d.getDate() + (d.getMonth()+1)*30.44 + (d.getYear()-100)*365.25

	if (init) {
		//Clear old backups
		fs.readdir(folder_path, (err, files) => {
			if (!err) {
				files.forEach((name, i) => {
					let date = name.split('_')[1]
					if (date) {
						let nums = date.split('.')
						nums.forEach((n, ni) => {
							nums[ni] = parseInt(n)
						})
						let b_days = nums[0] + nums[1]*30.44 + nums[2]*365.25
						if (!isNaN(b_days) && days - b_days > duration) {
							try {
								fs.unlinkSync(folder_path +osfs+ name)
							} catch (err) {console.log(err)}
						}
					}
				})
			}
		})
	}
	if (init || !Project || (elements.length === 0 && Texture.all.length === 0)) return;

	let model = Codecs.project.compile({compressed: true, backup: true});
	let short_name = Project.name.replace(/[.]/g, '_').replace(/[^a-zA-Z0-9._-]/g, '').substring(0, 16);
	if (short_name) short_name = '_' + short_name;
	let file_name = 'backup_'+d.getDate()+'.'+(d.getMonth()+1)+'.'+(d.getYear()-100)+'_'+d.getHours()+'.'+d.getMinutes() + short_name;
	let file_path = folder_path+osfs+file_name+'.bbmodel';

	fs.writeFile(file_path, model, function (err) {
		if (err) {
			console.log('Error creating backup: '+err)
		}
	})
}

BARS.defineActions(() => {

	let selected_id; // Remember selected one after re-opening
	new Action('view_backups', {
		icon: 'fa-archive',
		category: 'file',
		condition: () => isApp,
		click(e) {

			let backup_directory = app.getPath('userData')+osfs+'backups';
			let files = fs.readdirSync(backup_directory);

			let entries = files.map((file, i) => {
				let path = PathModule.join(backup_directory, file);
				let stats = fs.statSync(path);
				
				let size = `${separateThousands(Math.round(stats.size / 1024))} KB`;
				let entry = {
					id: file,
					path,
					name: file.replace(/backup_\d+\.\d+\.\d+_\d+\.\d+_?/, '').replace(/\.bbmodel$/, '').replace(/_/g, ' ') || 'no name',
					date: stats.mtime.toLocaleDateString(),
					time: stats.mtime.toLocaleTimeString().replace(/:\d+ /, ' '),
					date_long: stats.mtime.toString(),
					timestamp: stats.mtime.getTime(),
					size,
				}
				return entry;
			})
			entries.sort((a, b) => b.timestamp - a.timestamp);

			let selected;
			const dialog = new Dialog({
				id: 'view_backups',
				title: 'action.view_backups',
				width: 720,
				buttons: ['dialog.confirm', 'dialog.view_backups.open_folder', 'dialog.cancel'],
				component: {
					data() {return {
						backups: entries,
						page: 0,
						per_page: 80,
						search_term: '',
						selected: (selected_id ? entries.find(e => e.id == selected_id) : null)
					}},
					methods: {
						select(backup) {
							selected = this.selected = backup;
							selected_id = backup.id;
						},
						open() {
							dialog.confirm();
						},
						setPage(number) {
							this.page = number;
							this.$refs.backups_list.scrollTop = 0;
						}
					},
					computed: {
						filtered_backups() {
							let term = this.search_term.toLowerCase();
							return this.backups.filter(backup => {
								return backup.name.includes(term);
							})
						},
						viewed_backups() {
							return this.filtered_backups.slice(this.page * this.per_page, (this.page+1) * this.per_page);
						},
						pages() {
							let pages = [];
							let length = this.filtered_backups.length;
							for (let i = 0; i * this.per_page < length; i++) {
								pages.push(i);
							}
							return pages;
						}
					},
					template: `
						<div>
							<div class="bar">
								<search-bar v-model="search_term" @input="setPage(0)"></search-bar>
							</div>
							<ul id="view_backups_list" class="list" ref="backups_list">
								<li v-for="backup in viewed_backups" :key="backup.id" :class="{selected: selected == backup}" @dblclick="open(backup)" @click="select(backup);">
									<span :title="backup.id">{{ backup.name }}</span>
									<div class="view_backups_info_field" :title="backup.date_long">{{ backup.date }}</div>
									<div class="view_backups_info_field" :title="backup.date_long">{{ backup.time }}</div>
									<div class="view_backups_info_field">{{ backup.size }}</div>
								</li>
							</ul>
							<ol class="pagination_numbers" v-if="pages.length > 1">
								<li v-for="number in pages" :class="{selected: page == number}" @click="setPage(number)">{{ number+1 }}</li>
							</ol>
						</div>
					`
				},
				onButton(button) {
					if (button == 1) {
						shell.openPath(backup_directory);
					}
				},
				onConfirm() {
					Blockbench.read([selected.path], {}, (files) => {
						loadModelFile(files[0]);
					})
					dialog.close();
				}
			}).show();
		}
	})
})

//Close
window.onbeforeunload = function (event) {
	try {
		updateRecentProjectData()
	} catch(err) {}


	if (Blockbench.hasFlag('allow_closing')) {
		try {
			if (!Blockbench.hasFlag('allow_reload')) {
				currentwindow.webContents.closeDevTools()
			}
		} catch (err) {}

	} else if (ModelProject.all.find(project => !project.saved)) {
		let ul = Interface.createElement('ul', {class: 'list unsaved_models_list'});
		let dialog;

		async function saveProject(project) {
			project.select();
			if (Project.save_path) {
				BarItems.save_project.trigger();
			} else if (Project.export_path)  {
				await BarItems.export_over.click();
			} else {
				await BarItems.export_over.click();
			}
		}

		ModelProject.all.forEach(project => {
			if (project.saved) return;
			let li = Interface.createElement('li', {class: 'unsaved_model'}, [
				Blockbench.getIconNode(project.format?.icon),
				Interface.createElement('span', {}, project.getDisplayName()),
				Interface.createElement('div', {class: 'tool'}, Blockbench.getIconNode('save')),
			]);
			li.addEventListener('click', event => {
				project.select();
			})
			li.lastChild.addEventListener('click', async (event) => {
				await saveProject(project);
				if (Project.saved) {
					li.remove();
					if (ul.childElementCount == 0) {
						wait(200);
						closeBlockbenchWindow();
					}
				}
			})
			ul.append(li);
		})

		dialog = new Dialog('close', {
			title: 'dialog.unsaved_work.title',
			lines: [
				Interface.createElement('p', {}, tl('dialog.unsaved_work.text')),
				ul
			],
			buttons: [tl('dialog.unsaved_work.save_all'), tl('dialog.unsaved_work.discard_all'), tl('dialog.cancel')],
			cancel_on_click_outside: false,
			onButton: async (button) => {
				if (button == 0) {
					for (let project of ModelProject.all.slice()) {
						await saveProject(project);
						if (!project.saved) return;
					}
					wait(200);
					closeBlockbenchWindow();

				} else if (button == 1) {
					closeBlockbenchWindow();
				}
			}
		})
		dialog.show();
		shell.beep();

		event.returnValue = true;
		return true;
	} else {
		closeBlockbenchWindow();
		return false;
	}
}

async function closeBlockbenchWindow() {
	for (let project of ModelProject.all.slice()) {
		project.closeOnQuit();
	}
	AutoBackup.removeAllBackups();
	if (Blockbench.hasFlag('update_downloaded')) {
		await new Promise(resolve => {
			Blockbench.showMessageBox({
				title: 'message.installing_update.title',
				message: tl('message.installing_update.message', '60'),
				icon: 'update',
				width: 534
			}, resolve);
		})
	}
	window.onbeforeunload = null;
	Blockbench.addFlag('allow_closing');
	Blockbench.dispatchEvent('before_closing')
	if (Project.EditSession) Project.EditSession.quit()
	return currentwindow.close();
};


ipcRenderer.on('update-available', (event, arg) => {
	console.log('Found new update:', arg.version)
	if (settings.automatic_updates.value) {
		ipcRenderer.send('allow-auto-update');


		let icon_node = Blockbench.getIconNode('donut_large');
		icon_node.classList.add('spinning');
		let click_action;

		let action = new Action('update_status', {
			name: tl('menu.help.updating', [0]),
			icon: icon_node,
			click() {
				if (click_action) click_action()
			}
		})
		action.toElement('#update_menu');
		MenuBar.menus.help.addAction('_');
		MenuBar.menus.help.addAction(action);

		ipcRenderer.on('update-progress', (event, status) => {
			action.setName(tl('menu.help.updating', [Math.round(status.percent)]));
		})
		ipcRenderer.on('update-error', (event, err) => {
			action.setName(tl('menu.help.update_failed'));
			icon_node.textContent = 'warning';
			icon_node.classList.remove('spinning')
			click_action = function() {
				currentwindow.openDevTools()
			}
			console.error(err);
		})
		ipcRenderer.on('update-downloaded', (event) => {
			Blockbench.addFlag('update_downloaded');
			action.setName(tl('message.update_after_restart'));
			MenuBar.menus.help.removeAction(action);
			icon_node.textContent = 'browser_updated';
			icon_node.classList.remove('spinning');
			icon_node.style.color = 'var(--color-confirm)';
			click_action = function() {
				Blockbench.showQuickMessage('message.update_after_restart')
			}
		})

	} else {
		addStartScreenSection('update_notification', {
			color: 'var(--color-back)',
			graphic: {type: 'icon', icon: 'update'},
			text: [
				{type: 'h3', text: tl('message.update_notification.title')},
				{text: tl('message.update_notification.message')},
				{type: 'button', text: tl('generic.enable'), click: (e) => {
					settings.automatic_updates.set(true);
				}}
			]
		})
	}
})

