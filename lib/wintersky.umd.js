(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory(require('three'), require('molangjs'), require('tinycolor2')) :
	typeof define === 'function' && define.amd ? define(['three', 'molangjs', 'tinycolor2'], factory) :
	(global = typeof globalThis !== 'undefined' ? globalThis : global || self, global.Wintersky = factory(global.THREE, global.Molang, global.tinycolor));
}(this, (function (THREE, Molang, tinycolor) { 'use strict';

	function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

	var Molang__default = /*#__PURE__*/_interopDefaultLegacy(Molang);
	var tinycolor__default = /*#__PURE__*/_interopDefaultLegacy(tinycolor);

	// Wintersky object to which the individual Wintersky components add their classes
	var Wintersky = {

	};

	class Scene {
	    /**
		 *  Available options:
		 * 	- fetchTexture: (config) => Promise<string> | <string>
		 */
		constructor(options={}) {
			this.emitters = [];
			this.child_configs = {};
			this.space = new THREE.Object3D();
			this._fetchTexture = options.fetchTexture;
			this._fetchParticleFile = options.fetchParticleFile;

			this.global_options = {
				max_emitter_particles: options.max_emitter_particles || 30000,
				tick_rate: options.tick_rate || 30,
				loop_mode: options.loop_mode || 'auto',
				parent_mode: options.parent_mode || 'world',
				ground_collision: options.ground_collision != false,
				_scale: 1,
			};
			Object.defineProperty(this.global_options, 'scale', {
				get: () => {
					return this.global_options._scale;
				},
				set: (val) => {
					this.global_options._scale = val;
					this.emitters.forEach(emitter => {
						emitter.local_space.scale.set(val, val, val);
						emitter.global_space.scale.set(val, val, val);
					});
					//Wintersky.space.scale.set(val, val, val);
				},
			});
		}

		fetchTexture(config) {
			if(typeof this._fetchTexture === "function") return this._fetchTexture(config)
		}
		fetchParticleFile(identifier, config) {
			if(typeof this._fetchParticleFile === "function") return this._fetchParticleFile(identifier, config)
		}
		
		updateFacingRotation(camera) {
			this.emitters.forEach(emitter => {
				emitter.updateFacingRotation(camera);
			});
		}
	}

	Wintersky.Scene = Scene;

	const img = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH4QcKDTg2HKzkwgAAAFBJREFUOMtjvHDhwn8GCgALAwMDg4iICFma37x5w8DEQCEg2gBpaWkGaWlp8g2g2AVDyABcgTUwXiDGNQMfiCzoAk+fPiXIpr4L3rx5Q7YBAOhLE0zw8k9cAAAAAElFTkSuQmCC";

	const img$1 = "data:image/png;base64,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";

	const img$2 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAIACAYAAACLuuzTAAAphElEQVR42u3dB7RlVZUu4EMVoUCigIqAZFBybBAapSU1oii0NNqNoG0b29buNiuIICVBcs65iCI556DknHMoMlSRKhF372+uvc45t+7ap6qe743n6/H2GHvce6vOnnuFOf/5z7nmWqdTVVXnL7k7fz0C9pin0znhE53Osct0Oscs3emctnqnc9bfdjrnbNCpTluj0/nD2p3O2et3Osct2+n8ft7OcAH7zt/pnLhCEnD0UrWA+qFzPt2pzv27TnXmJ9PD532mU51aC95n/oKAQxbudE5fMwk5Yfn09vM36lQXfbZTXbZlp7pym5mqSz7Xqcas1NICb71os07lwTPX7XTu3mVUdeeOs1W3/WyW6k/fHFHd+L2R1Z+/PaI6eeVOdHeYgCOX6HSu+vJM8abrvj6ienLMotVLV61fPXniwtXtP5+1uvXHtaB/HVGdvlans/+HCgIM4P17fqC65T9mrm74zsjqkcPmr164ZM3quQtWru7b/QPVg/vPUz17zieqsz/V6RxQEmDAnjp50Wi25t7z29mjFa/e/pXq8WM/Uj165ILVA/vMVV27/UwxK8ME3PmrWSvXkyctUt29y+zVs+euUD134Srxb+9OvLcW/rFolfE4/uMFAXf8ctbqjQe+Xz1/4arVwwfPF/ebj/yseuXPm1VPn7Z4dd8eH6hu/dHMMRaXbOGRqQRcsfVM1RPHLVQ9fNB81U3fH1lNefn06o0Hf1hNePRX1S3/OXPlBXf9erYYyD+uW2jBDd8ZEc196er1q7t3HhW/v3rbP1YP7D1X1X89csgHqyMW65RtQZ89fOcOs3UfmPTMQdU7b95Yt+Y/qtfv+df8z+3GZJT13/X0GUvGYF7+D53qoQPmqa7/lxFVqzHtNFunc+TiyQ4YE5s4frlatWu1HlNr3ymr1feqnXZr/O0cnc5RS9YClkxCPHjyKp3Oqauln26CWgX8bs705qOWSPdJKybjYsb0nyB/twrYc57UbA/rird5mCnTvDP+Jv2uZXuWjGm/BeuHalM9dtkkyNv+uF6nc24NKBdskswaHhiX3ecqCDi0xgOG4kFvpBfuP31jRMVKr/7nmaqrakulxrpbBJSLa8C4ePNOTNsDe81VPV5r5v2/n7O64bs1FnwrCdLKvecrCND3W/9r5pjra7ebKUz4iRM+Wj1+zIcDD+6s1fjB/eYOPNjngwUBms1cb/7hzGGyt/10lurhA+etnjtvxTBjxsQWLv1CpzpuuYIAb31r3LnVQzVwsLpHDp0/WvDmwz+pXrtz2zCye383RyAWfRkm4LqvjaheunK9gLB7R88eXXjxinVrRFqleuyoD1V37TSquvHfRkYXi9Z44aad7luA58vXbRQCXrr6U2HeN/9gZHRPC2jlMAGXbxUgEchzxy8SOr14+TrREteUl8+oJjy2Q3VPjVaHLVoQYKCeOmWxMOXbayh/d9ID8eBrd21fTXzq9/U4bFeNv2Wr6t0pj4eFFs35tp/MUl2z7UzV/Xuktz7zx2Wrp09dPObfuMBDyDwQD7Tk0cPnjxlx6X++Xrh0rXY8+M2oTkffjvhYfS+W7IGvyK7OTY33r21mx1kLY7DLHOnBwz+WbkYTQLJqEnTSCsnYqDzsKOIBM/awlpzw8fQwb+zBU1ZJvwObojHxuHx/4MES6aEAlHUanvDp2rzXTag1+gMFARymBzw4pkajK76UHK2frPTSLRImgLxdSwI4TGTCfeHfd8Kt00o6YWpN5SWfrw2pbuXuc7cAynW1FfJQV3ypE9rIqfDYnO1N/z4yLFQLi5Bmmm6vH2IshDCce3advXqs9srM2P+xBbBmoIcJwE4YDquDPhgKAHnhsr8J7SNMCyDWoYsUBOjfU6cuFkTCB7l7rt794L5zV9T8+hofL/9S4knDBJiq+3abI/qeKQ7LZAtaxCvrnhkxkMMEnFv3jfN8cL95guaEbzx9ya6nHnfD5mHeN9f/d/BHCwIMGgaiqfjAhMd3TphwxSdrmrNNDTAbBsCMv23rGNRiC1jeVV+ZKT7w9uvXRAseO/rD4RPuqMdEVx49YsHQlTZzjnkHrBMe+3X1zhs3hE94d/IjXf701rjzqmmR7fqtHwqH4s3U18zQypvT2LTwg1HJVPNN59k/ZwobjDwTp/Kwo8gPKMgh9QgbZa7ew9w8QTQVJjD1Ih7sNlcy5cMXTR/yEIXJvIB7hwf+b5eSgL3ma95WN5PrumDjZJX8Bf0/b8NOhc16wc6zFwTs/cFEKAAIN0/zDBokvuyLnTBlQrRydBseXPrFBBpuimXub//5LOGt3VRZ63YrEQxQRVGu/McEHHwlrbx3tzR9MIGNaOUBHy4IwH/MP5u/+p9mCnu46zejgv7y1IRhLGKoA0sC9PuhA+aNh2gfQcwYR4ANukSwQYXMwwlGPUUI9U21F6aB4IxAHvu6ryWOBGTNSJErn1FTl7FnLhOGxL1zqqzz9sZTo/wCD+ylOAYiM64ceN5QD9grf9q0wYQl6tBnjfDIY89cukatxQOlh7dg7TT3ABXFef3ebwXFQbI94N/oBKM6c51CC+C+y4CBtnE3f6Eaf/OW8dAr129cTX7uyDDzV/60SfXOhNvLeMClT372sKD7uhPmXKM1RAZtuvfIoR8cjAfPnrt8gvL6J3dmIA2cgaWNA/HgoI90Oge661E+YvEeDuT4AY/2mYF4cHCDB5QlAKXhBSg/PDhooRYBGHjQ/SXTnSP2iKU/mVw7TDi4FrBTSYCAGolAKvBhbl2fGRe6z5TRf63cpQ0PfEh8ALY9zAIZEA7pvmyrhAe7ztFC9+k613V+jUbe7OHwiTUOXPPV5PqNxd4ltg7OzDWbBywe4qH4CcplGmmkcShmMAAm1w4HvE2kIpIPt163gmDdMKjIyDABIJwpc+EYCiu8u8YG3BgOiGIE3WbETAzvQj3HACQCjnoAx/5h6bAJcDb+1q0DXPyte/suUE5ABMXJPOCZPy5TTXnh+IAzPvGJ4xeKJAQeLTkzTABtu6Y2HhAuBYIXMxzmqws52JA/6A+Bu79csGmKF9A6lF/uRDegMyR6/uLVY0yeqCMarGWYANb3xv3fj4zF/XvOGeaLK/BOhPIP9OLe0XO08wMY4G3PnrN8wDn/cNdOs8X8m1qgYzYG4gHYNp0eFICZEdQOjPFYA+MFtg5x3eIGJh2YsFwybXggXvj1bIVBRKAjXlg0UX4jLRh1c/E0lR0g5cWAQwwQROITCUDMiigVJsIFeECYVrbiAdeecwb03uCFO6tngkBWCg+K/EDTvI3r8kYzQED22ByPQTQee8zdkg4EIJDI2zzEsOgAe7i60VLjUMwn6r/wlrqaa0pkOsOt196aDmiBcSimA7XAwx7UfA8BFC6NQLoAG82IdMkwAcfUAqhrDjiYr7+NwRMnLBy5NAkKuFnMYJDM4vLIM+MXr1w3KA6fGHiwR0pYFvOJtCyaWoMqV8bqGJU36z+IuxbU1XhBV4ocadLY/YKx6/sTx380nKzRh4sPHzJf/Dt8ENEME+BDMhhj/7BUxE0SL1fWY0F5Imr7QWJpAKXID26pB0gqVKCV4yQjb1zohIHNs9GaTzQD5hoPEDsFR2hUmYprjW4MxIMpL51cTXxi11BdD8BFSJ1VuxUPdm7iBZjPvdNMUM9jcfFu/8Yr/WrWFn4gyKBQGDsPFIb1qeSt8UhB+X4LDsCDkxv37sMXNnjAG6H5GRPgQRGReFxv86E8YMaBElEuAvFkSYoi3QcUYXGbxRs7pkv6j1fmG5gyY2ql+yRTYXNOiObjyMHOahX2N0MysHuVjAmYIhj5TVQYoLBGCxP8oZbx4kUBgimsNAccVBln5lCoOa9ElalxMQGhb5wIdcWFIvlQByAgjW1ISBJKmYr5RPqdUUcrZLQwFFoIJ3MehU0cXconAstnzv54NPPPdVce3GfucLAeAKo8dkRyBG5doPsGTMIBBjBZH6QHtNHsABSGZZyK/ACYCvNwImGOyIXyaHqOG93n11NZJFlG24eNQz8i678pZA80URebJGWZH6A22AnFoc6iOJoYql3Pjq4NxIMJT+wSVOfhg+bt5hG1zthM/XAxn8i1Y+ssklGJ5oLqr5hiB0b3q1la8CC7dx9mvvpO/7Og8Eo1R9yhhAc8biTmV0+YQIBZiKi9ARaCzMAug9w78PBBD3nY9FJvGkpI0P0SHkh9UBzTiMZ5wBSyyiwAzOFMxXSgWOiSjDyfTnjAvGlffjtLFICVBdRYx4jAl/QHHIggo25FTlBpCdwsIhJrxIt0gXPhqaz45VQA1+Z3/1/MJxoD06b/Bu/OHWYNdWaBuhOubavE2g4r5RMNjuxV9LseOFhAQMbGoDlfSfZiPIYJ0DSOFQbE4sw3Exb6sLfHGGyVwKa43mikvZHvv2f07AEiTDcyO5slnug2lcLj4gJFQHo9gIHGNZz7aTygMQ0VeAYB/WoBkXhhlM5PlqdL7MAUmj5d4ebhgVYUzRmxePnavwsTFmC53ntnXIApRMYftHIgHhgDU2e1s/8SPyAeA/GAoXDv7B6EcbRWwVknTOCVcMRflvCAx4UDmVAIcQ1eRO1N6E+QYGSnonufL2EAUwYcHqKZZsHgGURC2ul+zTzoQrdc4FMpRrqs0QOtgUpspsgPQFUkHTdIAgjzdqrMvJkyXQgBc7YIiIBjw9RcNpGtEyZQa5qIPxURCaBE+nPDdNNC8QOtozw5IUd4MR0IE3PSRfNvrDWQQXm7liFbWhMCSrYAJDKhhI3eTqEMJFUmKFjb51PYU2Tr1hRy/kAkr0sMyJv7860UbpgAIR8cwMypM703dTkFlBdw6EIx5KFA3kJpoE5/DumPjTp7GOBKFQ1fX/heGjRQho1kYmkWLtwsORv6IL9SJhhfTh7YOsuEx3aKUMclf2JQIzmzdeIPxQXLcO2P7dhdjHn5mg2GmHNeUgZzA/GAYzknoW7bVcYDHjfnD936qd85aueRuH41O0X3zt/5oIwePuz3s9ZLBpZNmRBaWMQD/NcDUS7QsJPspf2kJ4Qf0sYPCKB1YbZr9BgKAbkGIa94ti5QxKLkeikRQWUpVaBSPbCWkRgaNS62AB7oqw+5zTltpANcPIOS5dW9Yj7RPxqoDKYe5g8j/NuoSYE0hLOYjEMwmKwPZQ9EO+PvzZIZGw/qXVweENJx4ZBHc8EZohWEa8NmsSYt1JQTkkY41lK2T7lUmGhA87j43W0qW3OqoAsnTuuuyXC8Ub9jzWn1pJlFRDJV+qwb7vOaaYMRzNjDdERXiguWBs4KvwVLa6ypJumM6qlTPtbFRT+ByUELtSzaMmEsxfLxs3X4k6/X7/tOt4yEuh+ycBs/GLNoaJ1+t9myqR6IB4iEPisf6b9euupvY8mkFQ84zKg1+ETCg7x4n117Fw8G0f2cO6RUfmYv7ae/EYzgB6MGCWgSj9561nq9Ah/FDPghAeUFirnTQz5MCJ03FnQhcwb/h2AUBUjxhTWulX6a83A0myaCkbHB0mkxnygij5KJ1RKgMGPONNMbLfKztT7R6HprNHmDZA9cen44W6IWFhVJRH51E1RkL3zW+g06NzUYfupecbFOKKM0wJsxEQDiwxHy9Y3NCW1FXVAmu/HMRgApCzQ2UeDWLCMX65EMXA7z6HtwxnVSOkgrMh7oRjHkobLyBkIdgQdkkvEXkMOGroNZO6XHiyscXDueoAXKBvL1zFnLdceFMhWzulEBuP88XRjrt8S3xp1TTX7huPjd+BQF5NIB7IyA585faZg5x5rrdjNNu/7AGCATr96xbSUxYyzEkPIo08SDyBsul1y8UTf33BnUxh/kE1vTgWOaeAFwwP/+8kL/Rtmo/I4lfjC6ySfmbEWuBAhtXKcBmpUSTy7mEy1Y5kpImseAcgIuWyJdObqtHklEHsujK6Y+R6C5SfID1BmgaFWUE83VAijUl9H4MGukxvnhTDx0o0h1c30iAGFE2TMbTELzeMDG4noj9umtNFGcpP+mMVZ4mhJTpabHLt1WYrnI0IAjh3sAJXJIy6WphAdF38je0dgItLZogqwGjbRAmdlJzQAXIxbzn2uzxQuMy3qrNIABPKuhgK0EA4nINoBcWJxwTXh8p3D5eVyiyLMkQJ9l7mJlayqy/eod/xRR/XtvvxBjUyzy1Eel1QItAp45a9kh5qyS2rpLrENtMqAeKYoYdh4VgmAAXBh7xlLROnGEcRqIB++9/WK34DlXS096eq8oORsYL0gHRqywXFIW831yLi9sapKkz3HqwfnEjydAyX4yNHDVZGiEtxIMAXVURC6fPhzRynoNLqzdV4/UVj6wa9OFXMhkJqh2jhUye9GNXdvwIMdG1JUTyc7V30E8VktjUXTvvM25fcij+WFIK/TKK42FcSg6V1jnrdmNMSJdyYmZfLcukfD5GUgzN8pxknHJpSS8eBFQSI4w7zPJaPJ45G0ZdCPXsRcFkJ5zibFktlnKo4nkcx13xoXiGOif7H4kXGKJZJZIh9lFYZUjj0us+pYEUBSrmfmD/ZaIN1s2ZQ+xxjJvC0d68cr1ogUEYO7919OnLVHdv9ecaeV39ZZlom6o3xQv8czergpAPkEkFy9YfwA/mDR2/5451298//13okqSi8/Cp8kPot8XrBTNDoZShz7PNxtCBuYT896FvP0g+MLyvRpFcfNebflEKb5jluolIXL9QcaDSEiukNx7MX9AQGQ0l06qm+PoUOeV001X+NBiPnHXvpCH/sOBCHVW7quIWjGlA4vJeX3rf+vpzdpKrtPMqVLF0EUBDCTzAEhEgNYwoP6bEy7WaBIANLw9wpu1hppy7O1YMvHkoi3IH+Qwj1kz5bwFJddym1530RpJRi5QWStaiFV3G9bKvTFAsopjoJmidrESi5ScZwOPHrFAuLQYlzVTS4pl58ATkEAkY6D0WMGvixC0X7KOUrWusdgphAcQ8OjhC3RNefILx4YQS4iQm7YW11jefv3aqIIS6mu2Kgg7CAgTjFzTLB8XMxhNZqYaf8uWAWGTnzs8qh3s3xC1N5F7jE0x5HG/evuXe1FK/WYPvf/elCi3nCodMBgPZDF14foUH0xfPpGJGsgjG43r6n+DB1GPtMyAfCIB2CoHAxe6e5hWaghmk5g4YBAeUKZjGg8UznSV3ttDwHKpILpoTBEvrNxn/6v0opRcbu0nayyWFzIQruu0NZt11lVSDZbu9N+tNZoECDa0IDvWbMp5a4ZBVuRRdO/wYEzzcHjk5XuUJ2q5P9Yr+ioaEwYeiYbPpEgFV7igSY8TclyzVctMFTmSN+RSOgTD74JNC1Ryi8ZFC1vLztmCbH7ETTWwordqdd9+7fIQlFcCtaa86rtwqk/UApXDPPGksfuE7ir2jd2XtZBYe16khWQh189ftGqwFBk9+MDNP7DP3LHOlnOsZqY4Bm+Pvyi8sGUSggAI2h/l1/vP083mFTdA4ESqhCc++bu01aAGEy0QbCi3Vjndz1jK9crjL0h9ru0fcECmKU3iIV9TXjxh+viBaTR4040HbFzfsHEal004q3N4pyUH4MGvM6A0myRPasjFscv2BHAqrRsgKEeuhMz2n1nJUc2mST+pfJEfdMP/PizwRi3KtzLs/dpKLKNCcrleyiuDiQfpv3w6DRQWFCMWeBDRSoMJrC97Y0pG1QkReLfyg1xemZfGIqO7VkKivHWTgOIYgKrIYjVLppIRUXJde2z6n+nOQW2DqJ+5oDX2OtbWiGjawyOCl5yTxTITxTFgjdz7uc0uc4akTn/iU3vGnj+ldjyVGSrmUCzS2JJntwAXz6QVNNr8E2kwu0m26pWeF937y9d9JoqaGREyEdUAtUVaQhSQ2yAku1Hcsm3grCVYIpj09N5Rk6QFapa1Sn3We1OeStH9b0YNN2c0nnuf8uKJUdxsnUVL7KTqv167+1+iQqRozs9ftNqQdQR1SdNaMhyGB3IFaavm0JBn4pO7R83WQDwwkIc2eJAdyVF9BkWlI584iO5n/c8P5/2Oee+j/EHRGhlI3mWdLdFDNBRKubVOCmiH1grJpRICnfDxXsqDAFDHiNxSQDu14cHRTXklAcBEC9zGBhIxJGrcyg/yHm/0BrAwaeCSu6ILBBRbYHCY8h8aa5RL4GzdtPT4plWtkJYTEMgFckUzubS8AQjFhREGs7jKowWovrdpOgzgzgTcSg2BS64EKuZQTI/wnwVamLFQwQp5ZqkARBvgGJ9ibp2Jaq7ifkkHxQyxTbPGAt5al/Bn2bx9529Z8XzowHkDfQTbBFlr4NYl4nTDFiVnIhTLifQPNxh34+fCnUMgEKZ+uf9SPVgUANI92O+dp05C5Ou+PVrqE997a2w14dEdAnmUXPdfzkEwRhBq8HpjHa0gF/2XndaTnz8mn4tQxgPaRVWz6R7ZsNNDF+65NTYhxi5aIwMJbrBkz6l29zct1LtlcMoJiFHpzUf1CTisEUDN6YmbgB0G7bjOaRC/a4GmE8Ct00BdGLiDIudO8p5v2JhruQFKKyLlBcu8FMKsczUc68w8oVVA8IN1EqggWKguw7KXia/MOysg045tRRw5DYilUGMuLc5D+cWs3Srao9rCf6NrIUr9gYUZAJLK8UdFWpB5e8GJbSXXTDTigvohAQbfGLuHfpSKHPlJ9YsA5/dt2Txe1xKBYxsEF3BAXg06iVyeO3/F2EBc3M8ED+UIGIv9fAp8URpuvke0T4yAHDYOX+FYJSUd3n9vUnxY/qT/Ydc7b95S0/9/jmLw4fzgxzNXr9/zjfgAT9yfwQjv/MToaBnGYjaK5vzaXdsFmZranAUdr9/77e4xJ9OMF65pNnsAVuMibhh/yz8MjhcCDxbu4QFXRvcP/HBvjxNrFKT/YuaWeOGQRkDXKy+UHuTO0EDOh4AiHuQd19GCxXvEOntkiuaWR2td4aDnsRVzmR46+cmANB8m8OLFFjCQMSv39mow4VgmWDf9rWXQqVVArj/IKQ/GdP3X09IZ1f1DU+BoHIpdUNXAUHK0QhM5VwZEL1RDIOKHLTIgh5KrHqKkarOU0ct7GyXsrX60VkzvVZuookbN9jDX5mbGVzcVAaJ33SwKMO/JfGeNauHAgxpgYldh/VPmny3w2sX9TIhDbDvC0ndLWxKF+zAil+O/etvWMSZnl5Lz6B2v+8b934sPW9UjMF8OEHA6C9rTHH0y1flI9QMQx56mcTd+PghF//X6fd8OsgH2mvKC4UskapDCO9cD99a4s3ve+datK9EMlHbdm0qRh5vzxJrqv37vN7ujL/CySGm79ouXr52WClKOYdr5AxskYxfJD0ZOf/6A0eSYIUz5Q8mMeS0km1uTBvt5CQ92zAKaIPugPgv0MGfi5oSLgLJTPpFl8R43OLyPYMMCLWG1xRbk9ca8nhZVEM3qBpxgytCpVYD/yGurDIY3zsecsdKclNCNX8zSQjBigbaJVnL0zhoJCUxYO41TMeBQg5GLeZAMv3Ppwv8Q0KQI7T4tJuMASt7kkLcg5CDcTzjBX+jG6LaEJG6g2XlLJmuMHbbbpN1VLNNG4mJxnxQQboCZiw9iY9SWaeuN0wdcyDi3r4vFI98syImXLQdosgG0oP/+uxMrdbwie2dHFTcLM9HgB2csFZuFUZv+yy7k2GFZt7L/wK1eF+p+2XrgA/o7/tbkTN9765lIhbBIaOQyM8WSKk20VRuhysXPohhMraH51Wt3fz26VzRnSGRdRQmBPV2AFKjOUP4AKqt2kP6ZoXpl7orVRYy8UCLW+zZYgNZxfW5e6WcjW/DAgznpdlATHxCY8YAgalwUsPOovrTfYr0DFNyw4YCmRa0CNC0vyhHSLbH9+1Rmzm/gC2ymiAcE5MyFD8ID3olOWGuOCtlVmpKqtgxGLpfgIyxe80D2NoZnXj/FEpCpmM0DKHnLDQTKzWdQsWW72VGhdUV+ADS9kRlHpfQXe0uHfgKV2FWzVUvlvJFH729uNj5ZZ7z4s6nwmZFhq+ivmKK4m8j8U1spQSUD+HCcWnb9RtWbD/1XaObYM5aMRbsiPzBVqoUfrUmE89EAB17w/vvvdot57m7qccRURUDJ4Q1os/JvgWLS2H3rkH/NsEiufcqLJ8XAFuOFJ8csEhwgthvU4wGhINDDNcXP9YpaAqFL1hilQ+Nu+kI9YF9JR7t8K8VKvYDjpmFWOcQ0pT6AiDSIfEnpeuuVswbjgS0W2Fj09+UzUqz0wvHTxgP8d/8FezkzeLB/ww8yHjAkOeWfjOy0BxxxRtLCvY2SrJNAmgoTWgX8ZlRvLY2qmhVAK498QrPeBhfYzE/bBACRDCgMivEov+UzEFEq3FpCQcCYZsGSm4ua5c1SDT/X7m8aaFxaU6K5uO/UZhNcPjvNT0w96P6iAyqmw+a3SJXSfj+/OebJT4SDqRNWTI0b6TgHZvu0g9CeHU33b4xIVotu8NrGqVjQBEgk4YW33uqNInnu3aGcbAI+FE8fwIs4VuvtvLAAW/XLGw/8e1p7q1uAR0vaFVf7KBBfKOT1ZrgATMbf+qU41kgcIa5mcOeUtiPBfcsisprgTHfikKk6QrFY6TQCRBzYmKFhArzp8eM+EgEFkhHrKs2Osl4KYNd2c5YrcVAKEEE0AOmbD/90mDm/+dCPhpxaNsQ08wlNebX3jfv/rXr/vYmVIw3ydUc6e7YdDyAQXAQs2NoM8QO5goOa85EObuKGYOsLJCMSuVPjH49oyx98tHc+klnJuXa4QBCwYTOtgJLjA/epq/f2M1lvE5QTtHubeycgl1hyoN7M+hgTC43KwGUTWylm87jsXMiYT3PFCbQi7+Nwt57AIODoL+6DDW5olA9npqEEtybjgg9slWh+LrGESpwuv4l4M/Piyjc652H7mikLgyGIeXNrjImCcXvF3YWgij/klZktY4ILyaR/EFkswvGlYimNOY6zoLZNZxyI3C1YEvD4MR9JR7/9MK16FIv7wJQ3AxILFMIfbIVKswuu3y4j5n1qSUAcOFnjAbt3ozLQpzn/I52heNMWNRF/Pi/iTXUkbHNAAAojg+HGBaa+UB0EpLiDIjaE1Z4INrBECzQYCZYiBJjy0inxguKJLJlkRAK2JlcENLY/Y/FCFzhqZMpH2+Tr/XffHIAHszYZ/CZ3SFlyNQAdgRF4Mjz4UQkPooBhod6qXn/JsfQYX0DQ6Db3TgBdyHU3PPGZTdltrs3xf63ZPCZ6YnNKY2zJWjmZtC3bsf7WVEm2nsAgAZErA89ct7d3J+8aCGyoDYxfLBb/axrzBWFMNp/WxCoFHpCagRFeXHsPfrBpCvFBuzf6O2HBHBGUc77AprifydSxwmCn305HnjEkFJ/us05KpkXF487Mcd5VKLSlzlJfVrxk/CkW4Uy6GC9olnjZPmfhDiaiJXQ/9L/21IxNUtJsFY8z4f+9ifrCA1yJSQu4UwJihVgNbFIDww9Q0E+jbX8fi9P/d968tW9X0XmxfFiMFziSSLhsmU6g4MKFOJYMHOQ+6ZkDYulAYVP/DsOuACM78YnfxlzDhTik/Rdlc8Zgy+sLTV9deYWnHxNsjOqHs4F4YEoRqsnPHhrpUaffT3xy9LTjhf2bVT20L045Xz0ZFwLOL+7S5t4JoAuHNfECMIl9fmsny8xVca3ZPCbaX7ggRoidBGv0Tl8gdGDFNBTKOyfyvqa8i+K0ZntW63koIhHAkbcr541AzBpTj53HX0zJiKJ71zd4kA8OUW7MxXuQTtzUHIUGcIpr76hLzurHkQWfTUcA0oVHmxN/aapBLQKKZsV+pmZTFNsXvdIBQuIwhW3TksERi7es/rO8Sxt2Ql0FHxBJjtHtnCT/VtwwzaVrcj7KJI68a75/Qn7ttbu+FgU9AIaQ4ecrr5+2J8aiRHN6JXrDwb4z4c7q7VcvC2sEKsX1RnAdG0PzcXc1GmHtL162djXuhs9GpdALF68RY1PcTQRUURrJlrxx2si//doVQ8uJ7tquHLFIvPeXFOetWfkchIgVHvl5VAlpVet5KPksZTOiC8ZAblFu4fX7vpv/vx0PXrvzq90NkeBMK0xlXkb+K/46lf+jArj12FS/YWfaY5D3+fc7HDAP7vtP6GoVEAdqbZFyBhSKI6HSNLPfIxUFnNtsyxRcRPqvftjae7YRDpeptwpgfVnP46ifbdLOonygCoHMvVVArPB9pTlEpDlxwRjIr/GT0gLApXVrHhwgAPEGX3BQtaBtSW6eqjn9vNwCpYP6GMnY7VLQIfHAH8pisBWCWwV4AHS71R/AQXU4/ZG7vGKrAEm4tLb43Vh7DbJRRzHvvze5emv8RTU72TwOIWtdLhSZTXj0l/HdC1ia/nqjzAZchEzNV6qUWyC9IZORippXiJxinFTV1GdCqOmOFyK8uWaDdIjKRmn75sD8wf9wPGCF+ZykaeNBczh7xgJOJrhhc+L1dLfg4iabRZm4uTjJcfMZEABQQHlUAXw5WSiB5w06FyfQ6HPJKwu28hlikSKvY+sIzr87sl2ANwEM1ujt3ohkWCaz/5+m3vSDAQKYsiZqgcBD0BFni9b2wKydv96/8j9MAIdKSHClL6fwhxGl7br7BCb0xwrDBMidMmVNNnhR+VD7Q9VBMpsZka7vOwNgKKD8dvbqpWs+Xb1657ahOGIGgyeX4Bty7Gno33owRID8oQ/nXcX6ba1Rt3AikJ7N2WyUz09svoclXzKbAJZ2KniarvxB3mqRs7k5d5I2Rmzy/yoegLR+bjjdAuIUwy063e1o/edjTVNArj+IY7+27R2HOkMtyMuF+SDOafOD5tyDfibq9zi4/aep/HTguXn5VLZYoNw4vZn90404zL9W6f4y2+EtaFb1tQKkRXGb5fMD5ombJU6Ni0MEaF7etg1YojqwfrPAm5eyWDEQkVREWWezwmfA8jHpSgd8/Zxgg4X2t2KIAAZjCwL40oW8ZAgnopa5ZuqKe4otSDHRbLFQ6dJn/c8HVzPn5mTjISeSDImZpq56QPdBW5rKXhmBFHGxC4AjFy0pr071Rxd2M5t9JQXtmjj+5i/2cODmL+QCpmmvL/z14kEoVXO+7AwL4BfDGrfsDKG30y0gBxp5xe+CTTv/a4N4deOlKNTULRnW3yFd2Dj5SLkkkTvH0l/EMrAFQDQHHfyhm7fuL+Qpuvf+38VIHnRsOkPiuQYiEvOV/vSmvGCr7zYICsxxheu2HyAAJ87fApMPaoYRSq4xdOBiLIoCMDDmCnXygSIe1irMnS5gbHxma7WwN9mC1TPbObpQzlLVYeQTjIoCOBBZG0mHbJUsMm9FQHGUD/R/hcIQAdZWm69U69r/1PsbtWqgHuQERL6UVOWrKbv8v4AHJac63QLow4Wb/gUC8gGc/1sgrT8dPN0CaJ2bWnO2U5v84IeboIOKu5uilukMODZIrMRygA0wdADJmHpAh72RN2aywRHETCoBDl+ga4lT05yh/KBGIN5Y2iNXSTIiLh2sUeOm1K7TuvaOG8gf6nOcAL9VonpuY9Ac71EWoL/ZgSovBqLZ9s1CPhukuDwQMVPdBUTKGusLl60dG4DsmBD+vzvpvvjd8Qb9X2rSfdgpTOCsf18z+1eP1d1B8dKYCMJa8cDDk587Yipzfrb7O1Cd5nnrjnGylzP2ONaEq3ugQk19ZkiR/oflD/4iAeds0A4m0xSQg45sgedsMIOAgpVIiUU68Osj8v6WdgH5CJOcM8QRaJ0Kodhp5PzxjQfhweYpOsmUngBY4M00EKCgOwMTEOyeReIF0l9iaTfhzFtrBuKBDYJvv3pJlBx7sybzym7B+ZsP/7g9XgAeKL83Ml0JeRZKoJsQXwpXXB7IK555G5IHLE42AXd3V5EMbz+0dwXgAJaDZPQ9nDKY/9n9XeWDHRRTf8Py0PMPXjk7ciUTn9ojHs5nIr07+bF4WGpkmvsbdcWcT315sKlF+P94MMMRy4Z/AR5kitP/ZR8zTjCaL3VwX/+NEdNeoBgSiNbWl0uLGFr+/oWBCUnuWzGfh+TO5BCdTJQXLJovCm6PF+IraGshCIWHCXE+CCGKHG/83sjBLYivIa2FeNjt7A83KyWk/4tMhn3/gv07Hs5N97M5PCRa4cvUb2hrgSUQC3TOTLNEkIXk73Wd+ORuwR2MQ0s+ccGAK1/4qkzCbkq3tVatkEuI7+3ZZgCoevufv5O+sMXD+fwTh7FqkfoDPwcqkpZoQd7TmfOKHm5Oaxny+f8Gd0TMRx2PYswAAAAASUVORK5CYII=";

	const img$3 = "data:image/png;base64,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";

	const img$4 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAADACAYAAAANzeNOAAAClklEQVRo3u2Z624UMQyF91URgoqi3ujSG70tqgCB4JWDXOlUpx47dmbUVav1j6NMMj6fnZ0ks9uuWmurJVoVIAZcnx23WQAxRmYXALPWYsDnj+9aCiCBIpjQpgEMYaWnoE2eOayglnIBFgHuLr801hBAmyPQs87hp/etB7AgLsCDyXh3ChLAYhjGwg8xazYBvI11NXUe7B5g823doGEAmyOQaZR3YRYyMR/tf3AhGDMBYoS87IC4UxCzBKC1siOJC+hVgjEXwBAvM5vdx8iBuqqhlRiZaze++Ha+PmuiWQCYtRYDLNCwuQvImDVk8jVfbp4c7LlGxJgAMUIIRMtgaUMAmwEUsdkEMAgGQKDuU+BAS6l1wMGesbbztgDyPni4u3hSGsAmiGFdgGXWkNkAazpDZmsaT+b10X7KjDgTwBmsa5ilNQEcoCG4D5kAngoqEmmzCeAqPHEi9zHqYC9zuJS9jHUebBPwc3PVtIZ/cLAZ/RBgZe5VMmxOA/QUMHZ+cvAMMjGzUYJ1H+0EgGAE4dqTOQXc0MEa1n0KvYza3F0HvbJrN74pwO/vNw1KA2DAWymCuBk9uYDIyNXMAoguTg8fZQLkBmdCX1oZg9kF4CDVZgh/+ugCEKCNXnZ3HSBQt7WZCjAL8OfhtkFDADHgQIkg3awA4frq63FLAXTmXhUTgGTh7LqfAmgBlJoCIBo2ex1EZ0LthQK8PODvj/sGDQHEIBuIATfnp7mlzCYNSm1nyaSzowKrCnMKCGal/kkDM1fC/VqJBdhFwO3luv37tXnU8DcUNuN6GCCSzICkv+JoCDRUQXQG1EIqwK4AsAewiYbPAz4TeuYUoHcWhJ9BZK51UIACbAuAA2X47WxBFlVQj/G1A/4D2cRpqoNd7bwAAAAASUVORK5CYII=";

	function parseColor(input) {
		if (typeof input == 'string' && input[0] == '#') {
			if (input.length < 9) {
				input = '#ff' + input.substr(1, 6);
			}
		} else if (input instanceof Array) {
			return new tinycolor__default['default']({
				r: (input[0] || 0) * 255,
				g: (input[1] || 0) * 255,
				b: (input[2] || 0) * 255,
				a: (typeof input[3] == 'number' ? input[3] : 1),
			}).toHex8String();

		} else {
			input = new tinycolor__default['default'](input).toHex8String();
		}
		return '#' + input.substr(3, 6) + input.substr(1, 2);
	}

	class Config {
		constructor(scene, config, options = 0) {
			this.scene = scene;
			this.texture = new THREE.Texture(new Image());
			this.texture.image.onload = () => {
				this.texture.needsUpdate = true;
				if (typeof this.onTextureUpdate == 'function') {
					this.onTextureUpdate();
				}
			};
			this.texture_source_category = 'placeholder';
			this.reset();
			this.onTextureUpdate = null;

			if (options.path) this.set('file_path', options.path);
			
			if (config && config.particle_effect) {
				this.setFromJSON(config);
			} else if (typeof config == 'object') {
				Object.assign(this, config);
			}
		}
		reset() {
			this.texture.image.src = img;
			this.texture.magFilter = THREE.NearestFilter;
			this.texture.minFilter = THREE.NearestFilter;

			for (var key in Config.types) {
				var type = Config.types[key];
				var value;
				switch (type.type) {
					case 'string': value = ''; break;
					case 'molang': value = ''; break;
					case 'number': value = 0; break;
					case 'boolean': value = false; break;
					case 'color': value = '#ffffff'; break;
					case 'object': value = {}; break;
				}
				if (type.array) {
					this[key] = [];
					if (type.dimensions) {
						for (var i = 0; i < type.dimensions; i++) {
							if (type.type == 'object') value = {};
							this[key].push(value);
						}
					}
				} else if (type.type == 'object' && this[key]) {
					for (let subkey in this[key]) {
						delete this[key][subkey];
					}
				} else {
					this[key] = value;
				}
			}
			this.emitter_rate_mode = 'steady';
			this.emitter_lifetime_mode = 'looping';
			this.emitter_shape_mode = 'point';
			this.particle_appearance_material = 'particles_alpha';
			this.particle_appearance_facing_camera_mode = 'rotate_xyz';
			this.particle_appearance_direction_mode = 'derive_from_velocity';
			this.particle_appearance_speed_threshold = 0.01;
			this.particle_direction_mode = 'outwards';
			this.particle_motion_mode = 'dynamic';
			this.particle_rotation_mode = 'dynamic';
			this.particle_texture_mode = 'static';
			this.particle_color_mode = 'static';
			this.particle_color_interpolant = 'v.particle_age / v.particle_lifetime';
			this.particle_color_range = 1;

			this.emitter_rate_rate = '4';
			this.emitter_rate_amount = '1';
			this.emitter_rate_maximum = '100';
			this.emitter_lifetime_active_time = '1';
			this.particle_appearance_size = ['0.2', '0.2'];
			this.particle_lifetime_max_lifetime = '1';
			this.particle_texture_size = [16, 16];

			this.texture_source_category = 'placeholder';

			return this;
		}
		set(key, val) {
			if (Config.types[key] == undefined || val == undefined || val == null) return;
			
			if (Config.types[key].array && val instanceof Array) {
				if (Config.types[key].type == 'molang') {
					val = val.map(v => v.toString());
				}
				this[key].splice(0, Infinity, ...val);
			} else if (Config.types[key].array && Config.types[key].type == 'string' && typeof val == 'string') {
				this[key].splice(0, Infinity, val);
			} else if (typeof this[key] == 'string') {
				this[key] = val.toString();
			} else if (Config.types[key].type == 'number' && typeof val == 'number') {
				this[key] = val;
			} else if (Config.types[key].type == 'boolean') {
				this[key] = !!val;
			} else if (Config.types[key].type == 'object') {
				for (let obj_key in val) {
					this[key][obj_key] = val[obj_key];
				}
			}
			return this;
		}
		setFromJSON(data) {

			var comps = data.particle_effect.components;
			var curves = data.particle_effect.curves;
			var events = data.particle_effect.events;
			var desc = data.particle_effect.description;
			if (desc && desc.identifier) {
				this.identifier = desc.identifier;
			}
			if (desc && desc.basic_render_parameters) {
				this.set('particle_texture_path', desc.basic_render_parameters.texture);

				this.set('particle_appearance_material', desc.basic_render_parameters.material);
			}
			if (typeof events == 'object') {
				for (let id in events) {
					let event = events[id];
					this.events[id] = event;
				}
			}
			if (curves) {
				for (var key in curves) {
					var json_curve = curves[key];
					var new_curve = {
						id: key,
						mode: json_curve.type,
						input: (json_curve.input || 0).toString(),
						range: (json_curve.horizontal_range || 0).toString(),
						nodes: []
					};
					if (json_curve.nodes instanceof Array && json_curve.nodes.length) {
						json_curve.nodes.forEach(value => {
							let point = parseFloat(value)||0;
							new_curve.nodes.push(point);
						});
					} else if (typeof json_curve.nodes == 'object' && json_curve.type == 'bezier_chain') {
						for (let key in json_curve.nodes) {
							let node = json_curve.nodes[key];
							let point = {
								time: parseFloat(key),
								left_value: parseFloat(node.left_value||node.value) || 0,
								right_value: parseFloat(node.right_value||node.value) || 0,
								left_slope: parseFloat(node.left_slope||node.slope) || 0,
								right_slope: parseFloat(node.right_slope||node.slope) || 0,
							};
							new_curve.nodes.push(point);
						}
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
					this.space_local_velocity = comp('emitter_local_space').velocity;
				}
				if (comp('emitter_rate_manual')) {
					this.set('emitter_rate_mode',  'manual');
					this.set('emitter_rate_maximum',  comp('emitter_rate_manual').max_particles);
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
				if (comp('emitter_lifetime_events')) {
					let l_e_comp = comp('emitter_lifetime_events');
					this.set('emitter_events_creation', l_e_comp.creation_event);
					this.set('emitter_events_expiration', l_e_comp.expiration_event);
					this.set('emitter_events_timeline', l_e_comp.timeline);
					this.set('emitter_events_distance', l_e_comp.travel_distance_events);
					this.set('emitter_events_distance_looping', l_e_comp.looping_travel_distance_events);
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

				if (comp('particle_initialization')) {
					var up_v = comp('particle_initialization').per_update_expression;
					var rd_v = comp('particle_initialization').per_render_expression;
					if (typeof up_v == 'string') {
						this.particle_update_expression = up_v.replace(/;+$/, '').split(';');
					}
					if (typeof rd_v == 'string') {
						this.particle_render_expression = rd_v.replace(/;+$/, '').split(';');
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
					//this.set('particle_motion_mode', 'dynamic');
					let linear_acceleration = comp('particle_motion_dynamic').linear_acceleration;
					let linear_drag_coefficient = comp('particle_motion_dynamic').linear_drag_coefficient;
					let rotation_acceleration = comp('particle_motion_dynamic').rotation_acceleration;
					let rotation_drag_coefficient = comp('particle_motion_dynamic').rotation_drag_coefficient;

					if (linear_acceleration != undefined || linear_drag_coefficient != undefined) {
						this.set('particle_motion_mode', 'dynamic');
						this.set('particle_motion_linear_acceleration', linear_acceleration);
						this.set('particle_motion_linear_drag_coefficient', linear_drag_coefficient);
						this.set('particle_motion_linear_speed', 1);
					}
					if (linear_acceleration != undefined || linear_drag_coefficient != undefined) {
						this.set('particle_rotation_mode', 'dynamic');
						this.set('particle_rotation_rotation_acceleration', rotation_acceleration);
						this.set('particle_rotation_rotation_drag_coefficient', rotation_drag_coefficient);
					}
				} else {
					this.set('particle_motion_mode', 'static');
				}
				if (comp('particle_motion_parametric')) {
					let relative_position = comp('particle_motion_parametric').relative_position;
					let direction = comp('particle_motion_parametric').direction;
					let rotation = comp('particle_motion_parametric').rotation;

					if (relative_position != undefined || direction != undefined) {
						this.set('particle_motion_mode', 'parametric');
						this.set('particle_motion_relative_position', relative_position);
						this.set('particle_motion_direction', direction);
					}
					if (rotation != undefined) {
						this.set('particle_rotation_mode', 'parametric');
						this.set('particle_rotation_rotation', rotation);
					}
				}



				this.set('particle_collision_toggle', comp('particle_motion_collision') != undefined);
				if (comp('particle_motion_collision')) {
					this.set('particle_collision_enabled', comp('particle_motion_collision').enabled);
					this.set('particle_collision_collision_drag', comp('particle_motion_collision').collision_drag);
					this.set('particle_collision_coefficient_of_restitution', comp('particle_motion_collision').coefficient_of_restitution);
					this.set('particle_collision_collision_radius', comp('particle_motion_collision').collision_radius);
					this.set('particle_collision_expire_on_contact', comp('particle_motion_collision').expire_on_contact);
					if (comp('particle_motion_collision').events) {
						let events = comp('particle_motion_collision').events;
						if (events instanceof Array) {
							this.set('particle_collision_events', events);
						} else if (typeof events == 'object') {
							this.set('particle_collision_events', [events]);
						}
					}
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
					this.set('particle_lifetime_max_lifetime', comp('particle_lifetime_expression').max_lifetime || '');
					this.set('particle_lifetime_expiration_expression', comp('particle_lifetime_expression').expiration_expression || 0);
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

					var {direction, uv} = comp('particle_appearance_billboard');

					if (direction) {
						this.set('particle_appearance_direction_mode', direction.mode);
						this.set('particle_appearance_speed_threshold', direction.min_speed_threshold);
						this.set('particle_appearance_direction', direction.custom_direction);
					}

					if (uv) {
						if (uv.texture_width) {
							this.set('particle_texture_size', [uv.texture_width, uv.texture_height]);
						}
						if (uv.flipbook) {
							this.set('particle_texture_mode', 'animated');
							this.set('particle_texture_uv', uv.flipbook.base_UV);
							this.set('particle_texture_uv_size', uv.flipbook.size_UV);
							this.set('particle_texture_uv_step', uv.flipbook.step_UV);
							this.set('particle_texture_frames_per_second', uv.flipbook.frames_per_second);
							this.set('particle_texture_max_frame', uv.flipbook.max_frame);
							this.set('particle_texture_stretch_to_lifetime', uv.flipbook.stretch_to_lifetime);
							this.set('particle_texture_loop', uv.flipbook.loop);
						} else if (uv.texture_width == 1 && uv.texture_height == 1 && uv.uv && !uv.uv[0] && !uv.uv[1] && uv.uv_size && uv.uv_size[0] == 1 && uv.uv_size[1] == 1) {
							this.set('particle_texture_mode', 'full');
							this.set('particle_texture_uv', uv.uv);
							this.set('particle_texture_uv_size', uv.uv_size);
						} else {
							this.set('particle_texture_mode', 'static');
							this.set('particle_texture_uv', uv.uv);
							this.set('particle_texture_uv_size', uv.uv_size);
						}
					} else {
						this.set('particle_texture_mode', 'full');
					}
				}
				if (comp('particle_appearance_lighting')) {
					this.set('particle_color_light', true);
				}
				if (comp('particle_appearance_tinting')) {
					var c = comp('particle_appearance_tinting').color;

					if (typeof c == 'string') {
						this.set('particle_color_static', parseColor(c));

					} else if (c instanceof Array && c.length >= 3) {
						if ((typeof c[0] + typeof c[1] + typeof c[2] + typeof c[3]).includes('string')) {
							this.set('particle_color_mode', 'expression');
							this.set('particle_color_expression', c);

						} else {
							this.set('particle_color_mode', 'static');
							
							var color = new tinycolor__default['default']({
								r: c[0] * 255,
								g: c[1] * 255,
								b: c[2] * 255,
								a: c[3],
							}).toHex8String();
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
							this.set('particle_color_range', max_time);
							for (var time in c.gradient) {
								var color = parseColor(c.gradient[time]);
								var percent = (parseFloat(time) / max_time) * 100;
								gradient_points.push({color, percent});
							}
						}
						this.set('particle_color_gradient', gradient_points);
					}
				}
				if (comp('particle_lifetime_events')) {
					let l_e_comp = comp('particle_lifetime_events');
					this.set('particle_events_creation', l_e_comp.creation_event);
					this.set('particle_events_expiration', l_e_comp.expiration_event);
					this.set('particle_events_timeline', l_e_comp.timeline);
				}
			}

			this.updateTexture();
			return this;
		}
		updateTexture() {

			let continueLoading = url => {
				if (!url) {
					switch (this.particle_texture_path) {
						case 'textures/particle/particles':
							url = img$1;
							this.texture_source_category = 'built_in';
							break;
						case 'textures/flame_atlas': case 'textures/particle/flame_atlas':
							url = img$2;
							this.texture_source_category = 'built_in';
							break;
						case 'textures/particle/soul':
							url = img$3;
							this.texture_source_category = 'built_in';
							break;
						case 'textures/particle/campfire_smoke':
							url = img$4;
							this.texture_source_category = 'built_in';
							break;
						default:
							url = img;
							this.texture_source_category = 'placeholder';
							break;
					}
				} else {
					this.texture_source_category = 'loaded';
				}
				this.texture.image.src = url;
			};

			if (typeof this.scene.fetchTexture == 'function') {
				let result = this.scene.fetchTexture(this);
				if (result instanceof Promise) {
					result.then(result2 => {
						continueLoading(result2);
					});
				} else {
					continueLoading(result);
				}
			} else {
				continueLoading();
			}
			return this;
		}
	}
	Config.types = {

		identifier: {type: 'string'},
		file_path: {type: 'string'},
		events: {type: 'object'},
		curves: {type: 'object'},
		space_local_position: {type: 'boolean'},
		space_local_rotation: {type: 'boolean'},
		space_local_velocity: {type: 'boolean'},
		variables_creation_vars: {type: 'string', array: true},
		variables_tick_vars: {type: 'string', array: true},
		emitter_rate_mode: {type: 'string'},
		emitter_rate_rate: {type: 'molang'},
		emitter_rate_amount: {type: 'molang'},
		emitter_rate_maximum: {type: 'molang'},
		emitter_lifetime_mode: {type: 'string'},
		emitter_lifetime_active_time: {type: 'molang'},
		emitter_lifetime_sleep_time: {type: 'molang'},
		emitter_lifetime_activation: {type: 'molang'},
		emitter_lifetime_expiration: {type: 'molang'},
		emitter_events_creation: {type: 'string', array: true},
		emitter_events_expiration: {type: 'string', array: true},
		emitter_events_distance: {type: 'object'},
		emitter_events_distance_looping: {type: 'object', array: true},
		emitter_events_timeline: {type: 'object'},
		emitter_shape_mode: {type: 'string'},
		emitter_shape_offset: {type: 'molang', array: true, dimensions: 3},
		emitter_shape_radius: {type: 'molang'},
		emitter_shape_half_dimensions: {type: 'molang', array: true, dimensions: 3},
		emitter_shape_plane_normal: {type: 'molang', array: true, dimensions: 3},
		emitter_shape_surface_only: {type: 'boolean'},
		particle_appearance_size: {type: 'molang', array: true, dimensions: 2},
		particle_appearance_material: {type: 'string'},
		particle_appearance_facing_camera_mode: {type: 'string'},
		particle_appearance_direction_mode: {type: 'string'},
		particle_appearance_speed_threshold: {type: 'number'},
		particle_appearance_direction: {type: 'molang', array: true, dimensions: 3},
		particle_update_expression: {type: 'string', array: true},
		particle_render_expression: {type: 'string', array: true},
		particle_direction_mode: {type: 'string'},
		particle_direction_direction: {type: 'molang', array: true, dimensions: 3},
		particle_motion_mode: {type: 'string'},
		particle_motion_linear_speed: {type: 'molang'},
		particle_motion_linear_acceleration: {type: 'molang', array: true, dimensions: 3},
		particle_motion_linear_drag_coefficient: {type: 'molang'},
		particle_motion_relative_position: {type: 'molang', array: true, dimensions: 3},
		particle_motion_direction: {type: 'molang', array: true, dimensions: 3},
		particle_rotation_mode: {type: 'string'},
		particle_rotation_initial_rotation: {type: 'molang'},
		particle_rotation_rotation_rate: {type: 'molang'},
		particle_rotation_rotation_acceleration: {type: 'molang'},
		particle_rotation_rotation_drag_coefficient: {type: 'molang'},
		particle_rotation_rotation: {type: 'molang'},
		particle_lifetime_max_lifetime: {type: 'molang'},
		particle_lifetime_kill_plane: {type: 'number', array: true, dimensions: 4},
		particle_lifetime_expiration_expression: {type: 'molang'},
		particle_lifetime_expire_in: {type: 'string', array: true},
		particle_lifetime_expire_outside: {type: 'string', array: true},
		particle_texture_size: {type: 'number', array: true, dimensions: 2},
		particle_texture_height: {type: 'number'},
		particle_texture_path: {type: 'string'},
		particle_texture_mode: {type: 'string'},
		particle_texture_uv: {type: 'molang', array: true, dimensions: 2},
		particle_texture_uv_size: {type: 'molang', array: true, dimensions: 2},
		particle_texture_uv_step: {type: 'molang', array: true, dimensions: 2},
		particle_texture_frames_per_second: {type: 'number'},
		particle_texture_max_frame: {type: 'molang'},
		particle_texture_stretch_to_lifetime: {type: 'boolean'},
		particle_texture_loop: {type: 'boolean'},
		particle_color_mode: {type: 'string'},
		particle_color_static: {type: 'color'},
		particle_color_interpolant: {type: 'molang'},
		particle_color_range: {type: 'number'},
		particle_color_gradient: {type: 'object', array: true},
		particle_color_expression: {type: 'molang', array: true, dimensions: 4},
		particle_color_light: {type: 'boolean'},
		particle_collision_toggle: {type: 'boolean'},
		particle_collision_enabled: {type: 'molang'},
		particle_collision_collision_drag: {type: 'number'},
		particle_collision_coefficient_of_restitution: {type: 'number'},
		particle_collision_collision_radius: {type: 'number'},
		particle_collision_expire_on_contact: {type: 'boolean'},
		particle_collision_events: {type: 'object', array: true},
		particle_events_creation: {type: 'string', array: true},
		particle_events_expiration: {type: 'string', array: true},
		particle_events_timeline: {type: 'object'},
	};
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
			return new THREE.Euler(
				MathUtil.randomab(-Math.PI, Math.PI),
				MathUtil.randomab(-Math.PI, Math.PI),
				MathUtil.randomab(-Math.PI, Math.PI)
			)
		}
	};

	function getRandomFromWeightedList(list) {
		let total_weight = list.reduce((sum, option) => sum + option.weight || 1, 0);
		let random_value = Math.random() * total_weight;
		let cumulative_weight = 0;
		for (let option of list) {
			cumulative_weight += (option.weight || 1);
			if (random_value <= cumulative_weight) {
				return option;
			}
		}
	}

	const Normals = {
		x: new THREE.Vector3(1, 0, 0),
		y: new THREE.Vector3(0, 1, 0),
		z: new THREE.Vector3(0, 0, 1),
		n: new THREE.Vector3(0, 0, 0),
	};

	function removeFromArray(array, item) {
		let index = array.indexOf(item);
		if (index >= 0) {
			array.splice(index, 1);
		}
	}

	const defaultColor = {r: 255, r: 255, b: 255, a: 1};
	const collisionPlane = new THREE.Plane().setComponents(0, 1, 0, 0);

	function calculateGradient(gradient, percent) {
		let index = 0;
		gradient.forEach((point, i) => {
			if (point.percent <= percent) index = i;
		});
		if (gradient[index] && !gradient[index+1]) {
			return tinycolor__default['default'](gradient[index].color).toRgb();

		} else if (!gradient[index] && gradient[index+1]) {
			return tinycolor__default['default'](gradient[index+1].color).toRgb();

		} else if (gradient[index] && gradient[index+1]) {
			// Interpolate
			var mix = (percent - gradient[index].percent) / (gradient[index+1].percent - gradient[index].percent);
			return tinycolor__default['default'].mix(gradient[index].color, gradient[index+1].color, mix*100).toRgb()

		} else {
			return defaultColor;
		}
	}


	class Particle {
		constructor(emitter) {
			this.emitter = emitter;

			this.geometry = new THREE.PlaneGeometry(2, 2);
			this.material = this.emitter.material;
			this.mesh = new THREE.Mesh(this.geometry, this.material);
			this.position = this.mesh.position;
			
			let colors = new Float32Array(16).fill(1);
			this.geometry.setAttribute('clr', new THREE.BufferAttribute(colors, 4));

			this.speed = new THREE.Vector3();
			this.acceleration = new THREE.Vector3();
			this.facing_direction = new THREE.Vector3();

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
				this.emitter.getActiveSpace().add(this.mesh);
			}

			this.age = this.loop_time = 0;
			this.current_frame = 0;
			this.random_vars = [Math.random(), Math.random(), Math.random(), Math.random()];
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
				var size = new THREE.Vector3(0.5, 1, 0.5);

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
					var q = new THREE.Quaternion().setFromUnitVectors(Normals.y, normal);
					this.position.applyQuaternion(q);
				}
			}
			//Speed
			this.speed.set(0, 0, 0);
			var dir = this.emitter.config.particle_direction_mode;
			if (dir == 'outwards' && this.emitter.inherited_particle_speed) {
				this.speed.copy(this.emitter.inherited_particle_speed);

			} else {
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
				let linear_speed = this.emitter.calculate(this.emitter.config.particle_motion_linear_speed, params);
				this.speed.x *= linear_speed;
				this.speed.y *= linear_speed;
				this.speed.z *= linear_speed;
			}

			this.position.add(this.emitter.calculate(this.emitter.config.emitter_shape_offset, params));

			if (this.emitter.parent_mode == 'locator') {
				this.position.x *= -1;
				this.position.y *= -1;
				this.speed.x *= -1;
				this.speed.y *= -1;
			}
			if (this.emitter.parent_mode != 'world' && this.emitter.config.space_local_position && !this.emitter.config.space_local_rotation) {
				this.speed.x *= -1;
				this.speed.z *= -1;
			}
			
			if (this.emitter.config.emitter_shape_mode === 'entity_aabb') {
				this.position.x += 1;
			}

			if (this.emitter.local_space.parent) {
				if (this.emitter.parent_mode == 'locator') {
					this.speed.applyQuaternion(this.emitter.local_space.getWorldQuaternion(new THREE.Quaternion()));
				}
				if (!this.emitter.config.space_local_rotation) {
					this.position.applyQuaternion(this.emitter.local_space.getWorldQuaternion(new THREE.Quaternion()));
				}
				if (!this.emitter.config.space_local_position) {
					let offset = this.emitter.local_space.getWorldPosition(new THREE.Vector3());
					this.position.addScaledVector(offset, 1/this.emitter.scene.global_options._scale);
				}
			}

			//UV
			this.setFrame(0);

			// Creation event
			for (let event of this.emitter.config.particle_events_creation) {
				this.emitter.runEvent(event, this);
			}

			return this.tick();
		}
		tick(jump) {
			var params = this.params();
			let step = 1 / this.emitter.scene.global_options.tick_rate;

			for (var entry of this.emitter.config.particle_render_expression) {
				this.emitter.Molang.parse(entry, params);
			}

			//Lifetime
			this.age += step;
			this.loop_time += step;
			if (this.lifetime && this.age > this.lifetime) {
				this.expire();
			}
			if (this.emitter.calculate(this.emitter.config.particle_lifetime_expiration_expression, params)) {
				this.expire();
			}
			
			//Movement
			if (this.emitter.config.particle_motion_mode === 'dynamic') {
				//Position
				var drag = this.emitter.calculate(this.emitter.config.particle_motion_linear_drag_coefficient, params);
				this.acceleration.copy(this.emitter.calculate(this.emitter.config.particle_motion_linear_acceleration, params));
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
				this.speed.addScaledVector(this.acceleration, step);
				this.position.addScaledVector(this.speed, step);

				if (this.emitter.config.particle_lifetime_kill_plane.find(v => v)) {
					// Kill Plane
					var plane = this.emitter.calculate(this.emitter.config.particle_lifetime_kill_plane, params);
					var start_point = new THREE.Vector3().copy(this.position).addScaledVector(this.speed, -step);
					var end_point = new THREE.Vector3().copy(this.position);
					if (this.emitter.config.space_local_position && this.emitter.parent_mode == 'locator') {
						start_point.x *= -1;
						start_point.y *= -1;
						end_point.x *= -1;
						end_point.y *= -1;
					}
					var line = new THREE.Line3(start_point, end_point);
					if (plane.intersectsLine(line)) {
						this.expire();
						return this;
					}
				}
				if (
					this.emitter.ground_collision && this.emitter.config.particle_collision_toggle &&
					(!this.emitter.config.particle_collision_enabled || this.emitter.calculate(this.emitter.config.particle_collision_enabled, params))
				) {
					// Collision
					let drag = this.emitter.config.particle_collision_collision_drag;
					let bounce = this.emitter.config.particle_collision_coefficient_of_restitution;
					let radius = Math.max(this.emitter.config.particle_collision_collision_radius, 0.0001);

					let plane = collisionPlane;
					let sphere = new THREE.Sphere(this.position, radius);
					let previous_pos = new THREE.Vector3().copy(this.position).addScaledVector(this.speed, -step);
					let line = new THREE.Line3(previous_pos, this.position);

					let intersects_line = plane.intersectsLine(line);
					if (intersects_line) {
						plane.intersectLine(line, this.position);
					}

					if (intersects_line || plane.intersectsSphere(sphere)) {
						// Collide
						if (this.emitter.config.particle_collision_events.length) {
							let speed = this.speed.length();
							for (let event of this.emitter.config.particle_collision_events) {
								if (typeof event != 'object' || !event.event) continue;
								if (event.min_speed && event.min_speed > speed) continue;
								this.emitter.runEvent(event.event, this);
							}
						}
						if (this.emitter.config.particle_collision_expire_on_contact) {
							this.expire();
							return this;
						}
						this.position.y = radius * Math.sign(previous_pos.y);

						this.speed.reflect(plane.normal);
						this.speed.y *= bounce;
						this.speed.x = Math.sign(this.speed.x) * MathUtil.clamp(Math.abs(this.speed.x) - drag * step, 0, Infinity);
						this.speed.z = Math.sign(this.speed.z) * MathUtil.clamp(Math.abs(this.speed.z) - drag * step, 0, Infinity);
					}
				}

			} else if (this.emitter.config.particle_motion_mode === 'parametric' && !jump) {
				if (this.emitter.config.particle_motion_relative_position.join('').length) {
					this.position.copy(this.emitter.calculate(this.emitter.config.particle_motion_relative_position, params));
				}
				if (this.emitter.config.particle_motion_direction.join('').length) {
					this.speed.copy(this.emitter.calculate(this.emitter.config.particle_motion_direction, params));
				}
				if (this.emitter.config.space_local_position) {
					if (this.emitter.parent_mode == 'locator') {
						this.position.x *= -1;
						this.position.y *= -1;
					}
				}
			}

			// Rotation
			if (this.emitter.config.particle_rotation_mode === 'dynamic') {
				var rot_drag = this.emitter.calculate(this.emitter.config.particle_rotation_rotation_drag_coefficient, params);
				var rot_acceleration = this.emitter.calculate(this.emitter.config.particle_rotation_rotation_acceleration, params);
					rot_acceleration += -rot_drag * this.rotation_rate;
				this.rotation_rate += rot_acceleration*step;
				this.rotation = MathUtil.degToRad(this.initial_rotation + this.rotation_rate*this.age);

			} else if (this.emitter.config.particle_rotation_mode === 'parametric') {

				this.rotation = MathUtil.degToRad(this.emitter.calculate(this.emitter.config.particle_rotation_rotation, params));
			}
			
			// Facing Direction
			if (this.emitter.config.particle_appearance_facing_camera_mode.substr(0, 9) == 'direction' || this.emitter.config.particle_appearance_facing_camera_mode == 'lookat_direction') {
				if (this.emitter.config.particle_appearance_direction_mode == 'custom') {
					this.facing_direction.copy(this.emitter.calculate(this.emitter.config.particle_appearance_direction, params)).normalize();

				} else if (this.speed.length() >= (this.emitter.config.particle_appearance_speed_threshold || 0.01)) {
					this.facing_direction.copy(this.speed).normalize();
				}
			}

			if (!jump) {
				//Size
				var size = this.emitter.calculate(this.emitter.config.particle_appearance_size, params);
				this.mesh.scale.x = size.x || 0.0001;
				this.mesh.scale.y = size.y || 0.0001;


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
						if (max_frame && this.current_frame >= max_frame) {
							if (this.emitter.config.particle_texture_loop) {
								this.current_frame = 0;
								this.loop_time = 0;
								this.setFrame(0);
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
					this.setColor(c.r/255, c.g/255, c.b/255, c.a);

				} else {
					var c = tinycolor__default['default'](this.emitter.config.particle_color_static).toRgb();
					this.setColor(c.r/255, c.g/255, c.b/255, c.a);
				}
			}

			// Event timeline
			for (let key in this.emitter.config.particle_events_timeline) {
				let time = parseFloat(key);
				if (time > this.age - step && time <= this.age) {
					this.emitter.runEvent(this.emitter.config.particle_events_timeline[key], this);
				}
			}

			return this;
		}
		expire() {
			for (let event_id of this.emitter.config.particle_events_expiration) {
				this.emitter.runEvent(event_id, this);
			}
			this.remove();
		}
		remove() {
			removeFromArray(this.emitter.particles, this);
			if (this.mesh.parent) this.mesh.parent.remove(this.mesh);
			this.emitter.dead_particles.push(this);
			return this;
		}
		delete() {
			if (this.mesh.parent) this.mesh.parent.remove(this.mesh);
			this.geometry.dispose();
		}
		setColor(r, g, b, a = 1) {
			let attribute = this.geometry.getAttribute('clr');
			attribute.array.set([
				r, g, b, a,
				r, g, b, a,
				r, g, b, a,
				r, g, b, a,
			]);
			attribute.needsUpdate = true;
		}
		setFrame(n) {
			if (this.emitter.config.particle_texture_mode === 'full') {
				this.setUV(0, 0, this.emitter.config.particle_texture_size[0], this.emitter.config.particle_texture_size[1]);
				return;
			}
			var params = this.params();
			var uv = this.emitter.calculate(this.emitter.config.particle_texture_uv, params);
			var size = this.emitter.calculate(this.emitter.config.particle_texture_uv_size, params);
			if (n) {
				var offset = this.emitter.calculate(this.emitter.config.particle_texture_uv_step, params);
				uv.addScaledVector(offset, n);
			}
			this.setUV(uv.x, uv.y, size.x||this.emitter.config.particle_texture_size[0], size.y||this.emitter.config.particle_texture_size[1]);
		}
		setUV(x, y, w, h) {
			var epsilon = 0.0;
			let attribute = this.geometry.getAttribute('uv');

			w = (x+w - 2*epsilon) / this.emitter.config.particle_texture_size[0];
			h = (y+h - 2*epsilon) / this.emitter.config.particle_texture_size[1];
			x = (x + (w>0 ? epsilon : -epsilon)) / this.emitter.config.particle_texture_size[0];
			y = (y + (h>0 ? epsilon : -epsilon)) / this.emitter.config.particle_texture_size[1];

			attribute.array.set([
				x, 1-y,
				w, 1-y,
				x, 1-h,
				w, 1-h,
			]);
			attribute.needsUpdate = true;
		}
	}
	Wintersky.Particle = Particle;

	var vertexShader = "#define GLSLIFY 1\nattribute vec4 clr;varying vec2 vUv;varying vec4 vColor;void main(){vColor=clr;vUv=uv;vec4 mvPosition=modelViewMatrix*vec4(position,1.0);gl_Position=projectionMatrix*mvPosition;}"; // eslint-disable-line

	var fragmentShader = "#define GLSLIFY 1\nvarying vec2 vUv;varying vec4 vColor;uniform sampler2D map;uniform int materialType;void main(void){vec4 tColor=texture2D(map,vUv);if(materialType==0){if(tColor.a<0.5)discard;tColor.a=1.0;}else if(materialType==1){tColor.a=1.0;}else{tColor.a=tColor.a*vColor.a;}gl_FragColor=vec4(tColor.rgb*vColor.rgb,tColor.a);}"; // eslint-disable-line

	class EventClass {
		constructor() {
			this.events = {};
		}
		dispatchEvent(event_name, data) {
			var list = this.events[event_name];
			if (!list) return;
			for (var i = 0; i < list.length; i++) {
				if (typeof list[i] === 'function') {
					list[i](data);
				}
			}
		}
		on(event_name, cb) {
			if (!this.events[event_name]) {
				this.events[event_name] = [];
			}
			this.events[event_name].push(cb);
		}
		removeEventListener(event_name, cb) {
			if (this.events[event_name]) {
				removeFromArray(this.events[event_name], cb);
			}
		}
	}

	const dummy_vec = new THREE.Vector3();
	const dummy_object = new THREE.Object3D();
	const materialTypes = ['particles_alpha', 'particles_opaque', 'particles_blend', 'particles_add'];


	function createCurveSpline(curve) {
		switch (curve.mode) {
			case 'catmull_rom':
				var vectors = [];
				curve.nodes.forEach((val, i) => {
					vectors.push(new THREE.Vector2(i-1, val));
				});
				return new THREE.SplineCurve(vectors);
			case 'bezier':
				var vectors = [];
				curve.nodes.forEach((val, i) => {
					vectors.push(new THREE.Vector2(i/3, val));
				});
				return new THREE.CubicBezierCurve(...vectors);
		}
	}
	function calculateCurve(emitter, curve, curve_key, params) {

		var position = emitter.Molang.parse(curve.input, params);
		var range = emitter.Molang.parse(curve.range, params);
		if (curve.mode == 'bezier_chain') range = 1;

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
			let spline = emitter._cached_curves[curve_key];
			if (!spline) {
				spline = emitter._cached_curves[curve_key] = createCurveSpline(curve);
			}
			var segments = curve.nodes.length-3;
			position *= segments;
			var pso = (position+1)/(segments+2);
			return spline.getPoint(pso).y;

		} else if (curve.mode == 'bezier') {

			let spline = emitter._cached_curves[curve_key];
			if (!spline) {
				spline = emitter._cached_curves[curve_key] = createCurveSpline(curve);
			}
			return spline.getPoint(position).y;

		} else if (curve.mode == 'bezier_chain') {
			
			let sorted_nodes = curve.nodes.slice().sort((a, b) => a.time - b.time);
			let i = 0;
			while (i < sorted_nodes.length) {
				if (sorted_nodes[i].time > position) break;
				i++;
			}
			let before = sorted_nodes[i-1];
			let after = sorted_nodes[i];

			if (!before) before = {time: 0, right_value: 0, right_slope: 0};
			if (!after)  after  = {time: 1, right_value: 0, right_slope: 0};

			let time_diff = after.time - before.time;
			var vectors = [
				new THREE.Vector2(before.time + time_diff * (0/3), before.right_value),
				new THREE.Vector2(before.time + time_diff * (1/3), before.right_value + before.right_slope * (1/3)),
				new THREE.Vector2(before.time + time_diff * (2/3), after.left_value - after.left_slope * (1/3)),
				new THREE.Vector2(before.time + time_diff * (3/3), after.left_value),
			];
			var spline = new THREE.CubicBezierCurve(...vectors);

			return spline.getPoint((position-before.time) / time_diff).y;
		}
	}

	class Emitter extends EventClass {
		constructor(scene, config, options = 0) {
			super();
			this.scene = scene;
			this.child_emitters = [];
			scene.emitters.push(this);

			this.config = config instanceof Config ? config : new Config(scene, config, options);

			this.Molang = new Molang__default['default']();
			this.Molang.variableHandler = (key, params) => {
				return this.config.curves[key] && calculateCurve(this, this.config.curves[key], key, params);
			};

			let global_scale = scene.global_options._scale;
			this.local_space = new THREE.Object3D();
			this.local_space.scale.set(global_scale, global_scale, global_scale);
			this.global_space = new THREE.Object3D();
			this.global_space.scale.set(global_scale, global_scale, global_scale);
			this.material = new THREE.ShaderMaterial({
				uniforms: {
					map: {
						type: 't',
						value: this.config.texture
					},
					materialType: {
						type: 'int',
						value: 1
					}
				},
				vertexShader,
				fragmentShader,
				vertexColors: true,
				transparent: true,
				alphaTest: 0.2
			});

			this.particles = [];
			this.dead_particles = [];
			this.creation_time = 0;
			this.parent_emitter = null;
			this.age = 0;
			this.view_age = 0;
			this.enabled = false;
			this.loop_mode = options.loop_mode || scene.global_options.loop_mode;
			this.parent_mode = options.parent_mode || scene.global_options.parent_mode;
			this.ground_collision = typeof options.ground_collision == 'boolean' ? options.ground_collision : scene.global_options.ground_collision;
			this.inherited_particle_speed = null;
			this.pre_effect_expression = null;
			this.random_vars = [Math.random(), Math.random(), Math.random(), Math.random()];
			this.tick_values = {};
			this.creation_values = {};
			this._cached_curves = {};

			this.updateMaterial();
		}
		getActiveSpace() {
			if (this.config.space_local_position && this.local_space.parent) {
				// Add the particle to the local space object if local space is enabled and used
				return this.local_space;
			} else {
				// Otherwise add to global space
				return this.global_space;
			}
		}
		clone() {
			let clone = new Wintersky.Emitter(this.scene, this.config);
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
					data = new THREE.Plane().setComponents(
						getV(input[0]),
						getV(input[1]),
						getV(input[2]),
						getV(input[3])
					);
				} else if (input.length === 3) {
					data = new THREE.Vector3(
						getV(input[0]),
						getV(input[1]),
						getV(input[2])
					);
				} else if (input.length === 2) {
					data = new THREE.Vector2(
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
		updateFacingRotation(camera) {
			if (this.particles.length == 0) return;

			const quat = new THREE.Quaternion();
			const vec = new THREE.Vector3();

			let world_quat_inverse;
			if (this.config.particle_appearance_facing_camera_mode.substring(0, 6) == 'rotate' || true) {
				world_quat_inverse = this.particles[0].mesh.parent.getWorldQuaternion(quat).invert();
			}

			this.particles.forEach(p => {

				if (this.config.particle_appearance_facing_camera_mode.substring(0, 9) == 'direction') {
					if (p.mesh.rotation.order !== 'YXZ') {
						p.mesh.rotation.order = 'YXZ';
					}
					vec.copy(p.facing_direction);
					
					if (vec.y == 1) {
						vec.y = -1;
					} else if (vec.y == -1) {
						vec.y = 1;
						vec.z = -0.00001;
					}
				}
				if (this.config.particle_appearance_facing_camera_mode == 'lookat_direction') {
					if (p.mesh.rotation.order !== 'XYZ') {
						p.mesh.rotation.order = 'XYZ';
					}
					vec.copy(p.facing_direction);
				}

				switch (this.config.particle_appearance_facing_camera_mode) {
					case 'lookat_xyz':
						p.mesh.lookAt(camera.position);
						break;
					case 'lookat_y':
						var v = vec.copy(camera.position);
						dummy_vec.set(0, 0, 0);
						p.mesh.localToWorld(dummy_vec);
						v.y = dummy_vec.y;
						p.mesh.lookAt(v);
						break;
					case 'rotate_xyz':
						p.mesh.rotation.copy(camera.rotation);
						p.mesh.quaternion.premultiply(world_quat_inverse);
						break;
					case 'rotate_y':
						p.mesh.rotation.copy(camera.rotation);
						p.mesh.rotation.reorder('YXZ');
						p.mesh.rotation.x = p.mesh.rotation.z = 0;
						p.mesh.quaternion.premultiply(world_quat_inverse);
						break;
					case 'direction_x':
						var y = Math.atan2(vec.x, vec.z);
						var z = Math.atan2(vec.y, Math.sqrt(Math.pow(vec.x, 2) + Math.pow(vec.z, 2)));
						p.mesh.rotation.set(0, y - Math.PI/2, z);
						break;
					case 'direction_y':
						var y = Math.atan2(vec.x, vec.z);
						var x = Math.atan2(vec.y, Math.sqrt(Math.pow(vec.x, 2) + Math.pow(vec.z, 2)));
						p.mesh.rotation.set(x - Math.PI/2, y - Math.PI, 0);
						break;
					case 'direction_z':
						var y = Math.atan2(vec.x, vec.z);
						var x = Math.atan2(vec.y, Math.sqrt(Math.pow(vec.x, 2) + Math.pow(vec.z, 2)));
						p.mesh.rotation.set(-x, y, 0);
						break;
					case 'lookat_direction':
						dummy_object.position.copy(p.mesh.position);
						dummy_object.quaternion.setFromUnitVectors(Normals.x, vec);
						vec.copy(camera.position);
						p.mesh.parent.add(dummy_object);
						dummy_object.updateMatrixWorld();
						dummy_object.worldToLocal(vec);
						p.mesh.parent.remove(dummy_object);
						p.mesh.rotation.set(Math.atan2(-vec.y, vec.z), 0, 0, 'XYZ');
						p.mesh.quaternion.premultiply(dummy_object.quaternion);
						break;
					case 'emitter_transform_xy':
						p.mesh.rotation.set(0, 0, 0);
						break;
					case 'emitter_transform_xz':
						p.mesh.rotation.set(-Math.PI/2, 0, 0);
						break;
					case 'emitter_transform_yz':
						p.mesh.rotation.set(0, Math.PI/2, 0);
						break;
				}
				p.mesh.rotation.z += p.rotation||0;
			});
		}

		// Controls
		start() {
			this.age = 0;
			this.view_age = 0;
			this.enabled = true;
			this.initialized = true;
			this.scene.space.add(this.global_space);
			let params = this.params();
			this.Molang.resetVariables();
			this.active_time = this.calculate(this.config.emitter_lifetime_active_time, params);
			this.sleep_time = this.calculate(this.config.emitter_lifetime_sleep_time, params);
			this.random_vars = [Math.random(), Math.random(), Math.random(), Math.random()];
			this.creation_values = {};

			for (var line of this.config.variables_creation_vars) {
				this.Molang.parse(line, params);
			}
			if (typeof this.pre_effect_expression == 'string') {
				this.Molang.parse(this.pre_effect_expression, params);
			}

			this.dispatchEvent('start', {params});

			this.updateMaterial();

			for (let event_id of this.config.emitter_events_creation) {
				this.runEvent(event_id);
			}

			if (this.config.emitter_rate_mode === 'instant') {
				this.spawnParticles(this.calculate(this.config.emitter_rate_amount, params));
			} else if (this.config.emitter_rate_mode === 'manual') {
				this.spawnParticles(1);
			}
			return this;
		}
		tick(jump) {
			let params = this.params();
			let { tick_rate } = this.scene.global_options;
			let step = 1/tick_rate;
			this._cached_curves = {};

			// Calculate tick values
			for (var line of this.config.variables_tick_vars) {
				this.Molang.parse(line, params);
			}
			if (this.config.particle_update_expression.length) {
				this.particles.forEach(p => {
					let particle_params = p.params();
					for (var entry of this.config.particle_update_expression) {
						this.Molang.parse(entry, particle_params);
					}
				});
			}
			this.dispatchEvent('tick', {params});

			// Material
			if (!jump) {
				this.updateMaterial();
			}
			// Tick particles
			this.particles.forEach(p => {
				p.tick(jump);
			});

			this.age += step;
			this.view_age += step;

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
			this.dispatchEvent('ticked', {params, tick_rate});

			// Event timeline
			for (let key in this.config.emitter_events_timeline) {
				let time = parseFloat(key);
				if (time > this.age - step && time <= this.age) {
					this.runEvent(this.config.emitter_events_timeline[key]);
				}
			}

			// Child emitters
			this.child_emitters.slice().forEach(e => {
				e.tick(jump);
			});

			if (this.config.emitter_lifetime_mode === 'expression') {
				//Expressions
				if (this.enabled && this.calculate(this.config.emitter_lifetime_expiration, params)) {
					this.stop();
				}
				if (!this.enabled && this.calculate(this.config.emitter_lifetime_activation, params)) {
					this.start();
				}
			} else if (!this.parent_emitter && (this.loop_mode == 'looping' || (this.loop_mode == 'auto' && this.config.emitter_lifetime_mode == 'looping'))) {
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
			if (this.parent_emitter && this.particles.length == 0 && this.age > this.active_time) {
				removeFromArray(this.parent_emitter.child_emitters, this);
				this.delete();
			}
			return this;
		}
		stop(clear_scene = false) {
			this.enabled = false;
			this.age = 0;
			if (clear_scene) {
				this.particles.slice().forEach(particle => {
					particle.remove();
				});
				this.child_emitters.slice().forEach(e => e.delete());
				this.child_emitters.splice(0);
			}
			this.dispatchEvent('stop', {clear_scene});
			for (let event_id of this.config.emitter_events_expiration) {
				this.runEvent(event_id);
			}
			return this;
		}
		jumpTo(second) {
			let {tick_rate} = this.scene.global_options;
			let old_time = Math.round(this.view_age * tick_rate);
			let new_time = Math.round(second * tick_rate);
			if (this.loop_mode == 'looping' || (this.loop_mode == 'auto' && this.config.emitter_lifetime_mode == 'looping')) {
				new_time = new_time % (Math.round(this.active_time * tick_rate) - 1);
			}
			if (old_time == new_time) return;
			if (new_time < old_time) {
				this.stop(true).start();
			} else if (!this.initialized) {
				this.start();
			}
			let last_view_age = this.view_age;
			while (Math.round(this.view_age * tick_rate) < new_time-1) {
				this.tick(true);
				if (this.view_age <= last_view_age) break;
				last_view_age = this.view_age;
				if (!this.material) return;
			}
			this.tick(false);
			if (!this.material) return;
			this.child_emitters.slice().forEach(e => {
				if (e.creation_time > second) {
					e.delete();
					removeFromArray(this.child_emitters, e);
				}
			});
			return this;
		}
		updateMaterial() {
			let material = this.config.particle_appearance_material;
			this.material.uniforms.materialType.value = materialTypes.indexOf(material);
			this.material.side = (material === 'particles_alpha' || material === 'particles_opaque') ? THREE.FrontSide : THREE.DoubleSide;
			this.material.blending = material === 'particles_add' ? THREE.AdditiveBlending : THREE.NormalBlending;
		}

		// Playback Loop
		playLoop() {
			if (!this.initialized || this.age == 0) {
				this.start();
			}
			this.paused = false;
			clearInterval(this.tick_interval);
			this.tick_interval = setInterval(() => {
				this.tick();
			}, 1000 / this.scene.global_options.tick_rate);
			return this;
		}
		toggleLoop() {
			this.paused = !this.paused;
			if (this.paused) {
				clearInterval(this.tick_interval);
				delete this.tick_interval;
			} else {
				this.playLoop();
			}
			return this;
		}
		stopLoop() {
			clearInterval(this.tick_interval);
			delete this.tick_interval;
			this.stop(true);
			this.paused = true;
			return this;
		}
		
		spawnParticles(count) {
			if (!count) return this;

			if (this.config.emitter_rate_mode == 'steady') {
				var max = this.calculate(this.config.emitter_rate_maximum, this.params())||0;
				max = MathUtil.clamp(max, 0, this.scene.global_options.max_emitter_particles);
				count = MathUtil.clamp(count, 0, max-this.particles.length);
			} else {
				count = MathUtil.clamp(count, 0, this.scene.global_options.max_emitter_particles-this.particles.length);
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
			this.child_emitters.slice().forEach(e => e.delete());
			this.child_emitters.splice(0);
			this.particles.concat(this.dead_particles).forEach(particle => {
				particle.delete();
			});
			this.particles.splice(0, Infinity);
			this.dead_particles.splice(0, Infinity);
			if (this.local_space.parent) this.local_space.parent.remove(this.local_space);
			if (this.global_space.parent) this.global_space.parent.remove(this.global_space);
			removeFromArray(this.scene.emitters, this);
			this.material.dispose();
			delete this.material;
			delete this.parent_emitter;
		}

		// Events
		runEvent(event_id, particle) {
			this.dispatchEvent('event', {event_id, particle});

			let event = this.config.events[event_id];
			let runEventSubpart = async (subpart) => {
				if (subpart.sequence instanceof Array) {
					for (let part2 of subpart.sequence) {
						runEventSubpart(part2);
					}
				}
				if (subpart.randomize instanceof Array) {
					let picked_option = getRandomFromWeightedList(subpart.randomize);
					if (picked_option) runEventSubpart(picked_option);
				}

				// Run event
				if (subpart.expression) {
					this.Molang.parse(subpart.expression, this.params());
				}
				if (subpart.sound_effect) {
					this.dispatchEvent('play_sound', {sound_effect: subpart.sound_effect, particle, event_id});
				}
				if (subpart.particle_effect) {
					let identifier = subpart.particle_effect.effect;
					let config = this.scene.child_configs[identifier];
					if (!this.scene.child_configs[identifier] && this.scene._fetchParticleFile) {
						config = this.scene.child_configs[identifier] = new Config(this.scene);
						let result = this.scene.fetchParticleFile(identifier, this.config, config);
						let loadResult = result => {
							if (!result) return;
							if (result.json) {
								config.file_path = result.file_path;
								config.setFromJSON(result.json || result);
							} else {
								// Backwards compatibility for API change
								config.setFromJSON(result);
							}
						};
						if (result instanceof Promise) {
							loadResult(await result);
						} else if (result) {
							loadResult(result);
						}
					}
					let emitter;
					if (config) {
						emitter = new Emitter(this.scene, config, {});
						emitter.creation_time = this.age;
						emitter.parent_emitter = this;
						emitter.pre_effect_expression = subpart.particle_effect.pre_effect_expression;
						this.child_emitters.push(emitter);

						if (subpart.particle_effect.type == 'emitter_bound') {
							emitter.parent_mode = this.parent_mode;
						} else if (subpart.particle_effect.type == 'particle_with_velocity' && particle) {
							emitter.inherited_particle_speed = new THREE.Vector3().copy(particle.speed);
						}
						let position = new THREE.Vector3();
						if (particle) {
							particle.mesh.getWorldPosition(position);
						} else {
							this.getActiveSpace().getWorldPosition(position);
						}
						if (this.local_space.parent) {
							if (!this.config.space_local_position) {
								let offset = this.local_space.getWorldPosition(new THREE.Vector3());
								position.add(offset);
							}
						}
						emitter.getActiveSpace().position.copy(position);

						emitter.start();
					}
					this.dispatchEvent('play_child_particle', {particle_effect: subpart.particle_effect, config, child_emitter: emitter, event_id});
				}
			};
			if (event) runEventSubpart(event);
		}
	}
	Wintersky.Emitter = Emitter;

	return Wintersky;

})));
