import model2dMap from '../../assets/maps/model2d.json';
import model3dMap from '../../assets/maps/model3d.json';
import { FLOOR_SHAPES, PLACES, type FloorId } from './nik-map-data';

export type MapMode = '2d' | '3d';
export type MapTheme = 'light' | 'dark';

const compact2dStyle = `html, body, #app, .nik-map-app, .nik-layout, .nik-main { height: 100%; min-height: 0; margin: 0; overflow: hidden; }
.nik-map-app { min-width: 0; }
.nik-layout { display: block; box-shadow: none; }
.nik-sidebar, .nik-topline, .nik-map-heading, .nik-detail, .nik-accuracy, .nik-map-bottom, .nik-map-toolbar > span { display: none; }
.nik-main { padding: 0; }
.nik-canvas-wrap { height: 100%; border: 0; border-radius: 0; box-shadow: none; }
.nik-scroll-viewport { height: 100%; min-height: 0; aspect-ratio: auto; }
.nik-map-toolbar { top: 8px; left: 8px; right: 8px; justify-content: flex-end; }`;

const compact3dStyle = `html, body, #app, .nik-3d-app, .d3-layout, .d3-main { height: 100%; min-height: 0; overflow: hidden; }
.nik-3d-app { min-width: 0; }
.d3-layout { display: block; box-shadow: none; }
.d3-sidebar, .d3-header, .d3-below, .d3-accuracy, .d3-stage-instruction, .d3-rail { display: none; }
.d3-main { padding: 0; }
.d3-stage { height: 100%; border: 0; border-radius: 0; box-shadow: none; }
.d3-viewbox, .d3-svg { width: 100%; height: 100%; min-height: 0; max-width: none; margin: 0; aspect-ratio: auto; }
.d3-stage-controls { top: 8px; right: 8px; }
.d3-stage-bottom { bottom: 8px; left: 8px; right: 8px; }
.d3-explode { height: 30px; padding: 0 8px; font-size: 9px !important; }`;

const sharedMapThemeStyle = `.nik-map-app, .nik-3d-app { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
.nik-canvas-wrap, .d3-stage { background: var(--map-canvas); border-color: var(--map-border); box-shadow: none; }
.nik-zoom, .d3-stage-controls { background: var(--map-control); border-color: var(--map-border); box-shadow: 0 3px 12px #0002; }
.nik-zoom button, .d3-stage-controls button { color: var(--map-control-text); border-left-color: var(--map-border); }
.nik-zoom button:hover, .d3-stage-controls button:hover { background: var(--map-control-hover); }
.nik-zoom button:focus-visible, .d3-stage-controls button:focus-visible, .d3-explode:focus-visible { outline: 2px solid var(--map-focus); outline-offset: -3px; }
.d3-explode { color: var(--map-control-text); background: var(--map-control); border-color: var(--map-border); box-shadow: 0 3px 12px #0002; }
.d3-explode:hover, .d3-explode.is-active { color: var(--map-control-active-text); background: var(--map-focus); border-color: var(--map-focus); }
.d3-orbit-readout, .d3-orbit-readout b { color: var(--map-muted); }`;

const lightMapThemeStyle = `:root { color-scheme: light; --map-canvas: #F6F7F9; --map-border: #D2D8E0; --map-control: #FFFFFF; --map-control-text: #00288C; --map-control-hover: #E9EDF4; --map-control-active-text: #FFFFFF; --map-focus: #00288C; --map-muted: #54657A; }
#nik-grid circle { fill: #D2D8E0; }
.nik-shell { fill: #FFFFFF; stroke: #B8C5D5; }
.nik-inset { fill: #F6F7F9; stroke: #B8C5D5; }
.nik-corridor { fill: #DDE6F3; stroke: #AABBD1; }
.nik-line { stroke: #93A9C3; }
.kind-teaching .nik-place-shape, .nik-place[data-place-id="f-cafe"] .nik-place-shape, .nik-place[data-place-id$="-nik"] .nik-place-shape { fill: #00288C; }
.nik-place[data-place-id$="-nik"] .nik-place-label { fill: #FFFFFF; }
#d3-bg stop:first-child { stop-color: #FFFFFF; }
#d3-bg stop:last-child { stop-color: #F6F7F9; }
#d3-grid circle { fill: #CBD5E2; }
.d3-ground-grid path { stroke: #AABBD1; opacity: .55; }
.d3-world-label { fill: #70839D; }
.d3-slab:not(.is-active) { opacity: .38; }
.d3-slab.is-active .d3-slab-face-top { fill: #DDE6F3; stroke: #AABBD1; }
.d3-slab.is-active .d3-slab-face-side { fill: #AABBD1; stroke: #8FA5BF; }`;

