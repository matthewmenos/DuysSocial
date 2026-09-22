const PATHS: Record<string, string> = {
  home: '<path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1Z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  explore: '<circle cx="12" cy="12" r="9"/><path d="m15 9-2 4-4 2 2-4z"/>',
  bell: '<path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  wallet: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/><circle cx="16" cy="14" r="1.4"/>',
  coins: '<circle cx="9" cy="9" r="6"/><path d="M16.5 8.5a6 6 0 1 1-5 10"/>',
  gift: '<rect x="3" y="9" width="18" height="12" rx="1"/><path d="M3 13h18M12 9v12"/>',
  checkmark: '<path d="M5 13l4 4L19 7"/>',
  paperclip: '<path d="M14.59 14.59A2 2 0 0 0 15.91 13.2L9.5 6.8a1 1 0 0 1 .34-.34l.34-.34A1 1 0 0 1 10 7h7a3 3 0 0 1 0 6h-1M6 13h7M6 9h7M4 17h7"/>',
  verify: '<path d="m9 12 2 2 4-4"/><path d="M12 2 14.5 4.5 18 4l-.5 3.5L21 9l-2 3 2 3-3.5 1.5L18 20l-3.5-.5L12 22l-2.5-2.5L6 20l.5-3.5L3 15l2-3-2-3 3.5-1.5L6 4l3.5.5z"/>',
  boost: '<polyline points="22 7 13.5 15.5 8.5 10.5 1 18"/><polyline points="16 7 22 7 22 13"/>',
  admin: '<path d="M12 2 4 6v6c0 5 3.5 8 8 10 4.5-2 8-5 8-10V6Z"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 4.6 15H4.5a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.1-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 11 4.6V4.5a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.6 1.6 0 0 0 21 11h.1a2 2 0 1 1 0 4z"/>',
  heart: '<path d="M19 5.5a4.5 4.5 0 0 0-7 1 4.5 4.5 0 0 0-7-1C2.5 7.5 3 11 7 14.5l5 4.5 5-4.5c4-3.5 4.5-7 2-9z"/>',
  comment: '<path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  repost: '<path d="M17 2l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14M7 22l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/>',
  send: '<path d="M22 2 11 13M22 2 15 22l-4-9-9-4z"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  close: '<path d="M18 6 6 18M6 6l12 12"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  "eye-off": '<path d="M9.9 5.1A9.6 9.6 0 0 1 12 5c6.5 0 10 7 10 7a16 16 0 0 1-3 3.7M6.6 6.6A16 16 0 0 0 2 12s3.5 7 10 7a9.5 9.5 0 0 0 4.3-1M3 3l18 18"/>',
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2 4.2 2 2 0 0 1 4 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.6a16 16 0 0 0 6 6l1.1-1.1a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
  mic: '<path d="M12 1a4 4 0 0 1 4 4v8a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4z"/><path d="M1 12h22M8 21v-1h8v1"/>',
  "mic-off": '<path d="M1 1l22 22M8 8a4 4 0 0 0 8 0M12 3v3M7 10v5a5 5 0 0 0 10 0v-5M4 15h16"/>',
  video: '<rect x="2" y="5" width="14" height="14" rx="2"/><path d="m16 9 6-3v12l-6-3z"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
  poll: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  article: '<path d="M4 3h16v18H4z"/><path d="M8 7h8M8 11h8M8 15h5"/>',
  tip: '<circle cx="12" cy="12" r="9"/><path d="M12 7v10"/>',
  chart: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="3" y1="20" x2="21" y2="20"/>',
  "share-out": '<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>',
  star: '<polygon points="12 2 15.1 8.3 22 9.3 17 14.1 18.2 21 12 17.8 5.8 21 7 14.1 2 9.3 8.9 8.3 12 2"/>',
  "arrow-left": '<path d="M19 12H5"/><path d="m12 5-7 7 7 7"/>',
  camera: '<path d="M5 7h3l1.5-2h5L16 7h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z"/><circle cx="12" cy="13" r="3.2"/>',
  broadcast: '<circle cx="12" cy="12" r="2"/><path d="M16.2 7.8a6 6 0 0 1 0 8.4M7.8 16.2a6 6 0 0 1 0-8.4"/>',
  more: '<circle cx="12" cy="5" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="12" cy="19" r="1.7"/>',
  document: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M8 13h8M8 17h5"/>',
  play: '<polygon points="6 4 20 12 6 20 6 4"/>',
  palette: '<circle cx="12" cy="12" r="9"/><circle cx="9" cy="9" r="1.2"/><circle cx="15" cy="9" r="1.2"/><circle cx="9.5" cy="15" r="1.2"/>',
  spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14"/><path d="M10 11v6M14 11v6"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
  "map-pin": '<path d="M21 10c0 6-9 12-9 12s-9-6-9-12a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
  lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  shield: '<path d="M12 2 4 6v6c0 5 3.5 8 8 10 4.5-2 8-5 8-10V6Z"/><path d="m9 12 2 2 4-4"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 21a7 7 0 0 1 14 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 21a7 7 0 0 0-3-5.7"/>',
  "arrow-up": '<path d="M12 19V5"/><path d="m5 12 7-7 7 7"/>',
  "arrow-down": '<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7"/><polyline points="21 3 21 9 15 9"/>',
  filter: '<path d="M3 5h18l-7 8v6l-4-2v-4z"/>',
  alert: '<path d="M12 3 2 20h20Z"/><path d="M12 9v5M12 17.5v.5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  brightness: '<circle cx="12" cy="12" r="5"/><path d="M12 1v4M12 19v4M4.22 4.22L6.34 6.34M17.66 17.66l2.12 2.12M1 12h4M19 12h4"/>',
  "log-in": '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="m10 17 5-5-5-5M15 12H3"/>',
};

export function Icon({ name, size = 24 }: { name: string; size?: number }) {
  return (
    <svg
      className={`icon icon-${name}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: PATHS[name] || '<circle cx="12" cy="12" r="9"/>' }}
    />
  );
}

export function Avatar({ url, size = 40, alt = "" }: { url?: string; size?: number; alt?: string }) {
  return (
    <img
      className="avatar"
      src={url || "/icons/avatar-default.svg"}
      width={size}
      height={size}
      alt={alt}
      style={{ width: size, height: size, borderRadius: 999, objectFit: "cover", flexShrink: 0 }}
      onError={(e) => {
        (e.target as HTMLImageElement).src = "/icons/avatar-default.svg";
      }}
    />
  );
}

export function Badge({ kind }: { kind?: string }) {
  if (!kind || !["blue", "gold", "grey"].includes(kind)) return null;
  const fill = kind === "gold" ? "#f5b50a" : kind === "grey" ? "#8b98a5" : "#1d9bf6";
  return (
    <span className={`vbadge vbadge-${kind}`} title={`${kind} verified`}>
      <svg width="18" height="18" viewBox="0 0 100 100" aria-hidden="true">
        <path fill={fill} d="M50 6l8 8 11-2 2 11 11 2-2 11 8 8-8 8 2 11-11 2-2 11-11-2-8 8-8-8-11 2-2-11-11-2 2-11-8-8 8-8-2-11 11-2 2-11 11 2z" />
        <path d="M42 50l6 6 12-14" stroke="#fff" strokeWidth="8" fill="none" strokeLinecap="round" />
      </svg>
    </span>
  );
}
