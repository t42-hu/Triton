import Svg, { Circle, G, Path, Text as SvgText } from 'react-native-svg';
import { PLACES, type FloorId, type Place, type PlaceKind } from './nik-map-data';

type MapColors = { shell: string; corridor: string; line: string; label: string; marker: string; selected: string; selectedText: string; areas: Record<PlaceKind, string> };
const LIGHT: MapColors = { shell: '#F8FAFB', corridor: '#DFE7EC', line: '#ACBDC8', label: '#294157', marker: '#FFFFFF', selected: '#C9374E', selectedText: '#FFFFFF', areas: { teaching: '#315A83', office: '#E5BE69', research: '#53889B', service: '#B4D9E1', outdoor: '#C8E3D7', circulation: '#C5D8E2' } };
const DARK: MapColors = { shell: '#242A31', corridor: '#353E47', line: '#65717D', label: '#F0F2F5', marker: '#303942', selected: '#F098A4', selectedText: '#111317', areas: { teaching: '#426889', office: '#9F804B', research: '#3D7485', service: '#4A6D78', outdoor: '#41685B', circulation: '#536977' } };

function FloorStructure({ floor, colors }: { floor: FloorId; colors: MapColors }) {
  const basement = floor === 'A';
  const ground = floor === 'F';
  const shell = basement ? 'M150 190H1020V530H150Z' : ground ? 'M310 174H1038V558H310Z' : 'M150 196H1040V500H150Z';
  const corridor = basement ? 'M170 332H1010V370H170Z' : ground ? 'M312 290H1035V312H312ZM486 312H504V462H486ZM775 450H1036V466H775Z' : 'M169 342H1025V388H169Z';
  const divisions = basement ? 'M263 370V507M465 190V332' : ground ? 'M485 181V300M854 294V459' : 'M169 388H1025M169 341H1025';
  return <G><Path d={shell} fill={colors.shell} stroke={colors.line} strokeWidth={3} /><Path d={corridor} fill={colors.corridor} stroke={colors.line} strokeWidth={1.5} /><Path d={divisions} fill="none" stroke={colors.line} strokeWidth={2} strokeDasharray="8 8" />
    {!basement && !ground ? <SvgText x={620} y={372} textAnchor="middle" fontSize={14} fontWeight="700" fill={colors.line}>FOLYOSÓ</SvgText> : null}
    {floor === '1' ? <SvgText x={156} y={576} fontSize={17} fontWeight="700" fill={colors.line}>DOBERDÓ ÚT · BEJÁRAT</SvgText> : null}
    {basement ? <SvgText x={150} y={580} fontSize={17} fontWeight="700" fill={colors.line}>BÉCSI ÚT · BEJÁRAT</SvgText> : null}
    {ground ? <SvgText x={105} y={565} fontSize={17} fontWeight="700" fill={colors.line}>UDVAR · KÜLTÉR</SvgText> : null}</G>;
}

function PlaceLabel({ x, y, label, color, size = 17 }: { x: number; y: number; label: string; color: string; size?: number }) {
  return <SvgText x={x} y={y + 6} textAnchor="middle" fontSize={size} fontWeight="700" fill={color}>{label}</SvgText>;
}

function PlaceShape({ place, selected, colors }: { place: Place; selected: boolean; colors: MapColors }) {
  const fill = selected ? colors.selected : colors.areas[place.kind];
  const label = selected ? colors.selectedText : ['office', 'service', 'outdoor', 'circulation'].includes(place.kind) ? colors.label : '#FFFFFF';
  if (!place.path) return <G><Circle cx={place.x} cy={place.y} r={26} fill={selected ? colors.selected : colors.marker} stroke={selected ? colors.selected : colors.line} strokeWidth={4} /><PlaceLabel x={place.x} y={place.y} label={place.short} color={selected ? colors.selectedText : colors.label} size={13} /></G>;
  return <G><Path d={place.path} fill={fill} stroke={selected ? colors.selected : colors.shell} strokeWidth={selected ? 8 : 5} /><PlaceLabel x={place.x} y={place.y} label={place.short} color={label} />{place.secondaryLabels?.map((item, index) => <PlaceLabel key={index} x={item.x} y={item.y} label={item.text} color={label} />)}</G>;
}

export function NikFloorMap({ floor, selectedId, dark, width }: { floor: FloorId; selectedId?: string; dark: boolean; width: number }) {
  const colors = dark ? DARK : LIGHT;
  return <Svg width={width} height={width * 460 / 1200} viewBox="0 145 1200 460" preserveAspectRatio="xMidYMid meet" accessibilityLabel={`${floor}. szint alaprajza`}>
    <FloorStructure floor={floor} colors={colors} />
    {PLACES.filter(place => place.floor === floor).map(place => <PlaceShape key={place.id} place={place} selected={place.id === selectedId} colors={colors} />)}
  </Svg>;
}
