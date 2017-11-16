var asyncLoop = function(o){
    var i=-1;

    var async_loop = function(){
        i++;
        if(i==o.length){o.callback(); return;}
        o.functionToLoop(async_loop, i);
    } 
    async_loop();//init
}
function pathToName(path, extension) {
  var path_array = path.split('/').join('\\').split('\\')
  if (extension) {
    return path_array[path_array.length-1]
  } else {
    return path_array[path_array.length-1].split('.').slice(0, -1).join('.')
  }
}

function guid() {
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1);
  }
  return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
    s4() + '-' + s4() + s4() + s4();
}

Array.prototype.equals = function (array) {
    if (!array)
        return false;

    if (this.length != array.length)
        return false;

    for (var i = 0, l=this.length; i < l; i++) {
        if (this[i] instanceof Array && array[i] instanceof Array) {
            if (!this[i].equals(array[i]))
                return false;       
        }           
        else if (this[i] != array[i]) { 
            return false;   
        }           
    }       
    return true;
}
Array.prototype.remove = function (item) { {
  var index = this.indexOf(item)
  if (index > -1) {
    this.splice(index, 1)
    return index;
  }
  return false;
}
    
}
Object.defineProperty(Array.prototype, "equals", {enumerable: false});

function omitKeys(obj, keys, dual_level) {
    var dup = {};
    for (key in obj) {
        if (keys.indexOf(key) == -1) {
            if (dual_level === true && typeof obj[key] === 'object') {
              dup[key] = {}
              for (key2 in obj[key]) {
                  if (keys.indexOf(key2) == -1) {
                      dup[key][key2] = obj[key][key2];
                  }
              }
            } else {

              dup[key] = obj[key];
            }
        }
    }
    return dup;
}
function stringify (obj, options) {
  options = options || {}
  var indent = JSON.stringify([1], null, get(options, 'indent', 2)).slice(2, -3)
  var maxLength = (indent === '' ? Infinity : get(options, 'maxLength', 80))

  return (function _stringify (obj, currentIndent, reserved) {
    if (obj && typeof obj.toJSON === 'function') {
      obj = obj.toJSON()
    }

    var string = JSON.stringify(obj)

    if (string === undefined) {
      return string
    }

    var length = maxLength - currentIndent.length - reserved

    if (string.length <= length) {
      var prettified = prettify(string)
      if (prettified.length <= length) {
        return prettified
      }
    }

    if (typeof obj === 'object' && obj !== null) {
      var nextIndent = currentIndent + indent
      var items = []
      var delimiters
      var comma = function (array, index) {
        return (index === array.length - 1 ? 0 : 1)
      }

      if (Array.isArray(obj)) {
        for (var index = 0; index < obj.length; index++) {
          items.push(
            _stringify(obj[index], nextIndent, comma(obj, index)) || 'null'
          )
        }
        delimiters = '[]'
      } else {
        Object.keys(obj).forEach(function (key, index, array) {
          var keyPart = JSON.stringify(key) + ': '
          var value = _stringify(obj[key], nextIndent,
                                 keyPart.length + comma(array, index))
          if (value !== undefined) {
            items.push(keyPart + value)
          }
        })
        delimiters = '{}'
      }

      if (items.length > 0) {
        return [
          delimiters[0],
          indent + items.join(',\n' + nextIndent),
          delimiters[1]
        ].join('\n' + currentIndent)
      }
    }

    return string
  }(obj, '', 0))
}
var stringOrChar = /("(?:[^"]|\\.)*")|[:,]/g
function prettify (string) {
  return string.replace(stringOrChar, function (match, string) {
    return string ? match : match + ' '
  })
}
function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}
function trimFloatNumber(val) {
  if (val == '') return val;
  var string = val.toFixed(4)
  string = string.replace(/0+$/g, '').replace(/\.$/g, '')
  return string;
}
Array.prototype.findInArray = function(key, value) {
  if (this.length === 0) return {};
  var i = 0
  while (i < this.length) {
    if (this[i][key] === value) return this[i]
    i++;
  }
  return {};
}

