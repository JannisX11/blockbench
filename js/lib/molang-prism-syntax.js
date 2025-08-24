Prism.languages.molang = {
	'string': /("|')(?:\\(?:\r\n|[\s\S])|(?!\1)[^\\\r\n])*\1/,
    'function-name': /\b(?!\d)math\.\w+(?=[\t ]*\()/i,
    'selector': /\b(?!\d)((query|variable|temp|context|math|q|v|t|c)\.\w+(\.\w+)*)|this/i,
    'boolean': /\b(?:true|false)\b/i,
	'number': /(?:\b\d+(?:\.\d+f?)?(?:[ed][+-]\d+)?|&h[a-f\d]+)\b/i,
	'operator': /&&|\|\||[-+*/!<>]=?|[:?=]/i,
	'keyword': /\b(return|loop|for_each|break|continue)\b/i,
	'punctuation': /[.,;()[\]{}]/,
};
