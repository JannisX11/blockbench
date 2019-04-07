
const EditSession = {
	active: false,
	hosting: false,
	BBKey: '1h3sq3hoj6vfkh',
	start: function() {
		if (EditSession.active) return;

		EditSession.hosting = true;
		Prop.session = true;
		EditSession.setState(true);
		var peer = EditSession.peer = new Peer({key: '1h3sq3hoj6vfkh'});
		EditSession.username = $('#edit_session_username').val()

		peer.on('open', (token) => {
			$('#edit_session_token').val(token)
			EditSession.token = token;
			Clipbench.setText(token)
			Blockbench.dispatchEvent('create_session', {peer, token})
		})
		peer.on('connection', (conn) => {
			EditSession.initConnection(conn)
			Prop.connections = Object.keys(peer.connections).length
			console.log(tl('edit_session.joined', [conn.metadata.username]))
			Blockbench.showQuickMessage(tl('edit_session.joined', [conn.metadata.username]))
			//New Login
			var model = buildBBModel({uuids: true, bitmaps: true, history: true})
			conn.on('open', function() {
				Blockbench.dispatchEvent('user_joins_session', {conn})
				conn.send({
					type: 'init_model',
					fromHost: EditSession.hosting,
					sender: EditSession.peer.id,
					data: model
				})
			})
			conn.on('close', function() {
				Blockbench.dispatchEvent('user_leaves_session', {conn})
				Blockbench.showQuickMessage(tl('edit_session.left', [conn.metadata.username]))
				delete peer.connections[conn.peer]
				Prop.connections = Object.keys(peer.connections).length
			})
		})
	},
	join: function() {
		if (EditSession.active) return;

		EditSession.hosting = false;
		EditSession.peer = new Peer({key: '1h3sq3hoj6vfkh'});
		var token = $('#edit_session_token').val()
		var username = $('#edit_session_username').val()
		if (!token || !EditSession._matchToken(token)) {
			Blockbench.showMessageBox({
				translateKey: 'invalid_session',
				icon: 'cloud_off',
				buttons: [tl('dialog.ok')],
			}, result => {
				showDialog('edit_sessions');
			})
		}

		EditSession.token = token;
		var conn = EditSession.peer.connect(token, {metadata: {username: username}});

		conn.on('error', (a, b) => {
			Blockbench.showMessageBox({
				translateKey: 'invalid_session',
				icon: 'cloud_off',
				buttons: [tl('dialog.ok')],
			}, result => {
				showDialog('edit_sessions');
			})
		})
		conn.on('open', () => {
			hideDialog()
			EditSession.host = conn;
			EditSession.setState(true);
			EditSession.initConnection(conn)
			Blockbench.dispatchEvent('join_session', {conn})
		})
	},
	quit: function() {
		Blockbench.dispatchEvent('quit_session', {})
		if (EditSession.hosting) {
			EditSession.sendAll('command', 'quit_session')
		} else {
			EditSession.host.close()
		}
		setTimeout(function() {
			EditSession.setState(false)
			EditSession.peer.destroy()
			Prop.session = false;
			Prop.connections = 0;
			Blockbench.showQuickMessage('edit_session.quit_session', 1500)
		}, 400)

	},
	setState: function(active) {
		EditSession.active = active;
		$('#edit_session_username, #edit_session_token').attr('readonly', active)
		if (active) {
			$('.edit_session_inactive').hide()
			$('.edit_session_active').show()
			$('#edit_session_status').text(EditSession.hosting ? tl('edit_session.hosting') : tl('edit_session.connected'))
			$('#edit_session_copy_button .tooltip').text(tl('action.copy'))
		} else {
			EditSession.hosting = false;
			$('.edit_session_active').hide()
			$('.edit_session_inactive').show()
			$('#edit_session_copy_button .tooltip').text(tl('action.paste'))
			$('#edit_session_token').val('')
		}
	},
	dialog: function() {
		showDialog('edit_sessions');
		if (!EditSession.active && isApp) {
			var token = clipboard.readText()
			if (EditSession._matchToken(token)) {
				$('#edit_session_token').val(token)
			}
			var username = process.env.USERNAME
			if (username) {
				$('#edit_session_username').val(username)
			}
		}
	},
	copyToken: function() {
		var input = $('#edit_session_token')
		if (EditSession.active) {
			input.focus()
			document.execCommand('selectAll')
			document.execCommand('copy')
		} else {
			if (isApp) {
				var token = clipboard.readText()
				if (EditSession._matchToken(token)) {
					$('#edit_session_token').val(token)
				}
			} else {
				input.focus()
				document.execCommand('selectAll')
				document.execCommand('paste')
			}
		}
	},
	initNewModel: function(force) {	
		if (EditSession.active && EditSession.hosting) {
			var model = buildBBModel({uuids: true, bitmaps: true, raw: true})
			if (force) {
				model.flag = 'force'
			}
			EditSession.sendAll('init_model', JSON.stringify(model))
		}
	},

	initConnection: function(conn) {
		conn.on('data', EditSession.receiveData)
	},
	sendAll: function(type, data) {
		var tag = {type, data}
		Blockbench.dispatchEvent('send_session_data', tag)
		for (var key in EditSession.peer.connections) {
			var conns = EditSession.peer.connections[key];
			conns.forEach(conn => {
				conn.send({
					type: tag.type,
					fromHost: EditSession.hosting,
					sender: EditSession.peer.id,
					data: tag.data
				});
			})
		}
		if (Blockbench.hasFlag('log_session')) {
			console.log('Sent Data:', type, data)
		}
	},
	sendEdit: function(entry) {
		var new_entry = {
			before: omitKeys(entry.before, ['aspects']),
			post: omitKeys(entry.post, ['aspects']),
			save_history: entry.save_history,
			action: entry.action
		}
		EditSession.sendAll('edit', JSON.stringify(new_entry))
	},
	receiveData: function(tag) {
		if (Blockbench.hasFlag('log_session')) {
			console.log('Received Data:', tag)
		}
		if (EditSession.hosting && !tag.hostOnly && Object.keys(EditSession.peer.connections).length > 1) {
			//Redistribute
			for (var id in EditSession.peer.connections) {
				if (id !== tag.sender) {
					EditSession.peer.connections[id][0].send(tag);
				}
			}
		}
		var data = tag.data;
		if (typeof data === 'string' && (data.includes('"') || data.includes('['))) {
			try {
				data = tag.data = JSON.parse(data)
			} catch (err) {
				console.log(err)
				return;
			}
		}
		Blockbench.dispatchEvent('receive_session_data', tag)

		if (tag.type === 'edit') {
			Undo.remoteEdit(data)
		} else if (tag.type === 'init_model') {
			force = data.flag === 'force';
			newProject(false, force)
			loadBBModel(data)
		} else if (tag.type === 'command') {
			switch (data) {
				case 'undo': Undo.undo(true); break;
				case 'redo': Undo.redo(true); break;
				case 'quit_session': EditSession.quit(); break;
			}
		} else if (tag.type === 'change_project_meta') {
			for (var key in data) {
				Project = data[key];
			}
		}
	},
	_matchToken: function(token) {
		return !!(token.length === 16 && token.match(/[a-z0-9]{16}/))
	}
}

BARS.defineActions(function() {
	new Action({
		id: 'edit_session',
		icon: 'people',
		category: 'blockbench',
		click: EditSession.dialog
	})
})