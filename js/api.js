class API {
	constructor() {
		this.elements = elements;
		this.textures = textures;
		this.display_settings = display;
		this.isWeb = !isApp;
		this.version = appVersion;
		this.platform = 'web'
		this.selection = selected;
		this.flags = []
		if (isApp) {
			this.platform = require('os').platform()
			if (this.platform.includes('win32') === true) osfs = '\\'
		}
	}
	registerEdit(name) {
		setUndo(name)
	};

	addMenuEntry(name, icon, cb) {
		var entry = $('<li><i class="material-icons">' + icon + '</i><span>' + name + '</span></li>')
		entry.click(cb)
		$('#plugin_submenu').append(entry)
		$('.plugin_submenu_hide').show()
	}
	removeMenuEntry(name) {
		$('#plugin_submenu li').each(function(i, s) {
			if ($(s).find('span').text() === name) {
				$(s).remove()
			}
		})
		if ($('#plugin_submenu li').length === 0) {
			$('.plugin_submenu_hide').hide()
		}
	}

	showMessage(message, location) {
		if (location === 'status_bar') {
			showStatusMessage(message)
		} else if (location === 'center') {
			showQuickMessage(message)
		}
	}

	import(type, cb, extensions) {
		type = type.replace('.', '')
		if (Blockbench.isWeb) {
			fileLoaderLoad('.'+type, false, function() {
				hideDialog()
				var file = $('#file_upload').get(0).files[0]
				var reader = new FileReader()
				reader.onloadend = function() {
					cb(reader.result)
				}
				if (file) {
					reader.readAsText(file)
				}
			})
		    $('#file_folder').val('')
		} else {
			if (!extensions) {
				extensions = []
				extensions.push(type)
			}
		    app.dialog.showOpenDialog(currentwindow, {filters: [{name: type, extensions: extensions}] }, function (fileNames) {
		        if (fileNames !== undefined) {
		            fs.readFile(fileNames[0], 'utf-8', function (err, data) {
				        if (err) {
				            console.log(err)
				            return;
				        }
				        cb(data, fileNames[0])
				    })
		        }
		    })
		}
	}

	export(content, name, type) {
		type = type.replace('.', '')
		if (Blockbench.isWeb) {
		    var blob = new Blob([content], {type: "text/plain;charset=utf-8"});
		    saveAs(blob, name+'.'+type)
		} else {
		    app.dialog.showSaveDialog(currentwindow, {
		        filters: [ {
		            name: type,
		            extensions: [type]
		        } ],
		        defaultPath: name
		    }, function (fileName) {
		        if (fileName === undefined) {
		            return;
		        }
		        fs.writeFile(fileName, content, function (err) {
		            if (err) {
		                console.log('Error Exporting File: '+err)
		            }
		        })
		    })
		}
	}
	dispatchEvent(event_name, event) {
		if (!this.listeners) {
			return;
		}
		var i = 0;
		while (i < this.listeners.length) {
			if (this.listeners[i].name === event_name) {
				this.listeners[i].callback(event)
			}
			i++;
		}
	}
	addListener(event_name, cb) {
		if (!this.listeners) {
			this.listeners = []
		}
		this.listeners.push({name: event_name, callback: cb})
	}
	removeListener(event_name, cb) {
		if (!this.listeners) {
			return;
		}
		var i = 0;
		while (i < this.listeners.length) {
			if (this.listeners[i].name === event_name && this.listeners[i].callback === cb) {
				this.listeners.splice(i, 1)
			}
			i++;
		}
	}
	reload() {
        preventClosing = false
		Blockbench.flags.push('allow_reload')
		currentwindow.reload()
	}
	//Flags
	addFlag(flag) {
		if (!this.hasFlag(flag)) {
			this.flags.push(flag)
		}
	}
	removeFlag(flag) {
		this.flags.remove(flag)
	}
	hasFlag(flag) {
		return this.flags.includes(flag)
	}
}

