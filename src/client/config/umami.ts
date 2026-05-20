const DEFAULT_BASE_URL = 'https://xtbang.top/umami';
const DEFAULT_SCRIPT_SRC = 'https://xtbang.top/umami/script.js';
const DEFAULT_SHARE_URL = 'https://xtbang.top/share/REPLACE_ME';
const DEFAULT_WEBSITE_ID = 'REPLACE_WITH_UMAMI_WEBSITE_ID';

function readEnv(value: unknown): string {
  return String(value || '').trim();
}

export const umamiConfig = {
  baseUrl: readEnv(import.meta.env.VITE_UMAMI_BASE_URL || DEFAULT_BASE_URL),
  scriptSrc: readEnv(import.meta.env.VITE_UMAMI_SCRIPT_SRC || DEFAULT_SCRIPT_SRC),
  websiteId: readEnv(import.meta.env.VITE_UMAMI_WEBSITE_ID || DEFAULT_WEBSITE_ID),
  shareUrl: readEnv(import.meta.env.VITE_UMAMI_SHARE_URL || DEFAULT_SHARE_URL),
};

export function hasConfiguredWebsiteId(): boolean {
  return Boolean(umamiConfig.websiteId) && umamiConfig.websiteId !== DEFAULT_WEBSITE_ID;
}

export function hasConfiguredShareUrl(): boolean {
  return Boolean(umamiConfig.shareUrl) && !umamiConfig.shareUrl.endsWith('/share/REPLACE_ME');
}

export function injectUmamiScript(): void {
  if (typeof document === 'undefined') return;
  if (!umamiConfig.scriptSrc || !hasConfiguredWebsiteId()) return;

  const scriptId = 'umami-tracker-script';
  if (document.getElementById(scriptId)) return;

  const script = document.createElement('script');
  script.id = scriptId;
  script.defer = true;
  script.src = umamiConfig.scriptSrc;
  script.setAttribute('data-website-id', umamiConfig.websiteId);
  document.head.appendChild(script);
}
