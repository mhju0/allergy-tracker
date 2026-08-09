import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { colors } from './tokens';

export type IconName =
  | 'back'
  | 'bell'
  | 'calendar'
  | 'check'
  | 'chevronRight'
  | 'clock'
  | 'close'
  | 'download'
  | 'file'
  | 'foods'
  | 'help'
  | 'home'
  | 'plus'
  | 'search'
  | 'settings'
  | 'shield'
  | 'user'
  | 'warning';

function Glyph({ name }: { name: IconName }) {
  switch (name) {
    case 'back':
      return <Path d="M15 18l-6-6 6-6" />;
    case 'bell':
      return <Path d="M18 8a6 6 0 00-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />;
    case 'calendar':
      return <><Rect x={3} y={5} width={18} height={16} rx={3} /><Path d="M8 3v4m8-4v4M3 10h18" /></>;
    case 'check':
      return <Path d="M5 12l4 4L19 6" />;
    case 'chevronRight':
      return <Path d="M9 18l6-6-6-6" />;
    case 'clock':
      return <><Circle cx={12} cy={12} r={9} /><Path d="M12 7v5l3 2" /></>;
    case 'close':
      return <Path d="M6 6l12 12M18 6L6 18" />;
    case 'download':
      return <><Path d="M12 3v12m0 0l4-4m-4 4l-4-4" /><Path d="M5 20h14" /></>;
    case 'file':
      return <><Path d="M7 3h7l4 4v14H7zM14 3v5h5" /><Path d="M9 15h6M9 18h4" /></>;
    case 'foods':
      return <Path d="M4 6h16M4 12h16M4 18h10" />;
    case 'help':
      return <><Circle cx={12} cy={12} r={9} /><Path d="M9.5 9a2.5 2.5 0 113.4 2.3c-.9.4-.9 1.1-.9 1.7M12 17h.01" /></>;
    case 'home':
      return <><Path d="M3 11.5L12 4l9 7.5" /><Path d="M5.5 10v10h13V10" /></>;
    case 'plus':
      return <Path d="M12 5v14M5 12h14" />;
    case 'search':
      return <><Circle cx={11} cy={11} r={7} /><Path d="M20 20l-4-4" /></>;
    case 'settings':
      return <><Circle cx={12} cy={12} r={3} /><Path d="M19.4 15a1.7 1.7 0 00.3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.5V21h-4v-.1a1.7 1.7 0 00-1-1.5 1.7 1.7 0 00-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.5-1H3v-4h.1a1.7 1.7 0 001.5-1 1.7 1.7 0 00-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 001.9.3 1.7 1.7 0 001-1.5V3h4v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 00-.3 1.9 1.7 1.7 0 001.5 1h.1v4h-.1a1.7 1.7 0 00-1.5 1z" /></>;
    case 'shield':
      return <Path d="M12 3l7 3v5c0 4.6-2.8 8-7 10-4.2-2-7-5.4-7-10V6z" />;
    case 'user':
      return <><Circle cx={12} cy={8} r={4} /><Path d="M5 21a7 7 0 0114 0" /></>;
    case 'warning':
      return <><Path d="M10.3 3.8L2.6 17.2A2 2 0 004.3 20h15.4a2 2 0 001.7-2.8L13.7 3.8a2 2 0 00-3.4 0z" /><Path d="M12 9v4m0 4h.01" /></>;
  }
}

export function Icon({ name, size = 22, color = colors.ink, strokeWidth = 2 }: {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Glyph name={name} />
    </Svg>
  );
}
