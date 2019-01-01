var app = require('electron').remote,
	fs = require('fs'),
	nativeImage = require('electron').nativeImage,
	exec = require('child_process').exec,
	originalFs = require('original-fs'),
	https = require('https'),
	currentwindow = app.getCurrentWindow(),
	dialog_win = null,
	latest_version = false,
	preventClosing = true;
recent_projects = undefined

const shell = require('electron').shell;
const { clipboard } = require('electron')

$(document).ready(function () {
	if (app.process.argv.length >= 2) {
		if (app.process.argv[1].substr(-5) == '.json') {
			readFile(app.process.argv[1], true)
		}
	}
	$('.open-in-browser').click((event) => {
		event.preventDefault();
		shell.openExternal(event.target.href);
		return true;
	});
	if (fs.existsSync(app.app.getPath('userData') + osfs + 'backups') === false) {
		fs.mkdirSync(app.app.getPath('userData') + osfs + 'backups')
	}
	createBackup(true)
	$('.web_only').remove()
	if (__dirname.includes('C:\\xampp\\htdocs\\blockbench\\web')) {
		Blockbench.addFlag('dev')
	}

	// window controls
	let css = '';
	if (process.platform === "darwin") {
		css = '.not-mac { display: none !important; } header div#title { margin-left: 67px; }';
	} else {
		css = 'header div#title { margin-left: 0px; }'
	}
	$('<style>' + css + '</style>').appendTo(document.head);
})

