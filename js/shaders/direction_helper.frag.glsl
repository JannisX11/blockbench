#ifdef GL_ES
precision highp float;
#endif

varying float light;
varying float lift;

void main(void)
{
	if (gl_FrontFacing) {
		gl_FragColor = vec4(vec3(0.20, 0.68, 0.32) * light, 1.0);
	} else {
		gl_FragColor = vec4(vec3(0.76, 0.21, 0.20) * light, 1.0);
	}

	if (lift > 0.1) {
		gl_FragColor.r = gl_FragColor.r * 1.16;
		gl_FragColor.g = gl_FragColor.g * 1.16;
		gl_FragColor.b = gl_FragColor.b * 1.16;
	}
	if (lift > 0.2) {
		if (gl_FrontFacing) {
			gl_FragColor.r = gl_FragColor.r * 0.8;
			gl_FragColor.g = gl_FragColor.g * 0.9;
			gl_FragColor.b = gl_FragColor.g * 1.5;
		} else {
			gl_FragColor.r = gl_FragColor.r * 0.9;
			gl_FragColor.g = gl_FragColor.g * 2.0;
			gl_FragColor.b = gl_FragColor.g * 3.0;
		}
	}

}