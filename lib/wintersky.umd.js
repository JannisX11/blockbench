(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory(require('three'), require('molangjs'), require('tinycolor2')) :
	typeof define === 'function' && define.amd ? define(['three', 'molangjs', 'tinycolor2'], factory) :
	(global = typeof globalThis !== 'undefined' ? globalThis : global || self, global.Wintersky = factory(global.THREE, global.Molang, global.tinycolor));
}(this, (function (THREE$1, Molang, tinycolor) { 'use strict';

	function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

	var THREE__default = /*#__PURE__*/_interopDefaultLegacy(THREE$1);
	var Molang__default = /*#__PURE__*/_interopDefaultLegacy(Molang);
	var tinycolor__default = /*#__PURE__*/_interopDefaultLegacy(tinycolor);

	const Wintersky = {
		emitters: [],
		space: new THREE__default['default'].Object3D(),
		updateFacingRotation(camera) {
			Wintersky.emitters.forEach(emitter => {
				emitter.updateFacingRotation(camera);
			});
		},
		global_options: {
			max_emitter_particles: 30000,
			tick_rate: 30,
			loop_mode: 'auto', // looping, once
			parent_mode: 'world', // entity, locator
			get scale() {
				return Wintersky.global_options._scale;
			},
			set scale(val) {
				Wintersky.global_options._scale = val;
				Wintersky.emitters.forEach(emitter => {
					emitter.local_space.scale.set(val, val, val);
					emitter.global_space.scale.set(val, val, val);
				});
				//Wintersky.space.scale.set(val, val, val);
			},
			_scale: 1
		}
	};

	const img = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH4QcKDTg2HKzkwgAAAFBJREFUOMtjvHDhwn8GCgALAwMDg4iICFma37x5w8DEQCEg2gBpaWkGaWlp8g2g2AVDyABcgTUwXiDGNQMfiCzoAk+fPiXIpr4L3rx5Q7YBAOhLE0zw8k9cAAAAAElFTkSuQmCC";

	const img$1 = "data:image/png;base64,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";

	const img$2 = "data:image/png;base64,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";

	const img$3 = "data:image/png;base64,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";

	const img$4 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAADACAYAAAANzeNOAAAClklEQVRo3u2Z624UMQyF91URgoqi3ujSG70tqgCB4JWDXOlUpx47dmbUVav1j6NMMj6fnZ0ks9uuWmurJVoVIAZcnx23WQAxRmYXALPWYsDnj+9aCiCBIpjQpgEMYaWnoE2eOayglnIBFgHuLr801hBAmyPQs87hp/etB7AgLsCDyXh3ChLAYhjGwg8xazYBvI11NXUe7B5g823doGEAmyOQaZR3YRYyMR/tf3AhGDMBYoS87IC4UxCzBKC1siOJC+hVgjEXwBAvM5vdx8iBuqqhlRiZaze++Ha+PmuiWQCYtRYDLNCwuQvImDVk8jVfbp4c7LlGxJgAMUIIRMtgaUMAmwEUsdkEMAgGQKDuU+BAS6l1wMGesbbztgDyPni4u3hSGsAmiGFdgGXWkNkAazpDZmsaT+b10X7KjDgTwBmsa5ilNQEcoCG4D5kAngoqEmmzCeAqPHEi9zHqYC9zuJS9jHUebBPwc3PVtIZ/cLAZ/RBgZe5VMmxOA/QUMHZ+cvAMMjGzUYJ1H+0EgGAE4dqTOQXc0MEa1n0KvYza3F0HvbJrN74pwO/vNw1KA2DAWymCuBk9uYDIyNXMAoguTg8fZQLkBmdCX1oZg9kF4CDVZgh/+ugCEKCNXnZ3HSBQt7WZCjAL8OfhtkFDADHgQIkg3awA4frq63FLAXTmXhUTgGTh7LqfAmgBlJoCIBo2ex1EZ0LthQK8PODvj/sGDQHEIBuIATfnp7mlzCYNSm1nyaSzowKrCnMKCGal/kkDM1fC/VqJBdhFwO3luv37tXnU8DcUNuN6GCCSzICkv+JoCDRUQXQG1EIqwK4AsAewiYbPAz4TeuYUoHcWhJ9BZK51UIACbAuAA2X47WxBFlVQj/G1A/4D2cRpqoNd7bwAAAAASUVORK5CYII=";

	function parseColor(input) {
		return new tinycolor__default['default'](input).toHexString();
	}

	class Config {
		constructor(config, options = 0) {
			this.texture = new THREE.Texture(new Image());
			this.reset();

			if (config && config.particle_effect) {
				this.setFromJSON(config);
			} else if (typeof config == 'object') {
				Object.assign(this, config);
			}
			if (options.path) this.set('file_path', options.path);
		}
		reset() {
			this.texture.image.src = img;
			this.texture.magFilter = THREE.NearestFilter;
			this.texture.minFilter = THREE.NearestFilter;

			this.identifier = '';
			this.file_path = '';
			this.curves = {};
			this.space_local_position = false;
			this.space_local_rotation = false;
			this.variables_creation_vars = [];
			this.variables_tick_vars = [];

			this.emitter_rate_mode = 'steady';
			this.emitter_rate_rate = '';
			this.emitter_rate_amount = '';
			this.emitter_rate_maximum = '';
			this.emitter_lifetime_mode = 'once';
			this.emitter_lifetime_active_time = '';
			this.emitter_lifetime_sleep_time = '';
			this.emitter_lifetime_activation = '';
			this.emitter_lifetime_expiration = '';
			this.emitter_shape_mode = 'point';
			this.emitter_shape_offset = [0, 0, 0];
			this.emitter_shape_radius = '';
			this.emitter_shape_half_dimensions = [0, 0, 0];
			this.emitter_shape_plane_normal = [0, 0, 0];
			this.emitter_shape_surface_only = false;
			this.particle_appearance_size = [0, 0];
			this.particle_appearance_facing_camera_mode = 'rotate_xyz';
			this.particle_appearance_material = 'particles_alpha';
			this.particle_direction_mode = 'outwards';
			this.particle_direction_direction = [0, 0, 0];
			this.particle_motion_mode = 'dynamic';
			this.particle_motion_linear_speed = '';
			this.particle_motion_linear_acceleration = [0, 0, 0];
			this.particle_motion_linear_drag_coefficient = '';
			this.particle_motion_relative_position = [];
			this.particle_motion_direction = [];
			this.particle_rotation_mode = 'dynamic';
			this.particle_rotation_initial_rotation = '';
			this.particle_rotation_rotation_rate = '';
			this.particle_rotation_rotation_acceleration = '';
			this.particle_rotation_rotation_drag_coefficient = '';
			this.particle_rotation_rotation = '';
			this.particle_lifetime_mode = 'time';
			this.particle_lifetime_max_lifetime = '';
			this.particle_lifetime_kill_plane = [0, 0, 0, 0];
			this.particle_lifetime_expiration_expression = '';
			this.particle_lifetime_expire_in = [];
			this.particle_lifetime_expire_outside = [];
			this.particle_texture_width = 0;
			this.particle_texture_height = 0;
			this.particle_texture_path = '';
			this.particle_texture_image = '';
			this.particle_texture_mode = 'static';
			this.particle_texture_uv = [0, 0];
			this.particle_texture_uv_size = [0, 0];
			this.particle_texture_uv_step = [0, 0];
			this.particle_texture_frames_per_second = 0;
			this.particle_texture_max_frame = '';
			this.particle_texture_stretch_to_lifetime = false;
			this.particle_texture_loop = false;
			this.particle_color_mode = 'static';
			this.particle_color_static = '#ffffff';
			this.particle_color_interpolant = '';
			this.particle_color_range = 0;
			this.particle_color_gradient = [];
			this.particle_color_expression = [];
			this.particle_color_light = false;
			this.particle_collision_enabled = false;
			this.particle_collision_collision_drag = 0;
			this.particle_collision_coefficient_of_restitution = 0;
			this.particle_collision_collision_radius = 0;
			this.particle_collision_expire_on_contact = false;

			return this;
		}
		set(key, val) {
			if (this[key] == undefined || val == undefined || val == null) return;

			if (this[key] instanceof Array) {
				this[key].splice(0, Infinity, ...val);
			} else if (typeof this[key] == 'string') {
				this[key] = val.toString();
			} else if (typeof this[key] == 'number' && typeof val == 'number') {
				this[key] = val;
			} else if (typeof this[key] == 'boolean') {
				this[key] = !!val;
			}
			return this;
		}
		setFromJSON(data) {

			var comps = data.particle_effect.components;
			var curves = data.particle_effect.curves;
			var desc = data.particle_effect.description;
			if (desc && desc.identifier) {
				this.identifier = desc.identifier;
			}
			if (desc && desc.basic_render_parameters) {
				this.set('particle_texture_path', desc.basic_render_parameters.texture);

				this.set('particle_appearance_material', desc.basic_render_parameters.material);
			}
			if (curves) {
				for (var key in curves) {
					var json_curve = curves[key];
					var new_curve = {
						id: key,
						mode: json_curve.type,
						input: json_curve.input,
						range: json_curve.horizontal_range,
						nodes: []
					};
					if (json_curve.nodes && json_curve.nodes.length) {
						json_curve.nodes.forEach(value => {
							value = parseFloat(value)||0;
							new_curve.nodes.push(value);
						});
					}
					this.curves[key] = new_curve;
				}
			}

			if (comps) {
				function comp(id) {
					return comps[`minecraft:${id}`]
				}
				if (comp('emitter_initialization')) {
					var cr_v = comp('emitter_initialization').creation_expression;
					var up_v = comp('emitter_initialization').per_update_expression;
					if (typeof cr_v == 'string') {
						this.variables_creation_vars = cr_v.replace(/;+$/, '').split(';');
					}
					if (typeof up_v == 'string') {
						this.variables_tick_vars = up_v.replace(/;+$/, '').split(';');
					}
				}
				if (comp('emitter_local_space')) {
					this.space_local_position = comp('emitter_local_space').position;
					this.space_local_rotation = comp('emitter_local_space').rotation;
				}
				if (comp('emitter_rate_steady')) {
					this.set('emitter_rate_mode',  'steady');
					this.set('emitter_rate_rate',  comp('emitter_rate_steady').spawn_rate);
					this.set('emitter_rate_maximum',  comp('emitter_rate_steady').max_particles);
				}
				if (comp('emitter_rate_instant')) {
					this.set('emitter_rate_mode',  'instant');
					this.set('emitter_rate_amount',  comp('emitter_rate_instant').num_particles);
				}
				if (comp('emitter_lifetime_once')) {
					this.set('emitter_lifetime_mode',  'once');
					this.set('emitter_lifetime_active_time',  comp('emitter_lifetime_once').active_time);
				}
				if (comp('emitter_lifetime_looping')) {
					this.set('emitter_lifetime_mode',  'looping');
					this.set('emitter_lifetime_active_time',  comp('emitter_lifetime_looping').active_time);
					this.set('emitter_lifetime_sleep_time',  comp('emitter_lifetime_looping').sleep_time);
				}
				if (comp('emitter_lifetime_expression')) {
					this.set('emitter_lifetime_mode',  'expression');
					this.set('emitter_lifetime_activation',  comp('emitter_lifetime_expression').activation_expression);
					this.set('emitter_lifetime_expiration',  comp('emitter_lifetime_expression').expiration_expression);
				}
				var shape_component = comp('emitter_shape_point') || comp('emitter_shape_custom');
				if (shape_component) {
					this.set('emitter_shape_mode',  'point');
					this.set('emitter_shape_offset',  shape_component.offset);
				}
				if (comp('emitter_shape_sphere')) {
					shape_component = comp('emitter_shape_sphere');
					this.set('emitter_shape_mode',  'sphere');
					this.set('emitter_shape_offset',  shape_component.offset);
					this.set('emitter_shape_radius',  shape_component.radius);
					this.set('emitter_shape_surface_only',  shape_component.surface_only);
				}
				if (comp('emitter_shape_box')) {
					shape_component = comp('emitter_shape_box');
					this.set('emitter_shape_mode',  'box');
					this.set('emitter_shape_offset',  shape_component.offset);
					this.set('emitter_shape_half_dimensions',  shape_component.half_dimensions);
					this.set('emitter_shape_surface_only',  shape_component.surface_only);
				}
				if (comp('emitter_shape_disc')) {
					shape_component = comp('emitter_shape_disc');
					this.set('emitter_shape_mode',  'disc');
					this.set('emitter_shape_offset',  shape_component.offset);
					switch (shape_component.plane_normal) {
						case 'x': this.set('emitter_shape_plane_normal',  [1, 0, 0]); break;
						case 'y': this.set('emitter_shape_plane_normal',  [0, 1, 0]); break;
						case 'z': this.set('emitter_shape_plane_normal',  [0, 0, 1]); break;
						default:  this.set('emitter_shape_plane_normal',  shape_component.plane_normal); break;
					}
					this.set('emitter_shape_radius',  shape_component.radius);
					this.set('emitter_shape_surface_only',  shape_component.surface_only);
				}
				if (comp('emitter_shape_entity_aabb')) {
					this.set('emitter_shape_mode',  'entity_aabb');
					this.set('emitter_shape_surface_only',  comp('emitter_shape_entity_aabb').surface_only);
					shape_component = comp('emitter_shape_entity_aabb');
				}
				if (shape_component && shape_component.direction) {
					if (shape_component.direction == 'inwards' || shape_component.direction == 'outwards') {
						this.set('particle_direction_mode', shape_component.direction);
					} else {
						this.set('particle_direction_mode', 'direction');
						this.set('particle_direction_direction', shape_component.direction);
					}
				}

				if (comp('particle_initial_spin')) {
					this.set('particle_rotation_initial_rotation', comp('particle_initial_spin').rotation);
					this.set('particle_rotation_rotation_rate', comp('particle_initial_spin').rotation_rate);
				}
				if (comp('particle_kill_plane')) {
					this.set('particle_lifetime_kill_plane', comp('particle_kill_plane'));
				}

				if (comp('particle_motion_dynamic')) {
					this.set('particle_motion_mode', 'dynamic');
					this.set('particle_motion_linear_acceleration', comp('particle_motion_dynamic').linear_acceleration);
					this.set('particle_motion_linear_drag_coefficient', comp('particle_motion_dynamic').linear_drag_coefficient);
					this.set('particle_rotation_rotation_acceleration', comp('particle_motion_dynamic').rotation_acceleration);
					this.set('particle_rotation_rotation_drag_coefficient', comp('particle_motion_dynamic').rotation_drag_coefficient);
					this.set('particle_motion_linear_speed', 1);
				}
				if (comp('particle_motion_parametric')) {
					this.set('particle_motion_mode', 'parametric');
					this.set('particle_motion_relative_position', comp('particle_motion_parametric').relative_position);
					this.set('particle_motion_direction', comp('particle_motion_parametric').direction);
					this.set('particle_rotation_rotation', comp('particle_motion_parametric').rotation);
				}
				if (comp('particle_motion_collision')) {
					this.set('particle_collision_enabled', comp('particle_motion_collision').enabled || true);
					this.set('particle_collision_collision_drag', comp('particle_motion_collision').collision_drag);
					this.set('particle_collision_coefficient_of_restitution', comp('particle_motion_collision').coefficient_of_restitution);
					this.set('particle_collision_collision_radius', comp('particle_motion_collision').collision_radius);
					this.set('particle_collision_expire_on_contact', comp('particle_motion_collision').expire_on_contact);
				}
				if (comp('particle_initial_speed') !== undefined) {
					var c = comp('particle_initial_speed');
					if (typeof c !== 'object') {
						this.set('particle_motion_linear_speed', c);
					} else {
						this.set('particle_direction_mode', 'direction');
						this.set('particle_direction_direction', comp('particle_initial_speed'));
						this.set('particle_motion_linear_speed', 1);
					}
				}

				if (comp('particle_lifetime_expression')) {
					this.set('particle_lifetime_mode', 'expression');
					if (comp('particle_lifetime_expression').expiration_expression) {
						this.set('particle_lifetime_mode', 'expression');
						this.set('particle_lifetime_expiration_expression', comp('particle_lifetime_expression').expiration_expression);
					} else {
						this.set('particle_lifetime_mode', 'time');
						this.set('particle_lifetime_max_lifetime', comp('particle_lifetime_expression').max_lifetime);
					}
				}
				if (comp('particle_expire_if_in_blocks') instanceof Array) {
					this.set('particle_lifetime_expire_in', comp('particle_expire_if_in_blocks'));
				}
				if (comp('particle_expire_if_not_in_blocks') instanceof Array) {
					this.set('particle_lifetime_expire_outside', comp('particle_expire_if_not_in_blocks'));
				}
				
				if (comp('particle_appearance_billboard')) {
					this.set('particle_appearance_size', comp('particle_appearance_billboard').size);
					this.set('particle_appearance_facing_camera_mode', comp('particle_appearance_billboard').facing_camera_mode);
					var uv_tag = comp('particle_appearance_billboard').uv;
					if (uv_tag) {
						if (uv_tag.texture_width) this.set('particle_texture_width', uv_tag.texture_width);
						if (uv_tag.texture_height) this.set('particle_texture_height', uv_tag.texture_height);
						if (uv_tag.flipbook) {
							this.set('particle_texture_mode', 'animated');
							this.set('particle_texture_uv', uv_tag.flipbook.base_UV);
							this.set('particle_texture_uv_size', uv_tag.flipbook.size_UV);
							this.set('particle_texture_uv_step', uv_tag.flipbook.step_UV);
							this.set('particle_texture_frames_per_second', uv_tag.flipbook.frames_per_second);
							this.set('particle_texture_max_frame', uv_tag.flipbook.max_frame);
							this.set('particle_texture_stretch_to_lifetime', uv_tag.flipbook.stretch_to_lifetime);
							this.set('particle_texture_loop', uv_tag.flipbook.loop);
						} else {
							this.set('particle_texture_mode', 'static');
							this.set('particle_texture_uv', uv_tag.uv);
							this.set('particle_texture_uv_size', uv_tag.uv_size);
						}
					}
				}
				if (comp('particle_appearance_lighting')) {
					this.set('particle_color_light', true);
				}
				if (comp('particle_appearance_tinting')) {
					var c = comp('particle_appearance_tinting').color;

					if (c instanceof Array && c.length >= 3) {
						if ((typeof c[0] + typeof c[1] + typeof c[1]).includes('string')) {
							this.set('particle_color_mode', 'expression');
							this.set('particle_color_expression', c);

						} else {
							this.set('particle_color_mode', 'static');
							
							var color = new tinycolor__default['default']({
								r: c[0] * 255,
								g: c[1] * 255,
								b: c[2] * 255,
							}).toHexString();
							this.set('particle_color_static', color);
						}
					} else if (typeof c == 'object') {
						// Gradient
						this.set('particle_color_mode', 'gradient');
						this.set('particle_color_interpolant', c.interpolant);
						let gradient_points = [];
						if (c.gradient instanceof Array) {
							let distance = 100 / (c.gradient.length-1);
							c.gradient.forEach((color, i) => {
								color = parseColor(color);
								var percent = distance * i;
								gradient_points.push({percent, color});
							});
						} else if (typeof c.gradient == 'object') {
							let max_time = 0;
							for (var time in c.gradient) {
								max_time = Math.max(parseFloat(time), max_time);
							}
							this.particle_color_range = max_time;
							for (var time in c.gradient) {
								var color = parseColor(c.gradient[time]);
								var percent = (parseFloat(time) / max_time) * 100;
								gradient_points.push({color, percent});
							}
						}
						this.set('particle_color_gradient', gradient_points);
					}
				}
			}

			this.updateTexture();
			return this;
		}
		updateTexture() {
			var url;
			var path = this.particle_texture_path;

			switch (path) {
				case 'textures/particle/particles':
					url = img$1;
					break;
				case 'textures/flame_atlas': case 'textures/particle/flame_atlas':
					url = img$2;
					break;
				case 'textures/particle/soul':
					url = img$3;
					break;
				case 'textures/particle/campfire_smoke':
					url = img$4;
					break;
				default:
					url = img;
					break;
			}
			if (url == img && typeof Wintersky.fetchTexture == 'function') {
				let result = Wintersky.fetchTexture(this);
				if (result) url = result;
			}
			this.texture.image.src = url;
			this.texture.image.onload = () => {
				this.texture.needsUpdate = true;
			};
			return this;
		}
	}
	Wintersky.Config = Config;

	const MathUtil = {
		roundTo(num, digits) {
			var d = Math.pow(10,digits);
			return Math.round(num * d) / d
		},
		randomab(a, b) {
			return a + Math.random() * (b-a)
		},
		radToDeg(rad) {
			return rad / Math.PI * 180
		},
		degToRad(deg) {
			return Math.PI / (180 /deg)
		},
		clamp(number, min, max) {
			if (number > max) number = max;
			if (number < min || isNaN(number)) number = min;
			return number;
		},
		roundTo(num, digits) {
			var d = Math.pow(10,digits);
			return Math.round(num * d) / d
		},
		getRandomEuler() {
			return new THREE__default['default'].Euler(
				MathUtil.randomab(-Math.PI, Math.PI),
				MathUtil.randomab(-Math.PI, Math.PI),
				MathUtil.randomab(-Math.PI, Math.PI)
			)
		}
	};

	const Normals = {
		x: new THREE__default['default'].Vector3(1, 0, 0),
		y: new THREE__default['default'].Vector3(0, 1, 0),
		z: new THREE__default['default'].Vector3(0, 0, 1),
		n: new THREE__default['default'].Vector3(0, 0, 0),
	};

	function removeFromArray(array, item) {
		let index = array.indexOf(item);
		if (index >= 0) {
			array.splice(index, 1);
		}
	}

	function calculateGradient(gradient, percent) {
		let index = 0;
		gradient.forEach((point, i) => {
			if (point.percent <= percent) index = i;
		});
		if (gradient[index] && !gradient[index+1]) {
			var color = gradient[index].color;

		} else if (!gradient[index] && gradient[index+1]) {
			var color = gradient[index+1].color;

		} else if (gradient[index] && gradient[index+1]) {
			// Interpolate
			var mix = (percent - gradient[index].percent) / (gradient[index+1].percent - gradient[index].percent);
			var color = tinycolor__default['default'].mix(gradient[index].color, gradient[index+1].color, mix*100).toHexString();

		} else {
			var color = '#ffffff';
		}
		return new THREE__default['default'].Color(color);
	}


	class Particle {
		constructor(emitter, data) {
			this.emitter = emitter;
			if (!data) data = 0;

			this.geometry = new THREE__default['default'].PlaneGeometry(1, 1);
			this.material = this.emitter.material.clone();
			this.mesh = new THREE__default['default'].Mesh(this.geometry, this.material);
			this.position = this.mesh.position;

			this.speed = data.speed||new THREE__default['default'].Vector3();
			this.acceleration = data.acceleration||new THREE__default['default'].Vector3();

			this.add();
		}
		params() {
			var obj = this.emitter.params();
			obj["variable.particle_lifetime"] = this.lifetime;
			obj["variable.particle_age"] = this.age;
			obj["variable.particle_random_1"] = this.random_vars[0];
			obj["variable.particle_random_2"] = this.random_vars[1];
			obj["variable.particle_random_3"] = this.random_vars[2];
			obj["variable.particle_random_4"] = this.random_vars[3];
			return obj;
		}
		add() {
			if (!this.emitter.particles.includes(this)) {
				this.emitter.particles.push(this);
				if (this.emitter.config.space_local_position && this.emitter.local_space.parent) {
					// Add the particle to the local space object if local space is enabled and used
					this.emitter.local_space.add(this.mesh);
				} else {
					// Otherwise add to global space
					this.emitter.global_space.add(this.mesh);
				}
			}

			this.age = this.loop_time = 0;
			this.current_frame = 0;
			this.random_vars = [Math.random(), Math.random(), Math.random(), Math.random()];
			this.material.copy(this.emitter.material);
			this.material.needsUpdate = true;
			var params = this.params();

			this.position.set(0, 0, 0);
			this.lifetime = this.emitter.calculate(this.emitter.config.particle_lifetime_max_lifetime, params);
			this.initial_rotation = this.emitter.calculate(this.emitter.config.particle_rotation_initial_rotation, params);
			this.rotation_rate = this.emitter.calculate(this.emitter.config.particle_rotation_rotation_rate, params);
			this.rotation = 0;

			//Init Position:
			var surface = this.emitter.config.emitter_shape_surface_only;
			if (this.emitter.config.emitter_shape_mode === 'box') {
				var size = this.emitter.calculate(this.emitter.config.emitter_shape_half_dimensions, params);

				this.position.x = MathUtil.randomab(-size.x, size.x);
				this.position.y = MathUtil.randomab(-size.y, size.y);
				this.position.z = MathUtil.randomab(-size.z, size.z);

				if (surface) {
					var face = Math.floor(MathUtil.randomab(0, 3));
					var side = Math.floor(MathUtil.randomab(0, 2));
					this.position.setComponent(face, size.getComponent(face) * (side?1:-1));
				}
			} else if (this.emitter.config.emitter_shape_mode === 'entity_aabb') {
				var size = new THREE__default['default'].Vector3(0.5, 1, 0.5);

				this.position.x = MathUtil.randomab(-size.x, size.x);
				this.position.y = MathUtil.randomab(-size.y, size.y);
				this.position.z = MathUtil.randomab(-size.z, size.z);

				if (surface) {
					var face = Math.floor(MathUtil.randomab(0, 3));
					var side = Math.floor(MathUtil.randomab(0, 2));
					this.position.setComponent(face, size.getComponent(face) * (side?1:-1));
				}
			} else if (this.emitter.config.emitter_shape_mode === 'sphere') {

				var radius = this.emitter.calculate(this.emitter.config.emitter_shape_radius, params);
				if (surface) {
					this.position.x = radius;
				} else {
					this.position.x = radius * Math.random();
				}
				this.position.applyEuler(MathUtil.getRandomEuler());
			} else if (this.emitter.config.emitter_shape_mode === 'disc') {
				var radius = this.emitter.calculate(this.emitter.config.emitter_shape_radius, params);
				var ang = Math.random()*Math.PI*2;
				var dis = surface ? radius : radius * Math.sqrt(Math.random());

				this.position.x = dis * Math.cos(ang);
				this.position.z = dis * Math.sin(ang);

				var normal = this.emitter.calculate(this.emitter.config.emitter_shape_plane_normal, params);
				if (!normal.equals(Normals.n)) {
					var q = new THREE__default['default'].Quaternion().setFromUnitVectors(Normals.y, normal);
					this.position.applyQuaternion(q);
				}
			}
			//Speed
			this.speed = new THREE__default['default'].Vector3();
			var dir = this.emitter.config.particle_direction_mode;
			if (dir == 'inwards' || dir == 'outwards') {

				if (this.emitter.config.emitter_shape_mode === 'point') {
					this.speed.set(1, 0, 0).applyEuler(MathUtil.getRandomEuler());
				} else {
					this.speed.copy(this.position).normalize();
					if (dir == 'inwards') {
						this.speed.negate();
					}
				}
			} else {
				this.speed = this.emitter.calculate(this.emitter.config.particle_direction_direction, params).normalize();
			}
			var speed = this.emitter.calculate(this.emitter.config.particle_motion_linear_speed, params);
			this.speed.x *= speed;
			this.speed.y *= speed;
			this.speed.z *= speed;

			this.position.add(this.emitter.calculate(this.emitter.config.emitter_shape_offset, params));

			if (this.emitter.parent_mode == 'locator') {
				this.position.x *= -1;
				this.position.y *= -1;
				this.speed.x *= -1;
				this.speed.y *= -1;
			} else if (this.emitter.config.space_local_position && !this.emitter.config.space_local_rotation) {
				this.speed.x *= -1;
				this.speed.z *= -1;
			}

			if (this.emitter.local_space.parent) {

				if (!this.emitter.config.space_local_rotation) {
					this.position.applyQuaternion(this.emitter.local_space.getWorldQuaternion(new THREE__default['default'].Quaternion()));
				}
				if (!this.emitter.config.space_local_position) {
					let offset = this.emitter.local_space.getWorldPosition(new THREE__default['default'].Vector3());
					this.position.addScaledVector(offset, 1/Wintersky.global_options._scale);
				}
			}

			//UV
			this.setFrame(0);

			return this.tick();
		}
		tick(jump) {
			var params = this.params();
			let {tick_rate} = Wintersky.global_options;

			//Lifetime
			this.age += 1/tick_rate;
			this.loop_time += 1/tick_rate;
			if (this.emitter.config.particle_lifetime_mode === 'time') {
				if (this.age > this.lifetime) {
					this.remove();
				}
			} else {
				if (this.emitter.calculate(this.emitter.config.particle_lifetime_expiration_expression, params)) {
					this.remove();
				}
			}
			//Movement
			if (this.emitter.config.particle_motion_mode === 'dynamic') {
				//Position
				var drag = this.emitter.calculate(this.emitter.config.particle_motion_linear_drag_coefficient, params);
				this.acceleration = this.emitter.calculate(this.emitter.config.particle_motion_linear_acceleration, params);
				if (this.emitter.config.space_local_position) {
					if (this.emitter.parent_mode == 'locator') {
						this.acceleration.x *= -1;
						this.acceleration.y *= -1;
					}
				} else if (this.emitter.parent_mode != 'world') {
					this.acceleration.x *= -1;
					this.acceleration.z *= -1;
				}
				this.acceleration.addScaledVector(this.speed, -drag);
				this.speed.addScaledVector(this.acceleration, 1/tick_rate);
				this.position.addScaledVector(this.speed, 1/tick_rate);

				//Rotation
				var rot_drag = this.emitter.calculate(this.emitter.config.particle_rotation_rotation_drag_coefficient, params);
				var rot_acceleration = this.emitter.calculate(this.emitter.config.particle_rotation_rotation_acceleration, params);
					rot_acceleration += -rot_drag * this.rotation_rate;
				this.rotation_rate += rot_acceleration*1/tick_rate;
				this.rotation = MathUtil.degToRad(this.initial_rotation + this.rotation_rate*this.age);
			} else if (!jump) {
				if (this.emitter.config.particle_motion_relative_position.join('').length) {
					this.position.copy(this.emitter.calculate(this.emitter.config.particle_motion_relative_position, params));
				}
				this.rotation = MathUtil.degToRad(this.emitter.calculate(this.emitter.config.particle_rotation_rotation, params));
			}

			if (!jump) {
				//Size
				var size = this.emitter.calculate(this.emitter.config.particle_appearance_size, params);
				this.mesh.scale.x = size.x*2.25 || 0.0001;
				this.mesh.scale.y = size.y*2.25 || 0.0001;


				//UV
				if (this.emitter.config.particle_texture_mode === 'animated') {
					var max_frame = this.emitter.calculate(this.emitter.config.particle_texture_max_frame, params);
					if (this.emitter.config.particle_texture_stretch_to_lifetime && max_frame) {
						var fps = max_frame/this.lifetime;
					} else {
						var fps = this.emitter.calculate(this.emitter.config.particle_texture_frames_per_second, params);
					}
					if (Math.floor(this.loop_time*fps) > this.current_frame) {
						this.current_frame = Math.floor(this.loop_time*fps);
						if (max_frame && this.current_frame > max_frame) {
							if (this.emitter.config.particle_texture_loop) {
								this.current_frame = 0;
								this.loop_time = 0;
								this.setFrame(this.current_frame);
							}
						} else {
							this.setFrame(this.current_frame);
						}
					}
				} else {
					this.setFrame(0);
				}

				//Color (ToDo)
				if (this.emitter.config.particle_color_mode === 'expression') {
					var c = this.emitter.calculate(this.emitter.config.particle_color_expression, params, 'array');
					this.setColor(...c);

				} else if (this.emitter.config.particle_color_mode === 'gradient') {
					var i = this.emitter.calculate(this.emitter.config.particle_color_interpolant, params);
					var r = this.emitter.calculate(this.emitter.config.particle_color_range, params);
					var c = calculateGradient(this.emitter.config.particle_color_gradient, (i/r) * 100);
					this.setColor(c.r, c.g, c.b);

				} else {
					var c = tinycolor__default['default'](this.emitter.config.particle_color_static).toRgb();
					this.setColor(c.r/255, c.g/255, c.b/255);
				}
			}

			return this;
		}
		remove() {
			removeFromArray(this.emitter.particles, this);
			if (this.mesh.parent) this.mesh.parent.remove(this.mesh);
			this.emitter.dead_particles.push(this);
			return this;
		}
		setColor(r, g, b) {
			this.mesh.geometry.faces.forEach(face => {
				face.color.setRGB(r, g, b);
			});
			this.mesh.geometry.colorsNeedUpdate = true;
		}
		setFrame(n) {
			var params = this.params();
			var uv = this.emitter.calculate(this.emitter.config.particle_texture_uv, params);
			var size = this.emitter.calculate(this.emitter.config.particle_texture_uv_size, params);
			if (n) {
				var offset = this.emitter.calculate(this.emitter.config.particle_texture_uv_step, params);
				uv.addScaledVector(offset, n);
			}
			this.setUV(uv.x, uv.y, size.x||this.emitter.config.particle_texture_width, size.y||this.emitter.config.particle_texture_height);
		}
		setUV(x, y, w, h) {
			var epsilon = 0.05;
			var vertex_uvs = this.geometry.faceVertexUvs[0];

			w = (x+w - 2*epsilon) / this.emitter.config.particle_texture_width;
			h = (y+h - 2*epsilon) / this.emitter.config.particle_texture_height;
			x = (x + (w>0 ? epsilon : -epsilon)) / this.emitter.config.particle_texture_width;
			y = (y + (h>0 ? epsilon : -epsilon)) / this.emitter.config.particle_texture_height;

			vertex_uvs[0][0].set(x, 1-y);
			vertex_uvs[0][1].set(x, 1-h);
			vertex_uvs[0][2].set(w, 1-y);
			vertex_uvs[1][1].set(w, 1-h);

			vertex_uvs[1][0] = vertex_uvs[0][1];
			vertex_uvs[1][2] = vertex_uvs[0][2];
			this.geometry.uvsNeedUpdate = true;
		}
	}
	Wintersky.Particle = Particle;

	const dummy_vec = new THREE__default['default'].Vector3();

	function calculateCurve(emitter, curve, params) {

		var position = emitter.Molang.parse(curve.input, params);
		var range = emitter.Molang.parse(curve.range, params);

		position = (position/range) || 0;
		if (position === Infinity) position = 0;

		if (curve.mode == 'linear') {

			var segments = curve.nodes.length-1;
			position *= segments;
			var index = Math.floor(position);
			var blend = position%1;
			var difference = curve.nodes[index+1] - curve.nodes[index];
			var value = curve.nodes[index] + difference * blend;
			return value;

		} else if (curve.mode == 'catmull_rom') {
			var vectors = [];
			curve.nodes.forEach((val, i) => {
				vectors.push(new THREE__default['default'].Vector2(i-1, val));
			});
			var spline = new THREE__default['default'].SplineCurve(vectors);

			var segments = curve.nodes.length-3;
			position *= segments;
			var pso = (position+1)/(segments+2);
			return spline.getPoint(pso).y;
		}
	}


	class Emitter {
		constructor(config, options = 0) {
			Wintersky.emitters.push(this);

			this.config = config instanceof Config ? config : new Config(config, options);

			this.Molang = new Molang__default['default']();
			this.Molang.variableHandler = (key, params) => {
				return this.creation_values[key]
					|| this.tick_values[key]
					|| (this.config.curves[key] && calculateCurve(this, this.config.curves[key], params))
			};

			let global_scale = Wintersky.global_options._scale;
			this.local_space = new THREE__default['default'].Object3D();
			this.local_space.scale.set(global_scale, global_scale, global_scale);
			this.global_space = new THREE__default['default'].Object3D();
			this.global_space.scale.set(global_scale, global_scale, global_scale);
			this.material = new THREE__default['default'].MeshBasicMaterial({
				color: 0xffffff,
				transparent: true,
				vertexColors: THREE__default['default'].FaceColors,
				alphaTest: 0.2,
				map: this.config.texture
			});

			this.particles = [];
			this.dead_particles = [];
			this.age = 0;
			this.view_age = 0;
			this.enabled = false;
			this.loop_mode = options.loop_mode || Wintersky.global_options.loop_mode;
			this.parent_mode = options.parent_mode || Wintersky.global_options.parent_mode;
			this.random_vars = [Math.random(), Math.random(), Math.random(), Math.random()];
			this.tick_variables = {};
			this.tick_values = {};
			this.creation_variables = {};
			this.creation_values = {};

			this.updateMaterial();
		}
		clone() {
			let clone = new Wintersky.Emitter(this.config);
			clone.loop_mode = this.loop_mode;
			return clone;
		}
		params() {
			var obj = {
				"variable.entity_scale": 1
			};
			obj["variable.emitter_lifetime"] = this.active_time;
			obj["variable.emitter_age"] = this.age;
			obj["variable.emitter_random_1"] = this.random_vars[0];
			obj["variable.emitter_random_2"] = this.random_vars[1];
			obj["variable.emitter_random_3"] = this.random_vars[2];
			obj["variable.emitter_random_4"] = this.random_vars[3];
			return obj;
		}
		calculate(input, variables, datatype) {

			let getV = v => this.Molang.parse(v, variables);
			var data;
		
			if (input instanceof Array) {
				if (datatype == 'array') {
					data = [];
					input.forEach(source => {
						data.push(getV(source));
					});

				} else if (input.length === 4) {
					data = new THREE__default['default'].Plane().setComponents(
						getV(input[0]),
						getV(input[1]),
						getV(input[2]),
						getV(input[3])
					);
				} else if (input.length === 3) {
					data = new THREE__default['default'].Vector3(
						getV(input[0]),
						getV(input[1]),
						getV(input[2])
					);
				} else if (input.length === 2) {
					data = new THREE__default['default'].Vector2(
						getV(input[0]),
						getV(input[1])
					);
				}
			} else if (datatype == 'color') ; else {
				data = getV(input);
			}
			return data;
		}
		updateConfig() {
			this.updateMaterial();
		}
		updateMaterial() {
			this.config.updateTexture();
		}
		start() {
			this.age = 0;
			this.view_age = 0;
			this.enabled = true;
			this.initialized = true;
			Wintersky.space.add(this.global_space);
			var params = this.params();
			this.active_time = this.calculate(this.config.emitter_lifetime_active_time, params);
			this.sleep_time = this.calculate(this.config.emitter_lifetime_sleep_time, params);
			this.random_vars = [Math.random(), Math.random(), Math.random(), Math.random()];
			this.creation_values = {};

			for (var line of this.config.variables_creation_vars) {
				let [key, value] = line.split(/\s*=(.+)/);
				value = value.replace(/^\s*=\s*/, '');
				this.creation_values[key] = this.Molang.parse(value);
			}

			if (this.config.emitter_rate_mode === 'instant') {
				this.spawnParticles(this.calculate(this.config.emitter_rate_amount, params));
			}
			return this;
		}
		tick(jump) {
			let params = this.params();
			let {tick_rate} = Wintersky.global_options;
			this.tick_values = {};

			// Calculate tick values
			for (var line of this.config.variables_tick_vars) {
				let [key, value] = line.split(/\s*=(.+)/);
				value = value.replace(/^\s*=\s*/, '');
				this.tick_values[key] = this.Molang.parse(value);
			}
			// Spawn steady particles
			if (this.enabled && this.config.emitter_rate_mode === 'steady') {
				var p_this_tick = this.calculate(this.config.emitter_rate_rate, params)/tick_rate;
				var x = 1/p_this_tick;
				var c_f = Math.round(this.age*tick_rate);
				if (c_f % Math.round(x) == 0) {
					p_this_tick = Math.ceil(p_this_tick);
				} else {
					p_this_tick = Math.floor(p_this_tick);
				}
				this.spawnParticles(p_this_tick);
			}
			// Tick particles
			this.particles.forEach(p => {
				p.tick(jump);
			});

			this.age += 1/tick_rate;
			this.view_age += 1/tick_rate;

			if (this.config.emitter_lifetime_mode === 'expression') {
				//Expressions
				if (this.enabled && this.calculate(this.config.emitter_lifetime_expiration, params)) {
					this.stop();
				}
				if (!this.enabled && this.calculate(this.config.emitter_lifetime_activation, params)) {
					this.start();
				}
			} else if (this.loop_mode == 'looping' || (this.loop_mode == 'auto' && this.config.emitter_lifetime_mode == 'looping')) {
				//Looping
				if (this.enabled && MathUtil.roundTo(this.age, 5) >= this.active_time) {
					this.stop();
				}
				if (!this.enabled && MathUtil.roundTo(this.age, 5) >= this.sleep_time) {
					this.start();
				}
			} else {
				//Once
				if (this.enabled && MathUtil.roundTo(this.age, 5) >= this.active_time) {
					this.stop();
				}
			}
			return this;
		}
		stop() {
			this.enabled = false;
			this.age = 0;
			return this;
		}
		jumpTo(second) {
			let {tick_rate} = Wintersky.global_options;
			let old_time = Math.round(this.view_age * tick_rate);
			let new_time = Math.round(second * tick_rate);
			if (this.loop_mode != 'once') {
				new_time = Math.clamp(new_time, 0, Math.round(this.active_time * tick_rate) - 1);
			}
			if (old_time == new_time) return;
			if (new_time < old_time) {
				this.stop();
				this.particles.slice().forEach(particle => {
					particle.remove();
				});
				this.start();
			} else if (!this.initialized) {
				this.start();
			}
			while (Math.round(this.view_age * tick_rate) < new_time-1) {
				this.tick(true);
			}
			this.tick(false);
			return this;
		}
		updateFacingRotation(camera) {
			this.particles.forEach(p => {

				switch (this.config.particle_appearance_facing_camera_mode) {
					case 'lookat_xyz':
						p.mesh.lookAt(camera.position);
						break;
					case 'lookat_y':
						var v = new THREE__default['default'].Vector3().copy(camera.position);
						v.y = p.mesh.getWorldPosition(dummy_vec).y;
						p.mesh.lookAt(v);
						break;
					case 'rotate_xyz':
						p.mesh.rotation.copy(camera.rotation);
						break;
					case 'rotate_y':
						p.mesh.rotation.copy(camera.rotation);
						p.mesh.rotation.reorder('YXZ');
						p.mesh.rotation.x = p.mesh.rotation.z = 0;
						break;
					case 'direction':
						var q = new THREE__default['default'].Quaternion().setFromUnitVectors(Normals.z, p.speed);
						p.mesh.rotation.setFromQuaternion(q);
						break;
				}
				p.mesh.rotation.z += p.rotation||0;
			});
		}
		spawnParticles(count) {
			if (!count) return this;

			if (this.config.emitter_rate_mode == 'steady') {
				var max = this.calculate(this.config.emitter_rate_maximum, this.params())||0;
				max = MathUtil.clamp(max, 0, Wintersky.global_options.max_emitter_particles);
				count = MathUtil.clamp(count, 0, max-this.particles.length);
			} else {
				count = MathUtil.clamp(count, 0, Wintersky.global_options.max_emitter_particles-this.particles.length);
			}
			for (var i = 0; i < count; i++) {
				if (this.dead_particles.length) {
					var p = this.dead_particles.pop();
				} else {
					var p = new Particle(this);
				}
				p.add();
			}
			return count;
		}
		delete() {
			[...this.particles, ...this.dead_particles].forEach(particle => {
				if (particle.mesh.parent) particle.mesh.parent.remove(particle.mesh);
			});
			this.particles.splice(0, Infinity);
			this.dead_particles.splice(0, Infinity);
			if (this.local_space.parent) this.local_space.parent.remove(this.local_space);
			if (this.global_space.parent) this.global_space.parent.remove(this.global_space);
			removeFromArray(Wintersky.emitters, this);
		}
	}
	Wintersky.Emitter = Emitter;

	return Wintersky;

})));
