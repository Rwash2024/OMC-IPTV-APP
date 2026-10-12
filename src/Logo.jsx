import { ARCH, IPTV_PATH, OMC_BOX, OMC_PATH, RED } from './logoData.js';

// App icon: red tile, white arch and bar, "IPTV" under them. Small sizes drop the lettering.
export function LogoTile({ size = 96, withText = true }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" role="img" aria-label="OMC IPTV">
      <rect width="120" height="120" rx="28" fill={RED} />
      <g transform={withText ? undefined : 'translate(0 8)'}>
        <path d={ARCH} fill="none" stroke="#fff" strokeWidth="11.5" />
        <rect x="54.6" y="41" width="10.8" height="34" rx="5.4" fill="#fff" />
        {withText && <path d={IPTV_PATH} fill="#fff" />}
      </g>
    </svg>
  );
}

// "OMC" lettering, drawn as outlines so it needs no font. Takes its colour from the surrounding text.
export function Wordmark({ height = 36 }) {
  const [x, y, w, h] = OMC_BOX;
  return (
    <svg height={height} viewBox={`${x} ${y} ${w} ${h}`} role="img" aria-label="OMC" style={{ width: 'auto' }}>
      <path d={OMC_PATH} fill="currentColor" />
    </svg>
  );
}
