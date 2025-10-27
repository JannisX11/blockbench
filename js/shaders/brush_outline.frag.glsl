uniform int SHAPE;

uniform vec3 color;
uniform float width;

varying vec2 vUv;

float drawSquareOutline(vec2 shapeUv, float width)
{
	vec2 shapeUvX = shapeUv - dFdx(shapeUv);
	vec2 shapeUvY = shapeUv - dFdy(shapeUv);

	vec2 squareDist = 1. - abs(shapeUv);
	vec2 squareDistX = 1. - abs(shapeUvX);
	vec2 squareDistY = 1. - abs(shapeUvY);
	vec2 squareDxX = squareDistX - squareDist;
	vec2 squareDxY = squareDistY - squareDist;

	vec2 squareSliceAA = squareDist / vec2(length(vec2(squareDxX.x, squareDxY.x)), length(vec2(squareDxX.y, squareDxY.y)));

	float squareOuterAA = min(squareSliceAA.x, squareSliceAA.y);
	float squareInnerAA = min(squareSliceAA.x - width, squareSliceAA.y - width);
	squareOuterAA = clamp(squareOuterAA, 0., 1.);
	squareInnerAA = clamp(squareInnerAA, 0., 1.);

	return squareOuterAA - squareInnerAA;
}

float drawCircleOutline(vec2 shapeUv, float width)
{
	vec2 shapeUvX = shapeUv - dFdx(shapeUv);
	vec2 shapeUvY = shapeUv - dFdy(shapeUv);

	float circleDist = 1. - length(shapeUv);
	float circleDistX = 1. - length(shapeUvX);
	float circleDistY = 1. - length(shapeUvY);
	float circleDx = circleDistX - circleDist;
	float circleDy = circleDistY - circleDist;

	float circleOuterAA = circleDist / length(vec2(circleDx, circleDy));
	float circleInnerAA = circleOuterAA - width;
	circleOuterAA = clamp(circleOuterAA, 0., 1.);
	circleInnerAA = clamp(circleInnerAA, 0., 1.);

	return circleOuterAA - circleInnerAA;
}

void main(void)
{
	vec2 shapeUv = vUv.xy * 2. - 1.;

	vec4 finalColor = vec4(color, 1.);
	if (SHAPE == 0)
		finalColor.a = drawSquareOutline(shapeUv, width);
	else if (SHAPE == 1)
		finalColor.a = drawCircleOutline(shapeUv, width);

	if (finalColor.a < 0.01) discard;

	gl_FragColor = finalColor;
}