class Property {
    constructor(target_class, type = 'boolean', name, options = 0) {
        if (!target_class.properties) {
            target_class.properties = {};
        }
        target_class.properties[name] = this;

        this.class = target_class;
        this.name = name;
        this.type = type;

        if (options.default) {
            this.default = options.default;
        } else {
            switch (this.type) {
                case 'string': this.default = ''; break;
                case 'number': this.default = 0; break;
                case 'boolean': this.default = false; break;
                case 'array': this.default = []; break;
                case 'vector': this.default = [0, 0, 0]; break;
                case 'vector2': this.default = [0, 0]; break;
            }
        }
        switch (this.type) {
            case 'string': this.isString = true; break;
            case 'number': this.isNumber = true; break;
            case 'boolean': this.isBoolean = true; break;
            case 'array': this.isArray = true; break;
            case 'vector': this.isVector = true; break;
            case 'vector2': this.isVector2 = true; break;
        }

        if (typeof options.merge == 'function') this.merge = options.merge;
        if (typeof options.reset == 'function') this.reset = options.reset;
        if (options.condition) this.condition = options.condition;
        if (options.exposed == false) this.exposed = false;
        if (options.label) this.label = options.label;
        if (options.options) this.options = options.options;
    }
    merge(instance, data) {
        if (data[this.name] == undefined || !Condition(this.condition)) return;

        if (this.isString) {
            Merge.string(instance, data, this.name)
        }
        else if (this.isNumber) {
            Merge.number(instance, data, this.name)
        }
        else if (this.isBoolean) {
            Merge.boolean(instance, data, this.name)
        }
        else if (this.isArray || this.isVector || this.isVector2) {
            if (data[this.name] instanceof Array) {
                if (instance[this.name] instanceof Array == false) {
                    instance[this.name] = [];
                }
                instance[this.name].replace(data[this.name]);
            }
        }
    }
    copy(instance, target) {
        if (!Condition(this.condition)) return;

        if (this.isArray || this.isVector || this.isVector2) {
            if (instance[this.name] instanceof Array) {
                target[this.name] = instance[this.name].slice();
            }
        } else {
            target[this.name] = instance[this.name];
        }
    }
    reset(instance) {
        if (typeof this.default == 'function') {
            var dft = this.default(instance);
        } else {
            var dft = this.default;
        }
        if (this.isArray || this.isVector || this.isVector2) {
            if (instance[this.name] instanceof Array == false) {
                instance[this.name] = [];
            }
            instance[this.name].replace(dft);
        } else {
            instance[this.name] = dft;
        }
    }
}
