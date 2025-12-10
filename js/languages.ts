import cz from '../lang/cz.json';
import de from '../lang/de.json';
import en from '../lang/en.json';
import es from '../lang/es.json';
import fr from '../lang/fr.json';
import it from '../lang/it.json';
import ja from '../lang/ja.json';
import ko from '../lang/ko.json';
import nl from '../lang/nl.json';
import pl from '../lang/pl.json';
import pt from '../lang/pt.json';
import pt_br from '../lang/pt_br.json';
import ru from '../lang/ru.json';
import sv from '../lang/sv.json';
import tr from '../lang/tr.json';
import uk from '../lang/uk.json';
import vi from '../lang/vi.json';
import zh from '../lang/zh.json';
import zh_tw from '../lang/zh_tw.json';

type Language = Record<string, string>;
export const data: Record<string, Language> = {
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
	pt_br: pt_br,
	ru: ru,
	sv: sv,
	tr: tr,
	uk: uk,
	vi: vi,
	zh: zh,
	zh_tw: zh_tw,
};

/**
 * Returns a translated string in the current language
 * @param key Translation key
 * @param variables Array of variables that replace anchors (%0, etc.) in the translation. Items can be strings or anything that can be converted to strings
 * @param default_value String value to default to if the translation is not available
 */
export const tl = function(string: string, variables?: string | number | (string|number)[], default_value?: string): string {
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
	} else if (default_value != undefined) {
		return default_value;
	} else {
		//console.warn('Unable to find translation for key', string);
		return string;
	}
}
export const translateUI = function() {
	$('.tl').each(function(i, obj) {
		var text = tl($(obj).text())
		$(obj).text(text)
	})
}

export const Language = {
	/**
	 * Translation data for the current language
	 */
	data: {},
	/**
	 * Language code indicating the currently selected language
	 */
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
		pt_br: 'Português (Brasil) (Portuguese, Brazil)',
		ru: '\u0440\u0443\u0441\u0441\u043A\u0438\u0439 (Russian)',
		sv: 'Svenska (Swedish)',
		tr: 'Türkçe (Turkish)',
		uk: 'Українська (Ukrainian)',
		vi: 'Tiếng việt (Vietnamese)',
		zh: '\u4e2d\u6587 (Chinese)',//中文
		zh_tw: '\u4E2D\u6587(\u81FA\u7063) (Traditional Chinese)',//中文(臺灣)
	},
	/**
	 * Add translations for custom translation strings
	 * @param language Two letter language code, e. G. 'en'
	 * @param strings Object listing the translation keys and values
	 */
	addTranslations(language: string, strings: Record<string, string>): void {
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
	document.body.parentElement.setAttribute('lang', Language.code);
}


Language.data = data[Language.code];

Object.assign(window, {
	tl,
	Language
})
