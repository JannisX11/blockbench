
const EditSession = {
	active: false,
	hosting: false,
	BBKey: '1h3sq3hoj6vfkh',
	clients: {},
	start: function() {
		if (EditSession.active) return;

		var peer = EditSession.peer = new Peer({key: '1h3sq3hoj6vfkh'});
		EditSession.username = $('#edit_session_username').val()

		peer.on('open', (token) => {
			EditSession.hosting = true;
			Prop.session = true;
			EditSession.setState(true);
			EditSession.username = $('#edit_session_username').val()

			var client = EditSession.self = new EditSession.Client({
				id: EditSession.peer.id,
				name: EditSession.username,
				hosting: true
			})

			$('#edit_session_token').val(token)
			EditSession.token = token;
			Clipbench.setText(token)
			Blockbench.dispatchEvent('create_session', {peer, token})
		})
		peer.on('connection', (conn) => {
			conn.on('open', function() {

				var client = new EditSession.Client({
					id: conn.peer,
					conn: conn,
					name: conn.metadata.username,
					hosting: false
				})
				Chat.processMessage({text: tl('edit_session.joined', [client.name]), color: 'green'})
				Blockbench.showQuickMessage(tl('edit_session.joined', [client.name]))
				//New Login
				client.send({
					type: 'chat_message',
					data: {text: tl('edit_session.welcome', [EditSession.username]), color: 'yellow'}
				})
				var model = buildBBModel({uuids: true, bitmaps: true, history: true})
				client.send({
					type: 'init_model',
					fromHost: EditSession.hosting,
					sender: EditSession.peer.id,
					data: model
				})
			})
		})
	},
	join: function() {
		if (EditSession.active) return;

		EditSession.hosting = false;
		EditSession.peer = new Peer({key: '1h3sq3hoj6vfkh'});
		var token = $('#edit_session_token').val()
		EditSession.username = $('#edit_session_username').val()
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
		var conn = EditSession.peer.connect(token, {metadata: {username: EditSession.username}});

		conn.on('error', (e) => {
			Blockbench.showMessageBox({
				translateKey: 'invalid_session',
				icon: 'cloud_off',
				buttons: [tl('dialog.ok')],
			})
			EditSession.quit()
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
		if (!EditSession.active) return;
		
		Blockbench.dispatchEvent('quit_session', {})
		if (EditSession.hosting) {
			EditSession.sendAll('command', 'quit_session')
		} else {
			EditSession.host.close()
		}
		setTimeout(function() {
			EditSession.setState(false)
			Chat.history.purge()
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
		updateInterface()
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
				Project[key] = data[key];
			}

		} else if (tag.type === 'chat_input' && EditSession.hosting) {
			Chat.processMessage(tag.data)

		} else if (tag.type === 'chat_message') {
			Chat.addMessage(tag.data)
		}
	},
	updateClientCount: function() {
		Prop.connections = Object.keys(EditSession.clients).length-1
	},
	_matchToken: function(token) {
		return !!(token.length === 16 && token.match(/[a-z0-9]{16}/))
	}
}
EditSession.Client = class {
	constructor(data) {
		var scope = this;
		this.id = data.id;
		this.hosting = data.hosting;
		this.conn = data.conn;
		this.name = data.name;

		EditSession.clients[this.id] = this;
		EditSession.updateClientCount()

		if (this.conn) {
			EditSession.initConnection(this.conn)
			this.conn.on('close', () => {
				scope.disconnect()
			})
			this.conn.on('error', (e) => {
				scope.disconnect()
				this.conn.close()
				console.error(e)
			})
			Blockbench.dispatchEvent('user_joins_session', {conn: this.conn})
		}
	}
	send(tag) {
		this.conn.send(tag)
	}
	disconnect(e) {
		Blockbench.dispatchEvent('user_leaves_session', {conn: this.conn})
		delete EditSession.peer.connections[this.conn.peer];
		delete EditSession.clients[this.id];
		EditSession.updateClientCount();

		Chat.processMessage({text: tl('edit_session.left', [this.name]), color: 'red'})
		Blockbench.showQuickMessage(tl('edit_session.left', [this.name]))
	}
}

const Chat = {
	history: [],
	expanded: true,
	maxlength: 512,
	toggle: function() {
		this.expanded = !this.expanded;
		BarItems.toggle_chat.setIcon( Chat.expanded ? 'keyboard_arrow_down' : 'keyboard_arrow_up' )
	},
	send: function(text) {
		if (typeof text !== 'string') {
			text = $('input#chat_input').val()
			$('input#chat_input').val('')
		}
		if (!text) return;
		Chat.processMessage({author: EditSession.username, text: text})
	},
	addMessage: function(message) {
		if (!(message instanceof Chat.Message)) {
			message = new Chat.Message(message)
		}
		Chat.history.push(message)
		Vue.nextTick(() => {
			$('#chat_history').scrollTop(10000)
		})
		return message;
	},
	processMessage: function(data) {
		if (!EditSession.hosting) {
			EditSession.host.send({type: 'chat_input', data: data})
			return;
		}
		var message = new Chat.Message(data)
		//Host Only
		Blockbench.dispatchEvent('process_chat_message', message)

		EditSession.sendAll('chat_message', data)
		Chat.addMessage(data)
	}
};
Chat.Message = class {
	constructor(data) {
		this.author = data.author||'';
		this.author = this.author.substr(0, 64)
		this.self = (this.author && this.author === EditSession.username);
		this.text = data.text.substr(0, Chat.maxlength)||'';
		var date = new Date();
		this.timestamp = date.getTimestamp()
		this.toString = () => (this.author + ': ' + this.content);
		//Color
		this.color = data.color
		switch (this.color) {
			case 'red': 	this.hex = '#ff4158'; break;
			case 'orange': 	this.hex = '#ff6f10'; break;
			case 'yellow': 	this.hex = '#ffd100'; break;
			case 'green': 	this.hex = '#00eb3b'; break;
			case 'blue': 	this.hex = '#08a3ff'; break;
		}
	}
	toObject() {
		return {
			author: this.author,
			text: this.text,
			color: this.color,
		}
	}
	showAuthor() {
		if (!this.author) return false;
		var this_i = Chat.history.indexOf(this);
		var prev = Chat.history[this_i-1];
		return (!prev) || (prev.author !== this.author);
	}
}
onVueSetup(function() {
	Chat.vue = new Vue({
		el: '#chat_history',
		data: Chat
	})
})

BARS.defineActions(function() {
	new Action({
		id: 'edit_session',
		icon: 'people',
		category: 'blockbench',
		click: EditSession.dialog
	})
	new Action({
		id: 'toggle_chat',
		icon: 'keyboard_arrow_down',
		condition: () => EditSession.active,
		category: 'blockbench',
		click: () => (Chat.toggle())
	})
})