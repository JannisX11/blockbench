function compileJSON(object, options = {}) {
	let indentation = options.indentation;
	if (typeof indentation !== 'string') {
		switch (settings.json_indentation.value) {
			case 'spaces_4': indentation = '    '; break;
			case 'spaces_2': indentation = '  '; break;
			case 'tabs': default: indentation = '\t'; break;
		}
	}
	function newLine(tabs) {
		if (options.small === true) {return '';}
		let s = '\n';
		for (let i = 0; i < tabs; i++) {
			s += indentation;
		}
		return s;
	}
	function escape(string) {
		if (string.includes('\\')) {
			string = string.replace(/\\/g, '\\\\');
		}
		if (string.includes('"')) {
			string = string.replace(/"/g, '\\"');
		}
		if (string.includes('\n')) {
			string = string.replace(/\n|\r\n/g, '\\n');
		}
		if (string.includes('\t')) {
			string = string.replace(/\t/g, '\\t');
		}
		return string;
	}
	function handleVar(o, tabs, breaks = true) {
		var out = ''
		let type = typeof o;
		if (type === 'string') {
			//String
			out += '"' + escape(o) + '"'
		} else if (type === 'boolean') {
			//Boolean
			out += (o ? 'true' : 'false')
		} else if (o === null || o === Infinity || o === -Infinity) {
			//Null
			out += 'null'
		} else if (type === 'number') {
			//Number
			o = (Math.round(o*100000)/100000).toString()
			if (o == 'NaN') o = null
			out += o
		} else if (o instanceof Array) {
			//Array
			let has_content = false
			let multiline = !!o.find(item => typeof item === 'object');
			if (!multiline) {
				let length = 0;
				o.forEach(item => {
					length += typeof item === 'string' ? (item.length+4) : 3;
				});
				if (length > 140) multiline = true;
			}
			out += '['
			for (var i = 0; i < o.length; i++) {
				var compiled = handleVar(o[i], tabs+1)
				if (compiled) {
					if (has_content) {out += ',' + ((options.small || multiline) ? '' : ' ')}
					if (multiline) {out += newLine(tabs)}
					out += compiled
					has_content = true
				}
			}
			if (multiline) {out += newLine(tabs-1)}
			out += ']'
		} else if (type === 'object') {
			//Object
			breaks = breaks && o.constructor.name !== 'oneLiner';
			var has_content = false
			out += '{'
			for (var key in o) {
				if (o.hasOwnProperty(key)) {
					var compiled = handleVar(o[key], tabs+1, breaks)
					if (compiled) {
						if (has_content) {out += ',' + (breaks || options.small?'':' ')}
						if (breaks) {out += newLine(tabs)}
						out += '"' + escape(key) + '":' + (options.small === true ? '' : ' ')
						out += compiled
						has_content = true
					}
				}
			}
			if (breaks && has_content) {out += newLine(tabs-1)}
			out += '}'
		}
		return out;
	}
	let file = handleVar(object, 1);
	if ((settings.final_newline.value && options.final_newline != false) || options.final_newline == true) {
		file += '\n';
	}
	return file;
}
function autoParseJSON(data, feedback) {
	if (data.substr(0, 4) === '<lz>') {
		data = LZUTF8.decompress(data.substr(4), {inputEncoding: 'StorageBinaryString'})
	}
	if (data.charCodeAt(0) === 0xFEFF) {
		data = data.substr(1)
	}
	try {
		data = JSON.parse(data)
	} catch (err1) {
		data = data.replace(/\/\*[^(\*\/)]*\*\/|\/\/.*/g, '')
		try {
			data = JSON.parse(data)
		} catch (err) {
			if (feedback === false) return;
			if (data.match(/\n\r?[><]{7}/)) {
				Blockbench.showMessageBox({
					title: 'message.invalid_file.title',
					icon: 'fab.fa-git-alt',
					message: 'message.invalid_file.merge_conflict'
				})
				return;
			}
			let error_part = '';
			function logErrantPart(whole, start, length) {
				var line = whole.substr(0, start).match(/\n/gm)
				line = line ? line.length+1 : 1
				var result = '';
				var lines = whole.substr(start, length).split(/\n/gm)
				lines.forEach((s, i) => {
					result += `#${line+i} ${s}\n`
				})
				error_part = result.substr(0, result.length-1) + ' <-- HERE';
				console.log(error_part);
			}
			console.error(err)
			var length = err.toString().split('at position ')[1]
			if (length) {
				length = parseInt(length)
				var start = limitNumber(length-32, 0, Infinity)

				logErrantPart(data, start, 1+length-start)
			} else if (err.toString().includes('Unexpected end of JSON input')) {

				logErrantPart(data, data.length-16, 10)
			}
			Blockbench.showMessageBox({
				translateKey: 'invalid_file',
				icon: 'error',
				message: tl('message.invalid_file.message', [err]) + (error_part ? `\n\n\`\`\`\n${error_part}\n\`\`\`` : '')
			})
			return;
		}
	}
	return data;
}
