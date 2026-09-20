// SVG Data URIs for code-generated male and female profile avatars
// Clean, lightweight gray/slate character silhouettes inside rounded circles

export const DEFAULT_MALE_AVATAR = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <rect width="128" height="128" rx="64" fill="#E2E8F0"/>
  <!-- Head -->
  <circle cx="64" cy="46" r="22" fill="#64748B"/>
  <!-- Shoulders / Torso -->
  <path d="M28 108 C28 82, 42 74, 64 74 C86 74, 100 82, 100 108 Z" fill="#64748B"/>
</svg>
`)}`;

export const DEFAULT_FEMALE_AVATAR = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <rect width="128" height="128" rx="64" fill="#F1F5F9"/>
  <!-- Hair / Head -->
  <path d="M40 48 C40 30, 88 30, 88 48 C88 64, 40 64, 40 48 Z" fill="#475569"/>
  <circle cx="64" cy="46" r="20" fill="#64748B"/>
  <!-- Female Shoulders / Torso -->
  <path d="M32 108 C32 82, 44 76, 64 76 C84 76, 96 82, 96 108 Z" fill="#64748B"/>
</svg>
`)}`;

export const DEFAULT_GENERAL_AVATAR = DEFAULT_MALE_AVATAR;

export const getDefaultAvatar = (gender?: 'male' | 'female' | 'other' | string): string => {
  if (gender === 'female') return DEFAULT_FEMALE_AVATAR;
  return DEFAULT_MALE_AVATAR;
};