getLatestVersion(true)
//Called on start to show message
function getLatestVersion(init) {
	if (process.platform == 'linux') return;
	$.getJSON('https://blockbench.net/api/index.json', (data) => {
		if (data.version) {
			latest_version = data.version
			if (compareVersions(latest_version, appVersion) && init === true) {

				Blockbench.showMessageBox({
					translateKey: 'update_notification',
					message: tl('message.update_notification.message', [latest_version]),
					icon: 'update',
					buttons: [tl('message.update_notification.install'), tl('message.update_notification.later')],
					confirm: 0, cancel: 1
				}, (result) => {
					if (result === 0) {
						checkForUpdates(true)
					}
				})

			} else if (init === false) {
				checkForUpdates()
			}
		}
	}).fail(function () {
		latest_version = false
	})
}
//Recent Projects
function updateRecentProjects() {
	if (recent_projects === undefined) {
		//Setup
		recent_projects = []
		var raw = localStorage.getItem('recent_projects')
		if (raw) {
			recent_projects = JSON.parse(raw)
		}
	}
	//Set Local Storage
	localStorage.setItem('recent_projects', JSON.stringify(recent_projects))
}
function addRecentProject(data) {
	var i = recent_projects.length - 1
	while (i >= 0) {
		var p = recent_projects[i]
		if (p.path === data.path) {
			recent_projects.splice(i, 1)
		}
		i--;
	}
	recent_projects.push({ name: data.name, path: data.path })
	if (recent_projects.length > 8) {
		recent_projects.shift()
	}
	updateRecentProjects()
}
//Updates
function checkForUpdates(instant) {
	showDialog('updater')
	setProgressBar('update_bar', 0, 1)
	var data;
	if (latest_version === false) {

		data = `<div class="tool" onclick="refreshUpdateDialog()">
				<i class="material-icons">refresh</i>
				<div class="tooltip">${tl('dialog.update.refresh')}</div>
				</div>
				<div class="dialog_bar narrow">
				<i class="material-icons blue_icon">cloud_off</i>${tl('dialog.update.no_connection')}
				</div>`;

	} else if (latest_version !== appVersion) {
		data =
			`<div class="dialog_bar narrow">${tl('dialog.update.latest')}: ${latest_version}</div>
			<div class="dialog_bar narrow">${tl('dialog.update.installed')}: ${appVersion}</div>
			<div class=""><button type="button" class="large uc_btn" id="update_button" onclick="installUpdate()">${tl('dialog.update.update')}</button></div>`;

		if (instant) {
			setTimeout(function () {
				installUpdate()
			}, 60)
		}
	} else {
		data =
			`<div class="tool" onclick="refreshUpdateDialog()">
				<i class="material-icons">refresh</i>
				<div class="tooltip">${tl('dialog.update.refresh')}</div>
			</div>
			<div class="dialog_bar narrow">
			<i class="material-icons blue_icon">check</i>
			${tl('dialog.update.up_to_date')}
			</div>`;
	}
	$('#updater_content').html(data)
}
function refreshUpdateDialog() {
	currentwindow.webContents.session.clearCache(function () {
		data = '<div class="dialog_bar narrow"><i class="material-icons blue_icon spinning">refresh</i>' + tl('dialog.update.connecting') + '</div>'
		$('#updater_content').html(data)
		getLatestVersion(false)
	})
}
function installUpdate() {
	console.log('Starting Update')
	var received_bytes = 0;
	var total_bytes = 0;

	$('.uc_btn').css('visibility', 'hidden')

	var asar_path = __dirname;
	if (asar_path.includes('.asar') === false) {
		asar_path = asar_path + osfs + 'resources' + osfs + 'app.asar';
	}

	var file = originalFs.createWriteStream(asar_path);

	var request = https.get("https://blockbench.net/api/app.asar", function (response) {
		response.pipe(file);

		total_bytes = parseInt(response.headers['content-length']);

		response.on('end', updateInstallationEnd)
		response.on('data', function (chunk) {
			received_bytes += chunk.length;
			setProgressBar('update_bar', received_bytes / total_bytes, 1);
		})
	});
}
function updateInstallationEnd() {
	hideDialog();
	Blockbench.addFlag('update_restart');
	var exe_path = __dirname.split(osfs);
	exe_path.splice(-2);
	exe_path = exe_path.join(osfs) + osfs + 'blockbench.exe';
	if (showSaveDialog(true)) {
		exec(exe_path);
	} else {
		Blockbench.showQuickMessage('message.restart_to_update');
	}
}
//Image Editor
function changeImageEditor(texture) {
	var dialog = new Dialog({
		title: tl('message.image_editor.title'),
		id: 'image_editor',
		lines: ['<div class="dialog_bar"><select class="dark_bordered input_wide">' +
			'<option id="ps">Photoshop</option>' +
			'<option id="gimp">Gimp</option>' +
			'<option id="pdn">Paint.NET</option>' +
			'<option id="other">' + tl('message.image_editor.file') + '</option>' +
			'</select></div>'],
		draggable: true,
		onConfirm: function () {
			var id = $('.dialog#image_editor option:selected').attr('id')
			var path;
			switch (id) {
				case 'ps': path = 'C:\\Program Files\\Adobe\\Adobe Photoshop CC 2018\\Photoshop.exe'; break;
				case 'gimp': path = 'C:\\Program Files\\GIMP 2\\bin\\gimp-2.10.exe'; break;
				case 'pdn': path = 'C:\\Program Files\\paint.net\\PaintDotNet.exe'; break;
			}
			if (id === 'other') {
				selectImageEditorFile(texture)

			} else if (path) {
				settings.image_editor.value = path
				if (texture) {
					texture.openEditor()
				}
			}
			dialog.hide()
		}
	}).show()
}
function selectImageEditorFile(texture) {
	app.dialog.showOpenDialog(currentwindow, {
		title: tl('message.image_editor.exe'),
		filters: [{ name: 'Executable Program', extensions: ['exe'] }]
	}, function (filePaths) {
		if (filePaths) {
			settings.image_editor.value = filePaths[0]
			if (texture) {
				texture.openEditor()
			}
		}
	})
}
//Default Pack
function openDefaultTexturePath() {
	var answer = app.dialog.showMessageBox(currentwindow, {
		type: 'info',
		buttons: (
			settings.default_path.value ? [tl('dialog.cancel'), tl('message.default_textures.continue'), tl('message.default_textures.remove')]
				: [tl('dialog.cancel'), tl('message.default_textures.continue')]
		),
		noLink: true,
		title: tl('message.default_textures.title'),
		message: tl('message.default_textures.message'),
		detail: tl('message.default_textures.detail'),
	})
	if (answer === 0) {
		return;
	} else if (answer === 1) {
		app.dialog.showOpenDialog(currentwindow, {
			title: tl('message.default_textures.select'),
			properties: ['openDirectory'],
		}, function (filePaths) {
			if (filePaths) {
				settings.default_path.value = filePaths[0]
			}
		})
	} else {
		settings.default_path.value = false
	}
}
function findEntityTexture(mob, return_path) {
	var textures = {
		'chicken': 'chicken',
		'blaze': 'blaze',
		'llamaspit': 'llama/spit',
		'llama': 'llama/llama_creamy',
		'dragon': 'dragon/dragon',
		'ghast': 'ghast/ghast',
		'slime': 'slime/slime',
		'slime.armor': 'slime/slime',
		'lavaslime': 'slime/magmacube',
		'silverfish': 'silverfish',
		'shulker': 'shulker/shulker_undyed',
		'rabbit': 'rabbit/brown',
		'horse': 'horse/horse_brown',
		'horse.v2': 'horse2/horse_brown',
		'humanoid': 'steve',
		'creeper': 'creeper/creeper',
		'enderman': 'enderman/enderman',
		'zombie': 'zombie/zombie',
		'zombie.husk': 'zombie/husk',
		'zombie.drowned': 'zombie/drowned',
		'pigzombie': 'pig/pigzombie',
		'pigzombie.baby': 'pig/pigzombie',
		'skeleton': 'skeleton/skeleton',
		'skeleton.wither': 'skeleton/wither_skeleton',
		'skeleton.stray': 'skeleton/stray',
		'squid': 'squid',
		'spider': 'spider/spider',
		'cow': 'cow/cow',
		'mooshroom': 'cow/mooshroom',
		'sheep.sheared': 'sheep/sheep',
		'sheep': 'sheep/sheep',
		'phantom': 'phantom',
		'pig': 'pig/pig',
		'bat': 'bat',
		'dolphin': 'dolphin',
		'irongolem': 'iron_golem',
		'snowgolem': 'snow_golem',
		'zombie.villager': 'zombie_villager/zombie_farmer',
		'evoker': 'illager/evoker',
		'vex': 'vex/vex',
		'vindicator': 'vindicator',
		'wolf': 'wolf/wolf',
		'ocelot': 'cat/ocelot',
		'cat': 'cat/siamese',
		'trident': 'trident',
		'guardian': 'guardian',
		'polarbear': 'polarbear',
		'turtle': 'sea_turtle',
		'villager': 'villager/farmer',
		'villager.witch': 'witch',
		'witherBoss': 'wither_boss/wither',
		'agent': 'agent',
		'armor_stand': 'armor_stand',
		'parrot': 'parrot/parrot_red_blue',
		'bed': 'bed/white',
		'player_head': 'steve',
		'mob_head': 'skeleton/skeleton',
		'dragon_head': 'dragon/dragon',
		'boat': 'boat/boat_oak',
		'minecart': 'minecart',
		'cod': 'fish/fish',
		'pufferfish.small': 'fish/pufferfish',
		'pufferfish.mid': 'fish/pufferfish',
		'pufferfish.large': 'fish/pufferfish',
		'salmon': 'fish/salmon',
		'tropicalfish_a': 'fish/tropical_a',
		'tropicalfish_b': 'fish/tropical_b',
		'endermite': 'endermite',
		'panda': 'panda/panda',
	}
	mob = mob.split(':')[0].replace(/^geometry\./, '')
	var path = textures[mob]
	if (!path) {
		path = mob
	}
	if (path) {
		var texture_path = Prop.file_path.split(osfs)
		var index = texture_path.lastIndexOf('models') - texture_path.length
		texture_path.splice(index)
		texture_path = [...texture_path, 'textures', 'entity', ...path.split('/')].join(osfs)

		if (return_path === true) {
			return texture_path + '.png';
		} else if (return_path === 'raw') {
			return ['entity', ...path.split('/')].join(osfs)
		} else {
			if (fs.existsSync(texture_path + '.png')) {
				var texture = new Texture({ keep_size: true }).fromPath(texture_path + '.png').add()
			} else if (fs.existsSync(texture_path + '.tga')) {
				var texture = new Texture({ keep_size: true }).fromPath(texture_path + '.tga').add()

			} else if (settings.default_path && settings.default_path.value) {

				texture_path = settings.default_path.value + osfs + 'entity' + osfs + path.split('/').join(osfs)
				if (fs.existsSync(texture_path + '.png')) {
					var texture = new Texture({ keep_size: true }).fromPath(texture_path + '.png').add()
				} else if (fs.existsSync(texture_path + '.tga')) {
					var texture = new Texture({ keep_size: true }).fromPath(texture_path + '.tga').add()
				}
			}
		}
	}
}
function findBedrockAnimation() {

	var animation_path = Prop.file_path.split(osfs)
	var index = animation_path.lastIndexOf('models')
	animation_path.splice(index)
	animation_path = [...animation_path, 'animations', pathToName(Prop.file_path) + '.json'].join(osfs)
	if (fs.existsSync(animation_path)) {
		Blockbench.read([animation_path], {}, (files) => {
			Animator.loadFile(files[0])
		})
	}
}

