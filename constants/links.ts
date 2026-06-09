// Single source of truth for the app's web domain and every URL derived from
// it. Change DOMAIN here and Terms / Privacy / support all follow — never
// hardcode the domain in a screen.

export const DOMAIN = 'trynothing.app';

export const SITE_URL = `https://${DOMAIN}`;
export const TERMS_URL = `${SITE_URL}/terms`;
export const PRIVACY_URL = `${SITE_URL}/privacy`;
export const SUPPORT_EMAIL_ADDRESS = `hi@${DOMAIN}`;
export const SUPPORT_EMAIL = `mailto:${SUPPORT_EMAIL_ADDRESS}`;

// Apple-side URLs (not on our domain) kept here so all external links live
// in one place.
export const IOS_SUBSCRIPTIONS_URL = 'https://apps.apple.com/account/subscriptions';
// TODO: drop in the real App Store ID once it's minted.
export const APP_STORE_WRITE_REVIEW =
  'itms-apps://apps.apple.com/app/id0000000000?action=write-review';