const darkMapThemeStyle = `:root { color-scheme: dark; --map-canvas: #111317; --map-border: #3C434C; --map-control: #2B3037; --map-control-text: #F0F2F5; --map-control-hover: #3C434C; --map-control-active-text: #111317; --map-focus: #9EB7ED; --map-muted: #BBC7D8; }
#nik-grid circle { fill: #343B48; }
#nik-garden rect { fill: #263C35; }
#nik-garden line { stroke: #4C7767; }
.nik-shell { fill: #1B1E23; stroke: #5B687A; }
.nik-inset { fill: #202833; stroke: #5B687A; }
.nik-corridor { fill: #34455B; stroke: #7188A6; }
.nik-line { stroke: #7D91AC; }
.nik-corridor-label, .nik-map-watermark { fill: #A9BED3; }
.nik-place-shape { stroke: #1B1E23; }
.kind-teaching .nik-place-shape, .nik-place[data-place-id="f-cafe"] .nik-place-shape, .nik-place[data-place-id$="-nik"] .nik-place-shape { fill: #4267A6; }
.kind-research .nik-place-shape { fill: #347D8B; }
.kind-office .nik-place-shape { fill: #D9AC50; }
.kind-service .nik-place-shape { fill: #5D9CB3; }
.kind-outdoor .nik-place-shape { fill: #3E745C; stroke: #6EAB89; }
.kind-circulation .nik-place-shape, .nik-place[data-place-id="f-aula"] .nik-place-shape { fill: #456983; }
.kind-roof .nik-place-shape { fill: #526170; stroke: #8798AB; }
.nik-place[data-place-id$="-nik"] .nik-place-label, .kind-service .nik-place-label, .kind-outdoor .nik-place-label, .kind-circulation .nik-place-label, .nik-place[data-place-id="f-aula"] .nik-place-label { fill: #F0F2F5; }
.kind-office .nik-place-label { fill: #1E2732; }
.nik-marker-ring { fill: #1B1E23; stroke: #9EB7ED; }
.nik-marker-label { fill: #F0F2F5; }
.nik-stair-platform { fill: #D8E2F2; stroke: #9EB7ED; }
.nik-stair-treads { stroke: #345184; }
#d3-bg stop:first-child { stop-color: #1B1E23; }
#d3-bg stop:last-child { stop-color: #111317; }
#d3-grid circle { fill: #3C434C; }
.d3-ground-grid path { stroke: #52647D; opacity: .45; }
.d3-world-label { fill: #8298B7; }
.d3-room-top { filter: brightness(1.17); }
.d3-slab.is-active .d3-slab-face-top { fill: #34455B; stroke: #7891AF; }
.d3-slab.is-active .d3-slab-face-side { fill: #26364B; stroke: #607C9E; }`;

const floorBridge = `<script>
function reportFloor(event) {
  const element = event.target instanceof Element ? event.target.closest('[data-floor]') : null;
  const floor = element?.getAttribute('data-floor');
  if (floor) window.parent.postMessage({ type: 'triton-floor-change', floor }, '*');
}
document.addEventListener('click', reportFloor);
document.addEventListener('keydown', event => {
  if (event.key === 'Enter' || event.key === ' ') reportFloor(event);
});
</script>`;

/** Embeds the selected app map with its current floor and room selection. */
export function roomMapHtml(mode: MapMode, floor: FloorId, placeId?: string, theme: MapTheme = 'light'): string {
  const map = mode === '2d' ? model2dMap : model3dMap;
  const mountName = mode === '2d' ? 'mountNikMap' : 'mountNik3DMap';
  const compactStyle = mode === '2d' ? compact2dStyle : compact3dStyle;
  const themeStyle = theme === 'dark' ? darkMapThemeStyle : lightMapThemeStyle;
  const place = PLACES.find(item => item.id === placeId && item.floor === floor);
  const selection = place ? `map.selectPlace(${JSON.stringify(place.id)});` : '';
  const mount = `if (root) { const map = ${mountName}(root, { initialFloor: ${JSON.stringify(floor)} }); ${selection} }`;
  return map.html
    .replace('__TRITON_PLACES__', () => JSON.stringify(PLACES))
    .replace('__TRITON_FLOOR_SHAPES__', () => JSON.stringify(FLOOR_SHAPES))
    .replace('</style>', `</style><style>${compactStyle}${sharedMapThemeStyle}${themeStyle}</style>`)
    .replace(`if (root) ${mountName}(root);`, mount)
    .replace('</body>', `${floorBridge}</body>`);
}