//Writers
function saveFile(props) {
	if (Prop.file_path) {
		var extension = pathToExtension(Prop.file_path)
		if (Blockbench.entity_mode === false) {
			Blockbench.writeFile(Prop.file_path, {
				project_file: true,
				content: buildBlockModel()
			})
		} else {
			writeFileEntity(buildEntityModel({ raw: true }), Prop.file_path)
		}
	} else {
		if (Blockbench.entity_mode === false) {
			BarItems.export_blockmodel.trigger()
		} else {
			BarItems.export_entity.trigger()
		}
	}
}
function writeFileEntity(content, filepath) {
	Prop.file_path = filepath
	var model_name = 'geometry.' + (Project.parent.replace(/^geometry\./, '') || 'unknown')
	fs.readFile(filepath, 'utf-8', function (errx, data) {
		var obj = {}
		if (content.bones && content.bones.length) {
			var has_parents = false;
			for (var i = 0; i < content.bones.length && !has_parents; i++) {
				if (content.bones[i].parent) has_parents = true;
			}
			if (has_parents) {
				obj.format_version = '1.8.0'
			}
		}
		if (!errx) {
			try {
				obj = JSON.parse(data.replace(/\/\*[^(\*\/)]*\*\/|\/\/.*/g, ''))
			} catch (err) {
				err = err + ''
				var answer = app.dialog.showMessageBox(currentwindow, {
					type: 'warning',
					buttons: [
						tl('message.bedrock_overwrite_error.backup_overwrite'),
						tl('message.bedrock_overwrite_error.overwrite'),
						tl('dialog.cancel')
					],
					title: 'Blockbench',
					message: tl('message.bedrock_overwrite_error.message'),
					detail: err,
					noLink: false
				})
				if (answer === 0) {
					var backup_file_name = pathToName(filepath, true) + ' backup ' + new Date().toLocaleString().split(':').join('_')
					backup_file_name = filepath.replace(pathToName(filepath, false), backup_file_name)
					fs.writeFile(backup_file_name, data, function (err2) {
						if (err2) {
							console.log('Error saving backup model: ', err2)
						}
					})
				}
				if (answer === 2) {
					return;
				}
			}
			if (typeof obj === 'object') {
				for (var key in obj) {
					if (obj.hasOwnProperty(key) &&
						obj[key].bones &&
						typeof obj[key].bones === 'object' &&
						obj[key].bones.constructor.name === 'Array'
					) {
						obj[key].bones.forEach(function (bone) {
							if (typeof bone.cubes === 'object' &&
								bone.cubes.constructor.name === 'Array'
							) {
								bone.cubes.forEach(function (c, ci) {
									bone.cubes[ci] = new oneLiner(c)
								})
							}
						})
					}
				}
			}
		}
		obj[model_name] = content
		content = autoStringify(obj)

		fs.writeFile(filepath, content, function (err) {
			if (err) {
				console.log('Error Saving Entity Model: ' + err)
			}
			Blockbench.showQuickMessage('message.save_entity')
			Prop.project_saved = true;
			setProjectTitle(pathToName(filepath, false))
			addRecentProject({ name: pathToName(filepath, 'mobs_id'), path: filepath })
			if (Blockbench.hasFlag('close_after_saving')) {
				closeBlockbenchWindow()
			}
		})
	})
}
function writeFileObj(content, filepath) {
	if (filepath === undefined) {
		return;
	}
	var content = buildOBJModel(pathToName(filepath, false))
	//OBJECT
	fs.writeFile(filepath, content.obj, function (err) { })
	//MATERIAL
	fs.writeFile(filepath.split('.obj').join('.mtl'), content.mtl, function (err) { })
	//IMAGES
	if (settings.obj_textures.value === true) {
		for (var key in content.images) {
			var texture = content.images[key]
			if (texture && texture.path) {
				if (texture.mode === 'link') {
					var native_image_instance = nativeImage.createFromPath(texture.path)
				} else {
					var native_image_instance = nativeImage.createFromDataURL(texture.source)
				}
				var image = native_image_instance.toPNG()
				var image_path = filepath.split(osfs)
				image_path.pop()
				image_path = image_path.join(osfs) + osfs + texture.name
				if (image_path.substr(-4) !== '.png') {
					image_path = image_path + '.png'
				}
				fs.writeFile(image_path, image, function (err) { })
			}
		}
	}
	Blockbench.showQuickMessage('message.save_obj')
}