function Dialog(settings) {
	var scope = this;
	this.title = settings.title
	this.lines = settings.lines
	this.id = settings.id
	this.width = settings.width
	this.fadeTime = settings.fadeTime
	this.draggable = settings.draggable
	this.singleButton = settings.singleButton
	if (!parseInt(settings.fadeTime)) this.fadeTime = 200


	this.hide = function() {
	    $('#blackout').fadeOut(this.fadeTime)
	    $(scope.object).fadeOut(this.fadeTime)
	    open_dialog = false;
	    setTimeout(function() {
	    	$(scope.object).remove()
	    },this.fadeTime)
	    console.log('Hiding Dialog')
	}

	this.confirmEnabled = settings.confirmEnabled === false ? false : true
	this.cancelEnabled = settings.cancelEnabled === false ? false : true
	this.onConfirm = settings.onConfirm ? settings.onConfirm : this.hide
	this.onCancel = settings.onCancel ? settings.onCancel : this.hide

	this.object;

	this.confirm = function() {
		$(this.object).find('.confirm_btn:not([disabled])').click()
	}
	this.cancel = function() {
		$(this.object).find('.cancel_btn:not([disabled])').click()
	}
	this.show = function() {
		var jq_dialog = $('<div class="dialog paddinged" style="width: auto;" id="'+scope.id+'"><h2 class="dialog_handle">'+scope.title+'</h2></div>')
		scope.object = jq_dialog.get(0)
		scope.lines.forEach(function(l) {
			jq_dialog.append(l)
		})
		if (this.singleButton) {
			jq_dialog.append('<div class="dialog_bar">' +
	            '<button type="button" class="large cancel_btn confirm_btn"'+ (this.confirmEnabled ? '' : ' disabled') +'>Close</button>' +
	        '</div>')
		} else {
			jq_dialog.append(['<div class="dialog_bar">',
	            '<button type="button" class="large confirm_btn"'+ (this.confirmEnabled ? '' : ' disabled') +'>Confirm</button>',
	            '<button type="button" class="large cancel_btn"'+ (this.cancelEnabled ? '' : ' disabled') +'>Cancel</button>',
	        '</div>'].join(''))
	    }
        jq_dialog.append('<div id="dialog_close_button" onclick="$(\'.dialog#\'+open_dialog).find(\'.cancel_btn:not([disabled])\').click()"><i class="material-icons">clear</i></div>')
		$(this.object).find('.confirm_btn').click(this.onConfirm)
		$(this.object).find('.cancel_btn').click(this.onCancel)
	    //Draggable
	    if (this.draggable !== false) {
	    	jq_dialog.addClass('draggable')
	        jq_dialog.draggable({
	            handle: ".dialog_handle"
	        })
	        var x = ($(window).width()-540)/2
	        jq_dialog.css('left', x+'px')
	        jq_dialog.css('position', 'absolute')
	    }
		$('#plugin_dialog_wrapper').append(jq_dialog)
	    $('.dialog').hide(0)
	    $('#blackout').fadeIn(scope.fadeTime)
	    jq_dialog.fadeIn(scope.fadeTime)
	    jq_dialog.css('top', limitNumber($(window).height()/2-jq_dialog.height()/2, 0, 100)+'px')
	    if (this.width) {
	    	jq_dialog.css('width', this.width+'px')
	    }
	    setTimeout(function() {
	        $('.context_handler.ctx').removeClass('ctx')
	    }, 64)
	    open_dialog = scope.id
	    return this;
	}
}


function ContextMenu(event, array) {
	function getEntryFromObject(s, parent) {
		if (s.local_only && !isApp) return;

		var icon = ''
		if (typeof s.icon === 'string') {
			if (s.icon.substr(0, 2) === 'fa') {
				icon = '<i class="fa fa_big ' + s.icon + '"></i>'
			} else {
				icon = '<i class="material-icons">' + s.icon + '</i>'
			}
			var entry = $('<li>' + icon + s.name + '</li>')
		} else {
			var entry = $('<li></li>')
			entry.append(s.icon)
			entry.append(s.name)

		}

		if (s.children && s.children) {
			if (typeof s.children === 'function') {
				s.children = s.children()
			}
			entry.addClass('parent')
			var childlist = $('<ul class="contextMenu sub"></ul>')
			s.children.forEach(function(c) {
				childlist.append(getEntryFromObject(c, childlist))
			})
			entry.append(childlist)
			//HERE
			entry.mouseenter(function(event) {
				//Left
				childlist.css('left', '0')
				var offset = childlist.offset()
				var el_width = -childlist.width()
				var p_width = parent.width()
				if (offset.left + childlist.width() > $(window).width()-100) {
					childlist.css('left', el_width + 'px')
				} else {
					childlist.css('left', p_width + 'px')
				}
				//Top
			})
		}

		entry.click(s.click)
		return entry
	}

	var ctxmenu = $('<ul class="contextMenu"></ul>')
	array.forEach(function(s, i) {
		ctxmenu.append(getEntryFromObject(s, ctxmenu))
	})
	$('body').append(ctxmenu)

	var el_width = ctxmenu.width()

	var offset_left = event.clientX
	var offset_top  = event.clientY

	if (offset_left > $(window).width() - el_width) offset_left -= el_width
	if (offset_top  > $(window).height() - 35 * array.length ) offset_top -= 35 * array.length

	ctxmenu.css('left', offset_left+'px')
	ctxmenu.css('top',  offset_top +'px')

	ctxmenu.click(function() {
		this.remove()
	})
	return ctxmenu;
}

var Blockbench = new API()