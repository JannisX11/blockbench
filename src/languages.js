
import cz from './../lang/cz.json';
import de from './../lang/de.json';
import en from './../lang/en.json';
import es from './../lang/es.json';
import fr from './../lang/fr.json';
import it from './../lang/it.json';
import ja from './../lang/ja.json';
import ko from './../lang/ko.json';
import nl from './../lang/nl.json';
import pl from './../lang/pl.json';
import pt from './../lang/pt.json';
import ru from './../lang/ru.json';
import sv from './../lang/sv.json';
import zh from './../lang/zh.json';
import zh_tw from './../lang/zh_tw.json';

const data = {
	cz: cz,
	de: de,
	en: en,
	es: es,
	fr: fr,
	it: it,
	ja: ja,
	ko: ko,
	nl: nl,
	pl: pl,
	pt: pt,
	ru: ru,
	sv: sv,
	zh: zh,
	zh_tw: zh_tw,
};

window.tl = function(string, variables) {
	if (string && string.length > 100) return string;
	var result = Language.data[string]
	if (result && result.length > 0) {
		if (variables) {
			if (variables instanceof Array == false) {
				variables = [variables];
			}
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
window.translateUI = function() {
	$('.tl').each(function(i, obj) {
		var text = tl($(obj).text())
		$(obj).text(text)
	})
}

window.Language = {
	data: {},
	code: 'en',
	options: {
		en: 'English',
		cz: 'Čeština (Czech)',
		de: 'Deutsch (German)',
		es: 'Espa\u00F1ol (Spanish)',
		fr: 'Fran\u00E7ais (French)',
		it: 'Italiano (Italian)',
		ja: '\u65E5\u672C\u8A9E (Japanese)',//日本語
		ko: '\uD55C\uAD6D\uC5B4 (Korean)',//日本語
		nl: 'Nederlands (Dutch)',
		pl: 'Polski (Polish)',
		pt: 'Portugu\u00EAs (Portuguese)',
		ru: '\u0440\u0443\u0441\u0441\u043A\u0438\u0439 (Russian)',
		sv: 'Svenska (Swedish)',
		zh: '\u4e2d\u6587 (Chinese)',//中文
		zh_tw: '\u4E2D\u6587(\u81FA\u7063) (Traditional Chinese)',//中文(臺灣)
	},
	addTranslations(language, strings) {
		for (var key in strings) {
			if (language == Language.code || (language == 'en' && Language.data[key] == undefined)) {
				Language.data[key] = strings[key];
			}
		}
	},
	toString: () => Language.code
}


// Get language code
let code;
try {
	code = JSON.parse(localStorage.getItem('settings')).language.value
} catch (err) {}

if (!code) {
	code = navigator.language.replace(/-\w+/, '')
}
if (code && Language.options[code]) {
	Language.code = code
	document.body.parentNode.attributes.lang.value = Language.code;
}


Language.data = data[Language.code];
