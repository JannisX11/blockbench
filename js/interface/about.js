BARS.defineActions(() => {
	new Action('about_window', {
		name: tl('dialog.settings.about') + '...',
		description: `Blockbench ${Blockbench.version}`,
		icon: 'info',
		category: 'blockbench',
		click: function () {
			const data = {
				isApp,
				version_label: Blockbench.version
			};
			jQuery.ajax({
				url: 'https://api.github.com/repos/JannisX11/blockbench/releases/latest',
				cache: false,
				type: 'GET',
				success(release) {
					let v = release.tag_name.replace(/^v/, '');
					if (compareVersions(v, Blockbench.version)) {
						data.version_label = `${Blockbench.version} (${tl('about.version.update_available', [v])})`;
					} else if (compareVersions(Blockbench.version, v)) {
						data.version_label = `${Blockbench.version} (Pre-release)`;
					} else {
						data.version_label = `${Blockbench.version} (${tl('about.version.up_to_date')}😄)`;
					}
				},
				error(err) {}
			})

			new Dialog({
				id: 'about',
				title: 'dialog.settings.about',
				width: 640,
				title_menu: new Menu([
					'settings_window',
					'keybindings_window',
					'theme_window',
					'about_window',
				]),
				buttons: [],
				component: {
					data() {return data},
					template: `
						<div>
							<div class="blockbench_logo" id="about_page_title">
								<img src="assets/logo_text_white.svg" alt="Blockbench" width="340px">
							</div>
							<p>Version <span>{{ version_label }}</span></p>

							<div class="socials">
								<a class="open-in-browser" href="https://blockbench.net">
									<i class="icon icon-blockbench_inverted" style="transform: scale(1.3);"></i>
									<label>${tl('about.links.website')}</label>
								</a>
								<a class="open-in-browser" href="https://twitter.com/blockbench">
									<i class="icon fab fa-twitter" style="color: #1ea6ff;"></i>
									<label>${tl('about.links.twitter')}</label>
								</a>
								<a class="open-in-browser" href="http://discord.blockbench.net">
									<i class="icon fab fa-discord" style="color: #727fff;"></i>
									<label>${tl('about.links.discord')}</label>
								</a>
								<a class="open-in-browser" href="https://youtube.com/Blockbench3D">
									<i class="icon fab fa-youtube" style="color: #ff4444;"></i>
									<label>${tl('about.links.youtube')}</label>
								</a>
								<a class="open-in-browser" href="https://github.com/JannisX11/blockbench">
									<i class="icon fab fa-github" style="color: #dddddd;"></i>
									<label>${tl('about.links.github')}</label>
								</a>
								<a class="open-in-browser" href="https://blockbench.net/wiki">
								<i class="icon material-icons">menu_book</i>
									<label>${tl('about.links.wiki')}</label>
								</a>
							</div>

							<p>${tl('about.created_by')}</p>
							<p style="color: var(--color-subtle_text);">${tl('about.description')}</p>

							<h4>${tl('about.special_thanks')}</h4>
							<ul class="multi_column_list special_thanks_mentions">
								<li>Mojang Studios</li>
								<li>${tl('about.special_thanks.contributors')}</li>
								<li>${tl('about.special_thanks.community_moderators')}</li>
								<li>${tl('about.special_thanks.donators')}</li>
								<li>${tl('about.special_thanks.translators')}</li>
								<li>Wacky</li>
								<li>${tl('about.special_thanks.two_peoples', ['Ewan Howell', 'Lukas'])}</li>
								<li>SirBenet</li>
								<li>${tl('about.special_thanks.two_peoples', ['Sultan Taha', 'Kanno'])}</li>
								<li>${tl('about.special_thanks.community')}</li>
							</ul>

							<h4>${tl('about.resources')}</h4>

							<p style="margin-bottom: 16px" v-if="isApp">${tl('about.resources.powered_by', ['<a class="open-in-browser" href="https://electronjs.org">Electron</a>'])}</p>

							<ul class="multi_column_list">
								<li><a class="open-in-browser" href="https://material.io/icons/">Material Icons</a></li>
								<li><a class="open-in-browser" href="https://fontawesome.com/icons/">Font Awesome</a></li>
								<li><a class="open-in-browser" href="https://electronjs.org">Electron</a></li>
								<li><a class="open-in-browser" href="https://vuejs.org">Vue</a></li>
								<li><a class="open-in-browser" href="https://github.com/weibangtuo/vue-tree">Vue Tree</a></li>
								<li><a class="open-in-browser" href="https://github.com/sagalbot/vue-sortable">Vue Sortable</a></li>
								<li><a class="open-in-browser" href="https://threejs.org">ThreeJS</a></li>
								<li><a class="open-in-browser" href="https://github.com/lo-th/fullik">Full IK</a></li>
								<li><a class="open-in-browser" href="https://github.com/oliver-moran/jimp">Jimp</a></li>
								<li><a class="open-in-browser" href="https://bgrins.github.io/spectrum">Spectrum</a></li>
								<li><a class="open-in-browser" href="https://github.com/stijlbreuk/vue-color-picker-wheel">Vue Color Picker Wheel</a></li>
								<li><a class="open-in-browser" href="https://github.com/jnordberg/gif.js">gif.js</a></li>
								<li><a class="open-in-browser" href="https://stuk.github.io/jszip/">JSZip</a></li>
								<li><a class="open-in-browser" href="https://github.com/rotemdan/lzutf8.js">LZ-UTF8</a></li>
								<li><a class="open-in-browser" href="https://jquery.com">jQuery</a></li>
								<li><a class="open-in-browser" href="https://jqueryui.com">jQuery UI</a></li>
								<li><a class="open-in-browser" href="https://github.com/furf/jquery-ui-touch-punch">jQuery UI Touch Punch</a></li>
								<li><a class="open-in-browser" href="https://github.com/eligrey/FileSaver.js">FileSaver.js</a></li>
								<li><a class="open-in-browser" href="https://peerjs.com">PeerJS</a></li>
								<li><a class="open-in-browser" href="https://github.com/markedjs/marked">Marked</a></li>
								<li><a class="open-in-browser" href="https://prismjs.com">Prism</a></li>
								<li><a class="open-in-browser" href="https://github.com/koca/vue-prism-editor">Vue Prism Editor</a></li>
								<li><a class="open-in-browser" href="https://github.com/JannisX11/molangjs">MolangJS</a></li>
								<li><a class="open-in-browser" href="https://github.com/JannisX11/wintersky">Wintersky</a></li>
							</ul>

							<p style="margin-top: 20px">Published under the <a class="open-in-browser" href="https://github.com/JannisX11/blockbench/blob/master/LICENSE.MD">GPL 3.0 license</a></p>
							<p><a class="open-in-browser" href="https://www.blockbench.net/privacy-policy">${tl('about.privacy_policy')}</a></p>

						</div>`
				}
			}).show()
		}
	})
})
