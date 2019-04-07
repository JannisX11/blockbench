function tl(string, variables) {
	//return Math.random() > 0.5 ? '\u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u0639\u0631\u0636' : '\u062A\u0643\u0631\u0627\u0631'
	var result = Language.data[string]
	if (result && result.length > 0) {
		if (variables && variables.length) {
			var i = variables.length;
			while (i > 0) {
				i--;
				result = result.replace(new RegExp('%'+i, 'g'), variables[i])
			}
		}
		return result;
	} else {
		return string;
	}
}
function translateUI() {
	$('.tl').each(function(i, obj) {
		var text = tl($(obj).text())
		$(obj).text(text)
	})
}
const Language = {
	data: {},
	code: 'en',
	options: {
		en: 'English',
		de: 'Deutsch (German)',
		es: 'Espa\u00F1ol (Spanish)',
		fr: 'Fran\u00E7ais (French)',
		//it: 'Italiano (Italian)',
		ja: '\u65E5\u672C\u8A9E (Japanese)',//日本語
		nl: 'Nederlands (Dutch)',
		pl: 'Polski (Polish)',
		pt: 'Portugu\u00EAs (Portuguese)',
		ru: '\u0440\u0443\u0441\u0441\u043A\u0438\u0439 (Russian)',
		sv: 'Svenska (Swedish)',
		zh: '\u4e2d\u6587 (Chinese)',//中文
	},
	toString: () => Language.code
}
function getStringWidth(string, size) {
	var a = $('<label style="position: absolute">'+string+'</label>')
	if (size && size !== 18) {
		a.css('font-size', size+'pt')
	}
	$('body').append(a.css('visibility', 'hidden'))
	var width = a.width()
	a.detach()
	return width;
}
function loadLanguage() {
	var code;
	try {
		code = JSON.parse(localStorage.getItem('settings')).language.value
	} catch (err) {}

	if (!code) {
		code = navigator.language.replace(/-\w+/, '')
	}
	if (code && Language.options[code]) {
		Language.code = code
	}
	$.ajax({
		dataType: "json",
		url: 'lang/'+Language+'.json',
		//data: data,
		//async: false, 
		success: function(data) {
			Language.data = data
			translateUI()
		}
	});
	/*
	$.getJSON('lang/'+Language.code+'.json', function(data) {
		Language.data = data
		translateUI()
	})
	*/
}
loadLanguage()