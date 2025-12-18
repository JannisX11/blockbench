export class Dynamic2DMap<Type> {
	map: Record<number, Record<number, Type>>
	constructor() {
		this.map = {};
	}
	get(x: number, y: number): Type | undefined {
		return this.map[x]?.[y];
	}
	set(x: number, y: number, value: Type): void {
		if (!this.map[x]) this.map[x] = {};
		this.map[x][y] = value;
	}
	clear() {
		this.map = {};
	}
}