//Open
function readFile(filepath, makeNew) {
	fs.readFile(filepath, 'utf-8', function (err, data) {
		if (err) {
			console.log(err)
			Blockbench.showMessageBox({
				translateKey: 'file_not_found',
				icon: 'error_outline'
			})
			return;
		}
		addRecentProject({ name: pathToName(filepath, 'mobs_id'), path: filepath })
		loadModel(data, filepath, !makeNew)
	})
}
//Backup
function createBackup(init) {
	setTimeout(createBackup, limitNumber(parseFloat(settings.backup_interval.value), 1, 10e8) * 60000)

	var duration = parseInt(settings.backup_retain.value) + 1
	var folder_path = app.app.getPath('userData') + osfs + 'backups'
	var d = new Date()
	var days = d.getDate() + (d.getMonth() + 1) * 30.44 + (d.getYear() - 100) * 365.25

	if (init) {
		fs.readdir(folder_path, (err, files) => {
			if (!err) {
				files.forEach((name, i) => {
					var date = name.split('_')[1]
					if (date) {
						var nums = date.split('.')
						nums.forEach((n, ni) => {
							nums[ni] = parseInt(n)
						})
						var b_days = nums[0] + nums[1] * 30.44 + nums[2] * 365.25
						if (!isNaN(b_days) && days - b_days > duration) {
							try {
								fs.unlinkSync(folder_path + osfs + name)
							} catch (err) { console.log(err) }
						}
					}
				})
			}
		})
	}
	if (init || elements.length === 0) return;

	var model = buildBlockModel({
		backup: true,
		raw: true,
		cube_name: true,
		prevent_dialog: true,
		comment: false,
		groups: true
	})
	var file_name = 'backup_' + d.getDate() + '.' + (d.getMonth() + 1) + '.' + (d.getYear() - 100) + '_' + d.getHours() + '.' + d.getMinutes()
	var file_path = folder_path + osfs + file_name + '.json'

	fs.writeFile(file_path, JSON.stringify(model), function (err) {
		if (err) {
			console.log('Error creating backup: ' + err)
		}
	})
	//trimBackups
}

