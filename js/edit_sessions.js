class EditSession {
	constructor() {
		this.active = false;
		this.hosting = false;
		this.clients = {};
		this.client_count = 1;

		this.data_queue = [];

		this.chat_history = [];

		this.Project = Project || null;
		Interface.Panels.chat.inside_vue.chat_history = this.chat_history;
		if (Project) Project.EditSession = this;
	}
	updateClientCount() {
		this.client_count = Math.clamp(Object.keys(this.clients).length, 1, 999);
		this.sendAll('client_count', this.client_count);
	}
	start(username) {
		if (this.active) return;

		var peer = this.peer = new Peer({
			key: 'edit_session',
			host: EditSession.defaults.ip,
			port: 9000,
			path: '/sessions',
			secure: true
		});
		this.username = username || EditSession.defaults.placeholder_names.random();
		this.username = EditSession.sanitizeMessage(this.username);
		settings.username.value = this.username;

		peer.on('open', (token) => {
			this.hosting = true;
			this.setState(true);

			this.self = new EditSession.Client(this, {
				id: this.peer.id,
				name: this.username,
				hosting: true
			})

			$('#edit_session_token').val(token)
			this.token = token;
			Clipbench.setText(token)
			Blockbench.dispatchEvent('create_session', {peer, token})
			BarItems.edit_session.click();
		})
		peer.on('connection', (conn) => {
			conn.on('open', () => {

				var client = new EditSession.Client(this, {
					id: conn.peer,
					conn: conn,
					name: conn.metadata.username,
					hosting: false
				})
				this.processChatMessage({text: tl('edit_session.joined', [client.name]), color: 'green'})
				Blockbench.showQuickMessage(tl('edit_session.joined', [client.name]))
				//New Login
				client.send({
					type: 'chat_message',
					data: {text: tl('edit_session.welcome', [this.username]), color: 'yellow'}
				})
				var model = Codecs.project.compile({uuids: true, bitmaps: true, backup: true, history: true})
				client.send({
					type: 'init_model',
					fromHost: this.hosting,
					sender: this.peer.id,
					data: model
				})
			})
		})
		peer.on('error', error => {
			console.error('Error in edit session:', error)
		})
	}
	join(username, token) {
		if (this.active) return;

		this.hosting = false;
		this.peer = new Peer({
			key: 'edit_session',
			host: EditSession.defaults.ip,
			port: 9000,
			path: '/sessions',
			secure: true
		});
		this.peer.on('open', () => {

			this.username = username || EditSession.defaults.placeholder_names.random();
			this.username = EditSession.sanitizeMessage(this.username);
			settings.username.value = this.username;
			if (!token || !EditSession.matchToken(token)) {
				Blockbench.showMessageBox({
					translateKey: 'invalid_session',
					icon: 'cloud_off',
				}, result => {
					showDialog('edit_sessions');
				})
				return;
			}
			this.token = token;
			var conn = this.peer.connect(token, {metadata: {username: this.username}});

			conn.on('error', (err) => {
				console.error('peer join error', err)
				Blockbench.showMessageBox({
					translateKey: 'invalid_session',
					icon: 'cloud_off',
				})
				this.quit()
			})
			conn.on('open', () => {
				hideDialog()
				this.host = conn;
				this.setState(true);
				this.initConnection(conn)
				updateInterfacePanels()
				Blockbench.dispatchEvent('join_session', {conn})
			})
		})
		this.peer.on('error', error => {
			console.error('Error in edit session:', error)
		})
	}
	quit() {
		if (!this.active) return;
		
		Blockbench.dispatchEvent('quit_session', {})
		if (this.hosting) {
			this.sendAll('command', 'quit_session')
		} else {
			this.host.close()
		}
		ModelProject.all.forEach(project => {
			if (project.EditSession == this) {
				delete project.EditSession;
			}
		})
		setTimeout(() => {
			this.setState(false)
			this.chat_history.purge()
			this.peer.destroy()
			Blockbench.showQuickMessage('edit_session.quit_session', 1500)
		}, 400)
	}
	setState(active) {
		this.active = active;
		if (!active) {
			this.hosting = false;
		}
		Interface.tab_bar.$forceUpdate();
		TickUpdates.interface = true;
	}
	copyToken() {
		var input = $('#edit_session_token')
		if (this.active) {
			input.focus()
			document.execCommand('selectAll')
			document.execCommand('copy')
		} else {
			if (isApp) {
				var token = clipboard.readText()
				if (EditSession.matchToken(token)) {
					$('#edit_session_token').val(token)
				}
			} else {
				navigator.clipboard.readText().then((token) => {
					if (EditSession.matchToken(token)) {
						$('#edit_session_token').val(token)
					}
				})
			}
		}
	}
	initNewModel(force) {	
		if (this.active && this.hosting) {
			var model = Codecs.project.compile({uuids: true, bitmaps: true, backup: true, flag: force ? 'force' : null})
			if (force) {
				model.flag = 'force'
			}
			this.sendAll('init_model', model)
		}
	}
	initConnection(conn) {
		conn.on('data', (...args) => this.receiveData(...args))
	}
	sendAll(type, data) {
		var tag = {type, data}
		Blockbench.dispatchEvent('send_session_data', tag)
		for (var key in this.peer.connections) {
			var conns = this.peer.connections[key];
			conns.forEach(conn => {
				conn.send({
					type: tag.type,
					fromHost: this.hosting,
					sender: this.peer.id,
					data: tag.data
				});
			})
		}
		if (Blockbench.hasFlag('log_session')) {
			console.log('Sent Data:', type, data)
		}
	}
	sendEdit(entry) {
		var new_entry = {
			before: omitKeys(entry.before, ['aspects']),
			post: omitKeys(entry.post, ['aspects']),
			save_history: entry.save_history,
			action: entry.action,
			time: entry.time || Date.now()
		}
		this.sendAll('edit', JSON.stringify(new_entry))
	}
	receiveData(tag) {
		if (Blockbench.hasFlag('log_session')) {
			console.log('Received Data:', tag)
		}
		if (this.hosting && !tag.hostOnly && Object.keys(this.peer.connections).length > 1) {
			//Redistribute
			for (var id in this.peer.connections) {
				if (id !== tag.sender && this.peer.connections[id].length) {
					this.peer.connections[id][0].send(tag);
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
		Blockbench.dispatchEvent('receive_session_data', tag);

		if (tag.type === 'chat_input' && this.hosting) {
			this.processChatMessage(tag.data);

		} else if (tag.type === 'chat_message') {
			this.addChatMessage(tag.data);

		} else {
			if (Project.EditSession == this || (!this.Project)) {
				this.processData(tag);
			} else {
				this.data_queue.push(tag);
			}
		}


	}
	processData(tag) {
		let {data} = tag;
		if (tag.type === 'edit') {
			Undo.remoteEdit(data);

		} else if (tag.type === 'init_model') {

			setupProject(data.meta.type||'free', data.flag === 'force');
			Codecs.project.parse(data);
			this.Project = Project;
			this.Project.EditSession = this;
			updateInterfacePanels();

		} else if (tag.type === 'command') {
			switch (data) {
				case 'undo': Undo.undo(true); break;
				case 'redo': Undo.redo(true); break;
				case 'quit_session': this.quit(); break;
			}

		} else if (tag.type === 'client_count') {
			this.client_count = parseInt(data);

		} else if (tag.type === 'change_project_meta') {
			for (var key in data) {
				Project[key] = data[key];
			}

		}
	}
	catchUp() {
		while (this.data_queue.length) {
			let tag = this.data_queue.shift();
			try {
				this.processData(tag);
			} catch (err) {
				console.error(err);
			}
		}
	}

	sendChat(text) {
		if (typeof text !== 'string') {
			text = $('input#chat_input').val()
			$('input#chat_input').val('')
		}
		if (!text) return;
		text = EditSession.sanitizeMessage(text);
		this.processChatMessage({
			author: this.username,
			text: text,
			sender: this.peer.id
		})
	}
	addChatMessage(message) {
		if (!(message instanceof EditSession.ChatMessage)) {
			message = new EditSession.ChatMessage(this, message)
		}
		if (!message.text) return;
		
		this.chat_history.push(message)
		Vue.nextTick(() => {
			$('#chat_history').scrollTop(10000)
		})
		if (!document.hasFocus() && !message.self) {
			Blockbench.notification(message.author ? message.author+':' : 'Chat', message.text)
		}
		return message;
	}
	processChatMessage(data) {
		if (!this.hosting) {
			this.host.send({
				type: 'chat_input',
				data,
				sender: this.peer.id
			})
			return;
		}
		//Host Only
		Blockbench.dispatchEvent('process_chat_message', data)

		this.sendAll('chat_message', data)
		this.addChatMessage(data)
	}
}

EditSession.matchToken = function(token) {
	return !!(token.length === 16 && token.match(/[a-z0-9]{16}/))
}

EditSession.defaults = {
	max_chat_length: 512,
	ip: 'blckbn.ch',
	placeholder_names: ['R2D2', 'Tin Man', 'C3PO', 'WALL-E', 'EVE', 'BB-8', 'B1 Battle Droid', 'ASIMO', 'Atlas'],
}

EditSession.Client = class {
	constructor(session, data) {
		var scope = this;
		this.id = data.id;
		this.hosting = data.hosting;
		this.conn = data.conn;
		this.name = data.name;
		this.session = session;

		this.session.clients[this.id] = this;
		this.session.updateClientCount()

		if (this.conn) {
			this.session.initConnection(this.conn)
			this.conn.on('close', () => {
				scope.disconnect()
			})
			this.conn.on('error', (e) => {
				scope.disconnect()
				this.conn.close()
				console.error(e)
			})
			Blockbench.dispatchEvent('user_joins_session', this)
		}
	}
	send(tag) {
		this.conn.send(tag)
	}
	disconnect(e) {
		if (!this.session.clients[this.id]) return;
		Blockbench.dispatchEvent('user_leaves_session', this)
		delete this.session.peer.connections[this.conn.peer];
		delete this.session.clients[this.id];
		this.session.updateClientCount();

		this.session.processChatMessage({text: tl('edit_session.left', [this.name]), color: 'red'})
		Blockbench.showQuickMessage(tl('edit_session.left', [this.name]))
	}
};

EditSession.ChatMessage = class {
	constructor(session, data) {
		this.session = session;
		this.author = data.author||'';
		this.author = this.author.substr(0, 64)
		this.sender = data.sender
		this.self = data.sender == this.session.peer.id;
		this.text = data.text.substr(0, EditSession.defaults.max_chat_length)||'';

		this.html = Interface.createElement('p', {}, this.text).innerHTML;
		this.html = this.html.replace(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g, (text, i) => {
			return Interface.createElement('a', {href: text, class: "open-in-browser"}, text).outerHTML;
		})
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
		var this_i = this.session.chat_history.indexOf(this);
		var prev = this.session.chat_history[this_i-1];
		return (!prev) || (prev.author !== this.author);
	}
}

BARS.defineActions(function() {
	new Action('edit_session', {
		icon: 'people',
		category: 'blockbench',
		click: () => {

			let session = Project && Project.EditSession;
			var username, token;

			if (session) {
				username = session.username;
				token = session.token;
			} else {
				username = settings.username.value;
				if (!username && isApp) {
					username = process.env.USERNAME
				}
				token = EditSession.token;
				if (!token && isApp) {
					let clipboard_token = clipboard.readText()
					if (EditSession.matchToken(clipboard_token) && !$('#edit_session_token').val()) {
						token = clipboard_token;
					}
				}
			}

			new Dialog({
				id: 'edit_session',
				title: 'dialog.edit_session.title',
				form: {
					username: {type: 'text', label: 'edit_session.username', value: username},
					token: {type: 'text', label: 'edit_session.token', value: token, readonly: !!session},
					about: {type: 'info', text: 'edit_session.about', condition: !session},
					status: {type: 'info', text: `**${tl('edit_session.status')}**: ${(session && session.hosting) ? tl('edit_session.hosting') : tl('edit_session.connected')}`, condition: !!session},
				},
				buttons: session
					? ['edit_session.quit', 'dialog.close']
					: ['edit_session.join', 'edit_session.create', 'dialog.close'],
				onButton(button) {
					let result = this.getFormResult();
					if (session && button == 0) {
						session.quit();

					} else if (!session && button != 2) {
						if (button == 0) {
							// Join
							session = new EditSession();
							session.join(result.username, result.token);
						} else {
							// Create
							if (!Project) {
								Formats.free.new();
							}
							session = new EditSession();
							session.start(result.username);
						}
					}
				}
			}).show();
		}
	})
})
EditSession.initNewModel = function() {}
EditSession.sanitizeMessage = function(text) {
	let result = '';
	if (!text || typeof text !== 'string') return result;
	for (let i = 0; i < text.length; i++) {
		if (text.charCodeAt(i) < 55296) result += text[i];
	}
	return result;
}

Interface.definePanels(function() {

	new Panel('chat', {
		icon: 'chat',
		condition: {method() {return Project.EditSession && Project.EditSession.active}},
		default_position: {
			slot: 'right_bar',
			float_position: [0, 0],
			float_size: [300, 400],
			height: 400
		},
		toolbars: {},
		onResize: t => {
		},
		component: {
			data() {return {
				chat_history: [],
				chat_input: ''
			}},
			methods: {
				sendMessage() {
					if (Project && Project.EditSession) {
						Project.EditSession.sendChat(this.chat_input);
						this.chat_input = '';
					}
				}
			},
			template: `
				<div>
					<ul id="chat_history">
						<li v-for="msg in chat_history">
							<b v-if="msg.showAuthor()" v-bind:class="{self: msg.self}">{{ msg.author }}:</b>
							<span class="text" v-bind:style="{color: msg.hex || 'inherit'}" v-html="msg.html"></span>
							<span class="timestamp">{{ msg.timestamp }}</span>
						</li>
					</ul>
					<div id="chat_bar">
						<input type="text" id="chat_input" class="dark_bordered f_left" maxlength="512" v-model="chat_input">
						<i class="material-icons" @click="sendMessage()">send</i>
					</div>
				</div>
			`
		}
	})

})
