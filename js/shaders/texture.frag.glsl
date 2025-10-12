#ifdef GL_ES
precision highp float;
#endif
#include <common>
#include <clipping_planes_pars_fragment>

uniform sampler2D map;

uniform bool SHADE;
uniform bool EMISSIVE;
uniform vec3 LIGHTCOLOR;

centroid varying vec2 vUv;
varying float light;
varying float lift;

void main(void)
{
	vec4 color = texture2D(map, vUv);
	
	if (color.a < 0.01) discard;

	if (EMISSIVE == false) {
		vec4 lit_color = vec4(lift + color.rgb * light, color.a);
		gl_FragColor = lit_color;
		gl_FragColor.r = gl_FragColor.r * LIGHTCOLOR.r;
		gl_FragColor.g = gl_FragColor.g * LIGHTCOLOR.g;
		gl_FragColor.b = gl_FragColor.b * LIGHTCOLOR.b;

	} else {
		float light_r = (light * LIGHTCOLOR.r) + (1.0 - light * LIGHTCOLOR.r) * (1.0 - color.a);
		float light_g = (light * LIGHTCOLOR.g) + (1.0 - light * LIGHTCOLOR.g) * (1.0 - color.a);
		float light_b = (light * LIGHTCOLOR.b) + (1.0 - light * LIGHTCOLOR.b) * (1.0 - color.a);
		vec4 lit_color = vec4(lift + color.r * light_r, lift + color.g * light_g, lift + color.b * light_b, 1.0);
		gl_FragColor = lit_color;

	}

	if (lift > 0.2) {
		gl_FragColor.r = gl_FragColor.r * 0.6;
		gl_FragColor.g = gl_FragColor.g * 0.7;
	}
  
	#include <clipping_planes_fragment>
}