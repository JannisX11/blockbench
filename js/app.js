const electron = require('electron').remote;
const {clipboard, shell, nativeImage} = require('electron');
const app = electron.app;
const fs = require('fs');
const zlib = require('zlib');
const exec = require('child_process').exec;
const originalFs = require('original-fs');
const https = require('https');

const currentwindow = electron.getCurrentWindow();
var dialog_win	 = null,
	latest_version = false,
	preventClosing = true;
	recent_projects= undefined;

$(document).ready(function() {

	//Setup
	$('.open-in-browser').on('click', (event) => {
		event.preventDefault();
		shell.openExternal(event.target.href);
		return true;
	});
	Prop.zoom = 100 + currentwindow.webContents._getZoomLevel()*12
	if (fs.existsSync(app.getPath('userData')+osfs+'backups') === false) {
		fs.mkdirSync( app.getPath('userData')+osfs+'backups')
	}
	createBackup(true)
	$('.web_only').remove()
	if (__dirname.includes('C:\\xampp\\htdocs\\blockbench')) {
		Blockbench.addFlag('dev')
	}

	//Load Model
	var model_loaded = false
	if (electron.process.argv.length >= 2) {
		var extension = pathToExtension(electron.process.argv[1])

		if (['json', 'bbmodel', 'jem', 'jpm'].includes(extension)) {
			Blockbench.read([electron.process.argv[1]], {}, (files) => {

				loadModel(files[0].content, files[0].path || files[0].path)
				addRecentProject({name: pathToName(files[0].path, 'mobs_id'), path: files[0].path})
				model_loaded = true
			})
		}
	}
	if (!model_loaded && localStorage.getItem('backup_model') && !currentwindow.webContents.second_instance) {
		var backup_model = localStorage.getItem('backup_model')
		localStorage.removeItem('backup_model')
		Blockbench.showMessageBox({
			translateKey: 'recover_backup',
			icon: 'fa-archive',
			buttons: [tl('dialog.continue'), tl('dialog.cancel')],
			confirm: 0,
			cancel: 1
		}, function(result) {
			if (result === 0) {
				loadModel(backup_model, 'backup.bbmodel')
			}
		})
	}
});
(function() {
	console.log('Electron '+process.versions.electron+', Node '+process.versions.node)
	getLatestVersion(true)
})()
//Called on start to show message
function getLatestVersion(init) {
	if (process.platform == 'linux') return;
	$.getJSON('https://raw.githubusercontent.com/JannisX11/blockbench/master/package.json', (data) => {
		if (data.version) {
			latest_version = data.version
			if (compareVersions(latest_version, appVersion) && init === true && !open_dialog) {

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
	}).fail(function() {
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
	var i = recent_projects.length-1
	while (i >= 0) {
		var p = recent_projects[i]
		if (p.path === data.path) {
			recent_projects.splice(i, 1)
		}
		i--;
	}
	var icon_id = pathToExtension(data.path) === 'bbmodel' ? 1 : 0;
	if (data.name.substr(0,4) === 'mobs') {
		icon_id = 2;
	}
	recent_projects.push({name: data.name, path: data.path, icon_id})
	if (recent_projects.length > 12) {
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

		data =  `<div class="tool" onclick="refreshUpdateDialog()">
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
			setTimeout(function() {
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
	currentwindow.webContents.session.clearCache(function() {
		data = '<div class="dialog_bar narrow"><i class="material-icons blue_icon spinning">refresh</i>'+tl('dialog.update.connecting')+'</div>'
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
		asar_path = asar_path + osfs+'resources'+osfs+'app.asar';
	}

	var file = originalFs.createWriteStream(asar_path);

	var request = https.get("https://blockbench.net/api/app.asar", function(response) {
		response.pipe(file);

		total_bytes = parseInt(response.headers['content-length']);

		response.on('end', updateInstallationEnd)
		response.on('data', function(chunk) {
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
	exe_path = exe_path.join(osfs)+osfs+'blockbench.exe';
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
		lines: ['<div class="dialog_bar"><select class="input_wide">'+
				'<option id="ps">Photoshop</option>'+
				'<option id="gimp">Gimp</option>'+
				'<option id="pdn">Paint.NET</option>'+
				'<option id="other">'+tl('message.image_editor.file')+'</option>'+
			'</select></div>'],
		draggable: true,
		onConfirm: function() {
			var id = $('.dialog#image_editor option:selected').attr('id')
			var path;
			switch (id) {
				case 'ps':  path = 'C:\\Program Files\\Adobe\\Adobe Photoshop CC 2018\\Photoshop.exe'; break;
				case 'gimp':path = 'C:\\Program Files\\GIMP 2\\bin\\gimp-2.10.exe'; break;
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
	electron.dialog.showOpenDialog(currentwindow, {
		title: tl('message.image_editor.exe'),
		filters: [{name: 'Executable Program', extensions: ['exe', 'app']}]
	}, function(filePaths) {
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
	var answer = electron.dialog.showMessageBox(currentwindow, {
		type: 'info',
		buttons: (
			settings.default_path.value ? 	[tl('dialog.cancel'), tl('message.default_textures.continue'), tl('message.default_textures.remove')]
										:	[tl('dialog.cancel'), tl('message.default_textures.continue')]
		),
		noLink: true,
		title: tl('message.default_textures.title'),
		message: tl('message.default_textures.message'),
		detail: tl('message.default_textures.detail'),
	})
	if (answer === 0) {
		return;
	} else if (answer === 1) {
		 electron.dialog.showOpenDialog(currentwindow, {
			title: tl('message.default_textures.select'),
			properties: ['openDirectory'],
		}, function(filePaths) {
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
		'llamaspit': 'llama/spit',
		'llama': 'llama/llama_creamy',
		'dragon': 'dragon/dragon',
		'ghast': 'ghast/ghast',
		'slime': 'slime/slime',
		'slime.armor': 'slime/slime',
		'lavaslime': 'slime/magmacube',
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
		'spider': 'spider/spider',
		'cow': 'cow/cow',
		'mooshroom': 'cow/mooshroom',
		'sheep.sheared': 'sheep/sheep',
		'sheep': 'sheep/sheep',
		'pig': 'pig/pig',
		'irongolem': 'iron_golem',
		'snowgolem': 'snow_golem',
		'zombie.villager': 'zombie_villager/zombie_farmer',
		'evoker': 'illager/evoker',
		'vex': 'vex/vex',
		'wolf': 'wolf/wolf',
		'ocelot': 'cat/ocelot',
		'cat': 'cat/siamese',
		'turtle': 'sea_turtle',
		'villager': 'villager/farmer',
		'villager.witch': 'witch',
		'witherBoss': 'wither_boss/wither',
		'parrot': 'parrot/parrot_red_blue',
		'bed': 'bed/white',
		'player_head': 'steve',
		'mob_head': 'skeleton/skeleton',
		'dragon_head': 'dragon/dragon',
		'boat': 'boat/boat_oak',
		'cod': 'fish/fish',
		'pufferfish.small': 'fish/pufferfish',
		'pufferfish.mid': 'fish/pufferfish',
		'pufferfish.large': 'fish/pufferfish',
		'salmon': 'fish/salmon',
		'tropicalfish_a': 'fish/tropical_a',
		'tropicalfish_b': 'fish/tropical_b',
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
			return texture_path+'.png';
		} else if (return_path === 'raw') {
			return ['entity', ...path.split('/')].join(osfs)
		} else {
			function tryItWith(extension) {
				if (fs.existsSync(texture_path+'.'+extension)) {
					var texture = new Texture({keep_size: true}).fromPath(texture_path+'.'+extension).add()
				}
			}
			if (!tryItWith('png') && !tryItWith('tga')) {
				if (settings.default_path && settings.default_path.value) {
					
					texture_path = settings.default_path.value + osfs + 'entity' + osfs + path.split('/').join(osfs)
					tryItWith('png') || tryItWith('tga')
				}
			}
		}
	}
}
function findBedrockAnimation() {

	var animation_path = Prop.file_path.split(osfs)
	var index = animation_path.lastIndexOf('models')
	animation_path.splice(index)
	var path1 = [...animation_path, 'animations', pathToName(Prop.file_path)+'.json'].join(osfs)
	var path2 = [...animation_path, 'animations', pathToName(Prop.file_path).replace('.geo', '')+'.animation.json'].join(osfs)
	if (fs.existsSync(path1)) {
		Blockbench.read([path1], {}, (files) => {
			Animator.loadFile(files[0])
		})
	} else if (fs.existsSync(path2)) {
		Blockbench.read([path2], {}, (files) => {
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
			writeFileEntity(buildEntityModel({raw: true}), Prop.file_path)
		}
	} else {
		if (Blockbench.entity_mode === false) {
			BarItems.export_blockmodel.trigger()
		} else {
			BarItems.export_entity.trigger()
		}
	}
	if (Blockbench.entity_mode && Prop.animation_path) {
		Blockbench.writeFile(Prop.animation_path, {
			content: autoStringify(Animator.buildFile())
		})
	}
}
function writeFileEntity(content, filepath) {


	Prop.file_path = filepath
	var model_name = 'geometry.' + (Project.parent.replace(/^geometry\./, '')||'unknown')
	var data;
	try {
		data = fs.readFileSync(filepath, 'utf-8')
	} catch (err) {}
	var obj = {
		format_version: '1.10.0'
	}
	if (data) {
		try {
			obj = JSON.parse(data.replace(/\/\*[^(\*\/)]*\*\/|\/\/.*/g, ''))
		} catch (err) {
			err = err+''
			var answer = electron.dialog.showMessageBox(currentwindow, {
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
					obj[key].bones.forEach(function(bone) {
						if (typeof bone.cubes === 'object' &&
							bone.cubes.constructor.name === 'Array'
						) {
							bone.cubes.forEach(function(c, ci) {
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

	try {
		fs.writeFileSync(filepath, content)
	} catch (err) {
		console.log('Error Saving Entity Model: '+err)
		return;
	}
	Blockbench.showQuickMessage('message.save_entity')
	Prop.project_saved = true;
	setProjectTitle(pathToName(filepath, false))
	addRecentProject({name: pathToName(filepath, 'mobs_id'), path: filepath})
	if (Blockbench.hasFlag('close_after_saving')) {
		closeBlockbenchWindow()
	}
}
function writeFileObj(content, filepath) {
	if (filepath === undefined) {
		return;
	}
	var content = buildOBJModel(pathToName(filepath, false))
	//OBJECT
	fs.writeFile(filepath, content.obj, function (err) {})
	//MATERIAL
	fs.writeFile(filepath.split('.obj').join('.mtl'), content.mtl, function (err) {})
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
				fs.writeFile(image_path, image, function (err) {})
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
		addRecentProject({name: pathToName(filepath, 'mobs_id'), path: filepath})
		loadModel(data, filepath, !makeNew)
	})
}
//Backup
function createBackup(init) {
	setTimeout(createBackup, limitNumber(parseFloat(settings.backup_interval.value), 1, 10e8)*60000)

	var duration = parseInt(settings.backup_retain.value)+1
	var folder_path = app.getPath('userData')+osfs+'backups'
	var d = new Date()
	var days = d.getDate() + (d.getMonth()+1)*30.44 + (d.getYear()-100)*365.25

	if (init) {
		//Clear old backups
		fs.readdir(folder_path, (err, files) => {
			if (!err) {
				files.forEach((name, i) => {
					var date = name.split('_')[1]
					if (date) {
						var nums = date.split('.')
						nums.forEach((n, ni) => {
							nums[ni] = parseInt(n)
						})
						var b_days = nums[0] + nums[1]*30.44 + nums[2]*365.25
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
	if (init || elements.length === 0) return;

	var model = buildBBModel()
	localStorage.setItem('backup_model', model)
	var file_name = 'backup_'+d.getDate()+'.'+(d.getMonth()+1)+'.'+(d.getYear()-100)+'_'+d.getHours()+'.'+d.getMinutes()
	var file_path = folder_path+osfs+file_name+'.bbmodel'

	fs.writeFile(file_path, model, function (err) {
		if (err) {
			console.log('Error creating backup: '+err)
		}
	})
}
//Close
window.onbeforeunload = function() {
	if (preventClosing === true) {
		setTimeout(function() {
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
	textures.forEach(function(t) {
		if (!t.saved) {
			unsaved_textures++;
		}
	})
	if ((Prop.project_saved === false && elements.length > 0) || unsaved_textures) {
		var answer = electron.dialog.showMessageBox(currentwindow, {
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
	Blockbench.dispatchEvent('before_closing')
	localStorage.removeItem('backup_model')
	EditSession.quit()
	
	if (!Blockbench.hasFlag('update_restart')) {
		return currentwindow.close();
	}
	setTimeout(function() {
		currentwindow.close();
	}, 240)
}
