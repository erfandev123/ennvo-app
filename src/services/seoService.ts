/**
 * Ennvo Official Platform SEO & Meta Manager
 * Ensures compliant, dynamic, client-side metadata updates for SPA navigation
 * while protecting private routes with noindex directives.
 */

export interface PageSEOConfig {
  title: string;
  description: string;
  canonical?: string;
  robots?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogUrl?: string;
  ogImage?: string;
}

const DEFAULT_CANONICAL = 'https://ennvo.vercel.app/';
const DEFAULT_OG_IMAGE = 'https://ennvo.vercel.app/og-image.jpg';

export const OFFICIAL_BRAND_SEO: PageSEOConfig = {
  title: 'Ennvo Official App – Social Media, Reels, Chat & Video Calls',
  description: 'Ennvo is the official social media app by Erfan Sarker and co-developer Rita Akter. Share reels, chat, post stories, and make HD video calls — fast and free.',
  canonical: DEFAULT_CANONICAL,
  robots: 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
  ogTitle: 'Ennvo Official App – Social Media, Reels, Chat & Video Calls',
  ogDescription: 'Ennvo is the official social media app by Erfan Sarker and co-developer Rita Akter. Share reels, chat, post stories, and make HD video calls — fast and free.',
  ogUrl: DEFAULT_CANONICAL,
  ogImage: DEFAULT_OG_IMAGE,
};

function getOrCreateMeta(attrName: 'name' | 'property', attrValue: string): HTMLMetaElement {
  let el = document.querySelector<HTMLMetaElement>(`meta[${attrName}="${attrValue}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attrName, attrValue);
    document.head.appendChild(el);
  }
  return el;
}

function getOrCreateCanonicalLink(): HTMLLinkElement {
  let el = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  return el;
}

export function updatePageSEO(config: Partial<PageSEOConfig>) {
  if (typeof document === 'undefined') return;

  const title = config.title || OFFICIAL_BRAND_SEO.title;
  const description = config.description || OFFICIAL_BRAND_SEO.description;
  const canonical = config.canonical || OFFICIAL_BRAND_SEO.canonical || DEFAULT_CANONICAL;
  const robots = config.robots || OFFICIAL_BRAND_SEO.robots || 'index, follow';
  const ogTitle = config.ogTitle || title;
  const ogDescription = config.ogDescription || description;
  const ogUrl = config.ogUrl || canonical;
  const ogImage = config.ogImage || DEFAULT_OG_IMAGE;

  // 1. Update Document Title
  document.title = title;

  // 2. Update Standard Meta Tags
  getOrCreateMeta('name', 'description').setAttribute('content', description);
  getOrCreateMeta('name', 'robots').setAttribute('content', robots);

  // 3. Update Canonical Link
  const canonicalLink = getOrCreateCanonicalLink();
  canonicalLink.setAttribute('href', canonical);

  // 4. Update OpenGraph Tags
  getOrCreateMeta('property', 'og:title').setAttribute('content', ogTitle);
  getOrCreateMeta('property', 'og:description').setAttribute('content', ogDescription);
  getOrCreateMeta('property', 'og:url').setAttribute('content', ogUrl);
  getOrCreateMeta('property', 'og:image').setAttribute('content', ogImage);

  // 5. Update Twitter Tags
  getOrCreateMeta('name', 'twitter:title').setAttribute('content', ogTitle);
  getOrCreateMeta('name', 'twitter:description').setAttribute('content', ogDescription);
  getOrCreateMeta('name', 'twitter:image').setAttribute('content', ogImage);
}

/**
 * Route-specific SEO profiles ensuring private user data is never indexed
 */
export function applyRouteSEO(page: string, params?: { userName?: string; isAuth?: boolean; authScreen?: string }) {
  switch (page) {
    case 'home':
    case 'welcome':
      updatePageSEO(OFFICIAL_BRAND_SEO);
      break;

    case 'search':
      updatePageSEO({
        title: 'Discover & Search Creators • Ennvo Social',
        description: 'Explore trending creators, viral reels, and lively communities on Ennvo — the official social media app by Erfan Sarker.',
        canonical: 'https://ennvo.vercel.app/search',
        robots: 'index, follow',
      });
      break;

    case 'reels':
      updatePageSEO({
        title: 'Short Video Reels • Ennvo',
        description: 'Watch, create, and share trending short video reels with HD music and creative effects on Ennvo.',
        canonical: 'https://ennvo.vercel.app/feed',
        robots: 'index, follow',
      });
      break;

    case 'profile':
      if (params?.userName) {
        updatePageSEO({
          title: `${params.userName} • Ennvo Profile`,
          description: `Connect with ${params.userName} on Ennvo, the official social networking platform.`,
          canonical: 'https://ennvo.vercel.app/',
          robots: 'noindex, follow', // Keep user profile private unless public profile index is desired
        });
      } else {
        updatePageSEO({
          title: 'My Profile • Ennvo',
          robots: 'noindex, nofollow',
        });
      }
      break;

    case 'auth':
      if (params?.authScreen === 'signup') {
        updatePageSEO({
          title: 'Create Account • Ennvo Official Platform',
          description: 'Join Ennvo today. Connect with friends, create and watch short video reels, enjoy instant real-time messaging and HD audio/video calls.',
          canonical: 'https://ennvo.vercel.app/signup',
          robots: 'index, follow',
        });
      } else {
        updatePageSEO({
          title: 'Sign In • Ennvo Official Platform',
          description: 'Sign in to Ennvo for instant messaging, short reels, and real-time HD audio & video calls.',
          canonical: 'https://ennvo.vercel.app/signin',
          robots: 'index, follow',
        });
      }
      break;

    // Strict noindex for private authenticated areas
    case 'messages':
      updatePageSEO({
        title: 'Private Messages • Ennvo',
        description: 'Encrypted, private messaging on Ennvo.',
        robots: 'noindex, nofollow',
      });
      break;

    case 'notifications':
      updatePageSEO({
        title: 'Notifications • Ennvo',
        robots: 'noindex, nofollow',
      });
      break;

    case 'settings':
      updatePageSEO({
        title: 'Account Settings • Ennvo',
        robots: 'noindex, nofollow',
      });
      break;

    case 'edit-profile':
      updatePageSEO({
        title: 'Edit Profile • Ennvo',
        robots: 'noindex, nofollow',
      });
      break;

    case 'create':
      updatePageSEO({
        title: 'Create Post or Reel • Ennvo',
        robots: 'noindex, nofollow',
      });
      break;

    case 'admin':
      updatePageSEO({
        title: 'Admin Console • Ennvo Platform',
        robots: 'noindex, nofollow',
      });
      break;

    default:
      updatePageSEO(OFFICIAL_BRAND_SEO);
      break;
  }
}
