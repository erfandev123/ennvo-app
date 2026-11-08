// High-Aesthetic Modern Vector SVG Profile Avatars for Ennvo
// Seamless full-bleed circular avatars with zero bottom/side gaps

export const DEFAULT_MALE_AVATAR = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
  <defs>
    <linearGradient id="bgGradMale" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0284c7"/>
      <stop offset="50%" stop-color="#0369a1"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>
    <linearGradient id="skinGradMale" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffedd5"/>
      <stop offset="100%" stop-color="#fed7aa"/>
    </linearGradient>
    <linearGradient id="hairGradMale" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1e293b"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>
    <linearGradient id="clothGradMale" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8"/>
      <stop offset="100%" stop-color="#0284c7"/>
    </linearGradient>
    <clipPath id="avatarClipMale">
      <circle cx="100" cy="100" r="100"/>
    </clipPath>
  </defs>

  <!-- Circular Clip to guarantee 100% zero gap on all sides -->
  <g clip-path="url(#avatarClipMale)">
    <!-- Seamless Background Fill -->
    <rect width="200" height="200" fill="url(#bgGradMale)"/>
    
    <!-- Subtle Inner Glow Ring -->
    <circle cx="100" cy="100" r="97" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="2"/>

    <!-- Full-Bleed Clothing & Shoulders (Extends through bottom y=205 to eliminate any gap) -->
    <path d="M5 205 C5 146 50 136 100 136 C150 136 195 146 195 205 Z" fill="url(#clothGradMale)"/>
    
    <!-- Modern V-Collar Accent -->
    <path d="M84 137 C94 150 106 150 116 137" fill="none" stroke="#e0f2fe" stroke-width="3" stroke-linecap="round"/>

    <!-- Neck -->
    <rect x="87" y="108" width="26" height="34" rx="10" fill="url(#skinGradMale)"/>

    <!-- Head / Face -->
    <ellipse cx="100" cy="84" rx="30" ry="34" fill="url(#skinGradMale)"/>
    
    <!-- Ears -->
    <ellipse cx="69" cy="86" rx="4.5" ry="7.5" fill="#fbcfe8"/>
    <ellipse cx="131" cy="86" rx="4.5" ry="7.5" fill="#fbcfe8"/>

    <!-- Stylish Modern Male Hair Cut -->
    <path d="M68 80 C66 56 80 46 100 46 C122 46 134 56 132 80 C132 70 125 60 116 59 C108 58 104 62 94 58 C86 55 74 64 68 80 Z" fill="url(#hairGradMale)"/>
    
    <!-- Hair Volume Top Flick -->
    <path d="M78 54 C85 41 106 39 124 47 C115 44 98 43 88 48 C83 50 80 52 78 54 Z" fill="#334155"/>
  </g>
</svg>
`)}`;

export const DEFAULT_FEMALE_AVATAR = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
  <defs>
    <linearGradient id="bgGradFem" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ec4899"/>
      <stop offset="50%" stop-color="#a855f7"/>
      <stop offset="100%" stop-color="#1e1b4b"/>
    </linearGradient>
    <linearGradient id="skinGradFem" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#fff1f2"/>
      <stop offset="100%" stop-color="#fecdd3"/>
    </linearGradient>
    <linearGradient id="hairGradFem" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#262626"/>
      <stop offset="100%" stop-color="#171717"/>
    </linearGradient>
    <linearGradient id="clothGradFem" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f43f5e"/>
      <stop offset="100%" stop-color="#be185d"/>
    </linearGradient>
    <clipPath id="avatarClipFem">
      <circle cx="100" cy="100" r="100"/>
    </clipPath>
  </defs>

  <!-- Circular Clip to guarantee 100% zero gap on all sides -->
  <g clip-path="url(#avatarClipFem)">
    <!-- Seamless Background Fill -->
    <rect width="200" height="200" fill="url(#bgGradFem)"/>
    
    <!-- Subtle Inner Glow Ring -->
    <circle cx="100" cy="100" r="97" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="2"/>

    <!-- Back Hair Flow -->
    <path d="M58 80 C52 110 52 138 66 154 C72 160 82 150 80 137 C78 122 72 100 74 82 Z" fill="url(#hairGradFem)"/>
    <path d="M142 80 C148 110 148 138 134 154 C128 160 118 150 120 137 C122 122 128 100 126 82 Z" fill="url(#hairGradFem)"/>

    <!-- Full-Bleed Graceful Shoulders (Extends through bottom y=205 to eliminate any gap) -->
    <path d="M10 205 C10 148 50 138 100 138 C150 138 190 148 190 205 Z" fill="url(#clothGradFem)"/>
    
    <!-- Elegant V-Neckline -->
    <path d="M86 139 C94 152 106 152 114 139" fill="none" stroke="#ffe4e6" stroke-width="2.5" stroke-linecap="round"/>

    <!-- Neck -->
    <rect x="88" y="108" width="24" height="34" rx="9" fill="url(#skinGradFem)"/>

    <!-- Head / Face -->
    <ellipse cx="100" cy="84" rx="28" ry="32" fill="url(#skinGradFem)"/>
    
    <!-- Earrings -->
    <circle cx="70" cy="90" r="3.5" fill="#fde047"/>
    <circle cx="130" cy="90" r="3.5" fill="#fde047"/>

    <!-- Stylish Modern Female Hairstyle -->
    <path d="M68 80 C65 54 78 44 100 44 C122 44 135 54 132 80 C132 66 122 58 108 58 C96 58 90 62 82 59 C75 56 70 66 68 80 Z" fill="url(#hairGradFem)"/>
    
    <!-- Hair Soft Parting -->
    <path d="M96 44 C92 52 82 60 74 68 C77 62 84 54 92 48 Z" fill="#404040"/>
  </g>
</svg>
`)}`;

export const DEFAULT_GENERAL_AVATAR = DEFAULT_MALE_AVATAR;

export const getDefaultAvatar = (gender?: 'male' | 'female' | 'other' | string): string => {
  if (gender === 'female') return DEFAULT_FEMALE_AVATAR;
  return DEFAULT_MALE_AVATAR;
};
