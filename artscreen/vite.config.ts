import {defineConfig, type Plugin} from 'vite';
import preact from '@preact/preset-vite';
function classicScript(): Plugin { return {name:'webos-classic',enforce:'post',transformIndexHtml(html){return html.replace(/<script type="module" crossorigin src="([^"]+)"><\/script>/g,'<script defer src="$1"></script>');}}; }
export default defineConfig({base:'./',plugins:[preact(),classicScript()],build:{target:'chrome79',cssTarget:'chrome79',modulePreload:false,rollupOptions:{output:{format:'iife',entryFileNames:'assets/app.js'}}}});
