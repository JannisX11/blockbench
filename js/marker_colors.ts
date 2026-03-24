export type MarkerColor = {
	id: string
	name?: string
	pastel: string
	standard: string
}
export const markerColors: MarkerColor[] = [
	{pastel: "#A2EBFF", standard: "#58C0FF", id: 'light_blue'},
	{pastel: "#FFF899", standard: "#F4D714", id: 'yellow'},
	{pastel: "#F1BB75", standard: "#EC9218", id: 'orange'},
	{pastel: "#FF9B97", standard: "#FA565D", id: 'red'},
	{pastel: "#C5A6E8", standard: "#B55AF8", id: 'purple'},
	{pastel: "#A6C8FF", standard: "#4D89FF", id: 'blue'},
	{pastel: "#7BFFA3", standard: "#00CE71", id: 'green'},
	{pastel: "#BDFFA6", standard: "#AFFF62", id: 'lime'},
	{pastel: "#FFA5D5", standard: "#F96BC5", id: 'pink'},
	{pastel: "#E0E9FB", standard: "#C7D5F6", id: 'silver'}
]
const global = {markerColors};
declare global {
	const markerColors: typeof global.markerColors
}
Object.assign(window, global);