function get (options, name, defaultValue) {
  return (name in options ? options[name] : defaultValue)
}
function getKeyByValue(object, value) {
  return Object.keys(object).find(key => object[key] === value);
}
function compareKeys(event, action) {
    if (action &&
      action.code === event.which &&
      action.ctrl === event.ctrlKey &&
      action.shift === event.shiftKey &&
      action.alt === event.altKey) {
        event.preventDefault()
        return true;
    } else {
        return false;
    }
}
function getAverageRGB(imgEl) {
    
    var blockSize = 5, // only visit every 5 pixels
        defaultRGB = {r:0,g:0,b:0}, // for non-supporting envs
        canvas = document.createElement('canvas'),
        context = canvas.getContext && canvas.getContext('2d'),
        data, width, height,
        i = -4,
        length,
        rgb = {r:0,g:0,b:0},
        count = 0;
        
    if (!context) {
        return defaultRGB;
    }
    
    height = canvas.height = imgEl.naturalHeight || imgEl.offsetHeight || imgEl.height;
    width = canvas.width = imgEl.naturalWidth || imgEl.offsetWidth || imgEl.width;
    
    context.drawImage(imgEl, 0, 0);
    
    try {
        data = context.getImageData(0, 0, width, height);
    } catch(e) {
        /* security error, img on diff domain */alert('x');
        return defaultRGB;
    }
    
    length = data.data.length;
    
    while ( (i += blockSize * 4) < length ) {
        ++count;
        rgb.r += data.data[i];
        rgb.g += data.data[i+1];
        rgb.b += data.data[i+2];
    }
    
    // ~~ used to floor values
    rgb.r = ~~(rgb.r/count);
    rgb.g = ~~(rgb.g/count);
    rgb.b = ~~(rgb.b/count);
    
    return rgb;  
}

function autoStringify(object) {
  if (settings.minifiedout.value === true) {
      var string = JSON.stringify(object)
  } else {
      var string = stringify(object, {indent: '\t', maxLength: parseInt(settings.max_json_length.value)})
  }
  string.replace(/-?[0-9]+\.-?[0-9]{5,16}/g, function(s) {
    var parts = s.split('.')
    if (parts[1].length > settings.round_digits.value) {
      return parts[0] + '.' + parts[1].substr(0, settings.round_digits.value)
    } else {
      return s;
    }
  })
  return string;
}

function pluralS(arr) {
  if (arr.length === 1 || arr === 1) {
    return '';
  } else {
    return 's';
  }
}

function getAxisLetter(number) {
  switch (number) {
    case 0: return 'x'; break;
    case 1: return 'y'; break;
    case 2: return 'z'; break;
  }
}
function getAxisNumber(letter) {
  switch (letter.toLowerCase()) {
    case 'x': return 0; break;
    case 'y': return 1; break;
    case 'z': return 2; break;
  }
}
function limitNumber(number, min, max) {
  if (number > max) number = max;
  if (number < min) number = min;
  return number;
}
function compareVersions(string1/*new*/, string2/*old*/) {
  // Is string1 newer than string2 ?
  var arr1 = string1.split('.')
  var arr2 = string2.split('.')
  var i = 0;
  var num1 = 0;
  var num2 = 0;
  while (i < arr1.length) {
    num1 = parseInt(arr1[i])
    num2 = parseInt(arr2[i])
    if (num1 > num2) {
      return true;
    } else if (num1 < num2) {
      return false
    }
    i++;
  }
  return false;
}
function useBedrockFlipFix(axis) {
  if (settings.entity_mode.value === false) return false;
  if (typeof axis === 'string') {
    axis = getAxisNumber(axis)
  }
  var group;
  if (selected_group) {
      var group = selected_group
  } else {
    var i = 0;
    while (i < selected.length) {
      if (typeof elements[selected[i]].display.parent === 'object' &&
        elements[selected[i]].display.parent.type === 'group'
      ) {
        var group = elements[selected[i]].display.parent
      }
      i++;
    }
  }
  if (group) {
    var rotations = group.rotation.slice()
    rotations.splice(axis, 1)
    rotations.forEach(function(r, i) {
      rotations[i] = (r >= -90 && r <= 90)
    })
    return rotations[0] !== rotations[1]
  } else {
    return false
  }
}