//Zoom
function setZoomLevel(mode) {
	switch (mode) {
		case 'in': Prop.zoom += 5; break;
		case 'out': Prop.zoom -= 5; break;
		case 'reset': Prop.zoom = 100; break;
	}
	var level = (Prop.zoom - 100) / 12
	currentwindow.webContents.setZoomLevel(level)
	resizeWindow()
}
//Close
window.onbeforeunload = function () {
	if (preventClosing === true) {
		setTimeout(function () {
			showSaveDialog(true)
		}, 2)
		return true;
	}
}
function showSaveDialog(close) {
	if (Blockbench.hasFlag('allow_reload')) {
		close = false
	}
	var unsaved_textures = 0;
	textures.forEach(function (t) {
		if (!t.saved) {
			unsaved_textures++;
		}
	})
	if ((Prop.project_saved === false && elements.length > 0) || unsaved_textures) {
		var answer = app.dialog.showMessageBox(currentwindow, {
			type: 'question',
			buttons: [tl('dialog.save'), tl('dialog.discard'), tl('dialog.cancel')],
			title: 'Blockbench',
			message: tl('message.close_warning.message'),
			noLink: true
		})
		if (answer === 0) {
			if (close === true) {
				Blockbench.addFlag('close_after_saving')
			}
			BarItems.save.trigger()
			return true;
		} else if (answer === 2) {
			return false;
		} else {
			if (close === true) {
				closeBlockbenchWindow()
			}
			return true;
		}
	} else {
		if (close === true) {
			closeBlockbenchWindow()
		}
		return true;
	}
}
function closeBlockbenchWindow() {
	preventClosing = false;

	if (!Blockbench.hasFlag('update_restart')) {
		return currentwindow.close();
	}
	setTimeout(function () {
		currentwindow.close();
	}, 240)
}
