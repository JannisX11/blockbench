#ifdef GL_ES
precision highp float;
#endif

uniform bool SHADE;
uniform float BRIGHTNESS;
uniform vec3 base;

varying float light;
varying float lift;

void main(void)
{

	gl_FragColor = vec4(lift + base * light * BRIGHTNESS, 1.0);

	if (lift > 0.1) {
		gl_FragColor.b = gl_FragColor.b * 1.16;
		gl_FragColor.g = gl_FragColor.g * 1.04;
	}
	if (lift > 0.2) {
		gl_FragColor.r = gl_FragColor.r * 0.6;
		gl_FragColor.g = gl_FragColor.g * 0.7;
	}

}