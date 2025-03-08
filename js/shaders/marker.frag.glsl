#ifdef GL_ES
precision highp float;
#endif

uniform sampler2D map;

uniform bool SHADE;
uniform float BRIGHTNESS;
uniform vec3 base;

varying vec2 vUv;
varying float light;
varying float lift;

void main(void)
{
	vec4 color = texture2D(map, vUv);

	gl_FragColor = vec4(lift + color.rgb * base * light * BRIGHTNESS, 1.0);

	if (lift > 0.2) {
		gl_FragColor.r = gl_FragColor.r * 0.6;
		gl_FragColor.g = gl_FragColor.g * 0.7;
	}

}`