/**
 * Basset Hound Browser - Built-in Filter Lists
 * Provides comprehensive ad, tracker, social widget, and crypto miner blocking
 */

/**
 * Common advertising domains and patterns
 */
const AD_DOMAINS = [
  // Google Ads
  'googleads.g.doubleclick.net',
  'pagead2.googlesyndication.com',
  'adservice.google.com',
  'www.googleadservices.com',
  'partner.googleadservices.com',
  'tpc.googlesyndication.com',
  'adclick.g.doubleclick.net',
  'securepubads.g.doubleclick.net',
  'pubads.g.doubleclick.net',
  'ad.doubleclick.net',

  // Amazon Ads
  'aax.amazon-adsystem.com',
  'z-na.amazon-adsystem.com',
  'fls-na.amazon-adsystem.com',
  'c.amazon-adsystem.com',

  // Facebook Ads
  'ads.facebook.com',
  'an.facebook.com',
  'web.facebook.com',

  // Twitter/X Ads
  'static.ads-twitter.com',
  'ads-api.twitter.com',
  'ads.twitter.com',

  // Microsoft/Bing Ads
  'ads.msn.com',
  'c.msn.com',
  'flex.msn.com',
  'ad.atdmt.com',

  // Yahoo Ads
  'ads.yahoo.com',
  'analytics.yahoo.com',

  // Generic Ad Networks
  'adnxs.com',
  'adsrvr.org',
  'adroll.com',
  'advertising.com',
  'bidswitch.net',
  'casalemedia.com',
  'contextweb.com',
  'criteo.com',
  'criteo.net',
  'demdex.net',
  'exelator.com',
  'eyeota.net',
  'iponweb.com',
  'krxd.net',
  'lijit.com',
  'liveintent.com',
  'livewrappedmedia.com',
  'mathtag.com',
  'media.net',
  'moatads.com',
  'mookie1.com',
  'openx.net',
  'outbrain.com',
  'pubmatic.com',
  'quantserve.com',
  'rfihub.com',
  'rlcdn.com',
  'rubiconproject.com',
  'sascdn.com',
  'serving-sys.com',
  'sharethrough.com',
  'simpli.fi',
  'smartadserver.com',
  'smaato.net',
  'spotxchange.com',
  'taboola.com',
  'tapad.com',
  'tidaltv.com',
  'triplelift.com',
  'turn.com',
  'undertone.com',
  'vrtcal.com',
  'yieldlab.net',
  'zedo.com',
  '2mdn.net',
  '33across.com',
  'adform.net',
  'adhigh.net',
  'admantx.com',
  'adtechus.com',
  'agkn.com',
  'atwola.com',
  'bluekai.com',
  'btrll.com',
  'buysellads.com',
  'chartbeat.net',
  'contextin.com',
  'doubleverify.com',
  'dpm.demdex.net',
  'everesttech.net',
  'eyereturn.com',
  'getclicky.com',
  'googlesyndication.com',
  'gumgum.com',
  'indexww.com',
  'insightexpressai.com',
  'intelliad.de',
  'marinsm.com',
  'mediamath.com',
  'moat.com',
  'mxptint.net',
  'nativo.com',
  'nexac.com',
  'onetag-sys.com',
  'openxmarket.com',
  'pixels.com',
  'pixfuture.net',
  'ppjol.com',
  'revcontent.com',
  'scorecardresearch.com',
  'socdm.com',
  'spotx.tv',
  'springserve.com',
  'stackadapt.com',
  'stickyadstv.com',
  'synacor.com',
  'teads.tv',
  'telaria.com',
  'tremorhub.com',
  'tribalfusion.com',
  'truste.com',
  'trustx.org',
  'w55c.net',
  'yieldmo.com',
  'zemanta.com',
];

/**
 * Common tracker domains and patterns
 */
const TRACKER_DOMAINS = [
  // Google Analytics
  'www.google-analytics.com',
  'google-analytics.com',
  'analytics.google.com',
  'ssl.google-analytics.com',
  'stats.g.doubleclick.net',

  // Facebook Pixel/Tracking
  'connect.facebook.net',
  'pixel.facebook.com',

  // Microsoft Clarity & Tracking
  'clarity.ms',
  'c.clarity.ms',
  'd.clarity.ms',
  'bat.bing.com',

  // Hotjar
  'script.hotjar.com',
  'static.hotjar.com',
  'vars.hotjar.com',
  'in.hotjar.com',

  // Analytics Platforms
  'api.mixpanel.com',
  'cdn.mxpnl.com',
  'mixpanel.com',
  'api.segment.io',
  'cdn.segment.com',
  'api.segment.com',
  'api.amplitude.com',
  'cdn.amplitude.com',
  'heapanalytics.com',
  'cdn.heapanalytics.com',
  'rs.fullstory.com',
  'edge.fullstory.com',
  'fullstory.com',
  'cdn.mouseflow.com',
  'api.mouseflow.com',
  'mouseflow.com',
  'script.crazyegg.com',
  'crazyegg.com',
  'cdn.optimizely.com',
  'log.optimizely.com',
  'optimizely.com',

  // Other Trackers
  'b.scorecardresearch.com',
  'sb.scorecardresearch.com',
  'bam.nr-data.net',
  'js-agent.newrelic.com',
  'newrelic.com',
  'beacon.riskified.com',
  'px.ads.linkedin.com',
  'snap.licdn.com',
  'dc.ads.linkedin.com',
  'sjs.bizographics.com',
  'rum.hlx.page',
  'cdn.cookielaw.org',
  'geolocation.onetrust.com',
  'cdn.pendo.io',
  'app.pendo.io',
  'pendo.io',
  'cdn.walkme.com',
  'walkme.com',
  'tags.tiqcdn.com',
  'collect.tealiumiq.com',
  'tealiumiq.com',
  'cdn.branch.io',
  'api2.branch.io',
  'branch.io',
  'sdk.iad-01.braze.com',
  'sdk.iad-03.braze.com',
  'braze.com',
  'api.onesignal.com',
  'cdn.onesignal.com',
  'onesignal.com',
  'app.launchdarkly.com',
  'events.launchdarkly.com',
  'launchdarkly.com',
  'app.getsentry.com',
  'o0.ingest.sentry.io',
  'sentry.io',
  'api.rollbar.com',
  'cdn.rollbar.com',
  'rollbar.com',
  'js.hs-scripts.com',
  'js.hs-analytics.net',
  'track.hubspot.com',
  'js.hsforms.net',
  'forms.hubspot.com',
  'hubspot.com',
  'cdn.ravenjs.com',
  'a.]]]perimeterx.net',
  'collector.perimeterx.net',
  'perimeterx.net',
  'cdn.cookiebot.com',
  'consentcdn.cookiebot.com',
  'cookiebot.com',
  'cdn.userway.org',
  'userway.org',
  'cdn.accessibe.com',
  'accessibe.com',
  'web.cvent.com',
  'cvent.com',
  'cdn.pdst.fm',
  'pdst.fm',
  'cdn.pdffiller.com',
  'logs.pdffiller.com',
  'cdn.moengage.com',
  'api.moengage.com',
  'moengage.com',
  'cdn.wootric.com',
  'eligibility.wootric.com',
  'wootric.com',
  'widget.intercom.io',
  'api.intercom.io',
  'intercom.io',
  'beacon.sift.com',
  'sift.com',
  'forter.com',
  'js.chargebee.com',
  'chargebee.com',
  'cdn.heapanalytics.com',
  'heapanalytics.com',
  'tracking.leadlander.com',
  'leadlander.com',
  'ping.chartbeat.net',
  'static.chartbeat.com',
  'chartbeat.com',
  'cdn.parsely.com',
  'srv.pixel-parsely.com',
  'parse.ly',
  'cdn.quantummetric.com',
  'quantummetric.com',
  'cdn.speedcurve.com',
  'lux.speedcurve.com',
  'speedcurve.com',
];

/**
 * Social media widget domains
 */
const SOCIAL_WIDGET_DOMAINS = [
  // Twitter/X Widgets
  'platform.twitter.com',
  'syndication.twitter.com',
  'cdn.syndication.twimg.com',

  // Facebook Widgets
  'connect.facebook.net',
  'staticxx.facebook.com',
  'www.facebook.com/plugins',
  'www.facebook.com/tr',
  'facebook.com/v*/plugins',

  // LinkedIn Widgets
  'platform.linkedin.com',
  'snap.licdn.com',

  // Instagram Widgets
  'platform.instagram.com',
  'www.instagram.com/embed.js',

  // Pinterest Widgets
  'widgets.pinterest.com',
  'assets.pinterest.com',
  'log.pinterest.com',

  // Reddit Widgets
  'embed.redditmedia.com',
  'www.redditstatic.com',

  // TikTok Widgets
  'www.tiktok.com/embed',
  'lf16-tiktok-web.ttwstatic.com',

  // Social Sharing
  'static.addtoany.com',
  'www.addtoany.com',
  's7.addthis.com',
  'm.addthis.com',
  'www.addthis.com',
  'sharethis.com',
  'w.sharethis.com',
  't.sharethis.com',
  'buttons.sharethis.com',
  'count.sharethis.com',

  // Disqus Comments
  'disqus.com',
  'a.disquscdn.com',
  'c.disquscdn.com',

  // Other Social
  'apis.google.com/js/plusone.js',
  'badge.stumbleupon.com',
  'tumblr.com/share',
  'bufferapp.com',
];

/**
 * Cryptocurrency miner domains
 */
const CRYPTO_MINER_DOMAINS = [
  // Coinhive and derivatives
  'coin-hive.com',
  'coinhive.com',
  'authedmine.com',
  'coinhive-proxy.com',
  'jsecoin.com',
  'cnhv.co',
  'crypto-loot.com',
  'cryptoloot.pro',
  'miner.pr0gramm.com',
  'minemytraffic.com',
  'ppoi.org',
  'projectpoi.com',
  'inwemo.com',
  'rocks.io',
  'coinhave.com',
  'minero.cc',
  'minero-proxy.com',
  'coinerra.com',
  'coin-have.com',
  'load.jsecoin.com',
  'server.jsecoin.com',
  'miner.jsecoin.com',
  'static.reasedoper.pw',
  'mataharirama.xyz',
  'kisshentai.net',
  'papoto.com',
  'coinhiveproxy.com',
  'afminer.com',
  'webmine.pro',
  'webmine.cz',
  'minr.pw',
  'hashing.win',
  'hashforcash.us',
  'coinblind.com',
  'coinnebula.com',
  'freecontent.stream',
  'freecontent.date',
  'freecontent.bid',
  'freecontent.win',
  'freecontent.faith',
  'freecontent.party',
  'freecontent.racing',
  'freecontent.review',
  'freecontent.science',
  'freecontent.trade',
  'freecontent.loan',
  'freecontent.download',
  'freecontent.cricket',
  'freecontent.accountant',
  'freecontent.men',
  'freecontent.gdn',
  'azvjudwr.info',
  'jyhfuqoh.info',
  'kdowqlpt.info',
  'jroqvbvw.info',
  'browsermine.com',
  'webminepool.com',
  'webminepool.tk',
  'cloudcoins.co',
  'coinlab.biz',
  'coinpot.co',
  'l33tguy.com',
  'easyhash.io',
  'morningdigit.com',
  'bmst.pw',
  'bmnr.pw',
  'webassembly.stream',
  'sparechange.io',
  'minecrunch.co',
  'minethatcash.com',
  'minexmr.com',
  'miningpool.party',
  '2giga.link',
  '2giga.download',
  'cryptobara.com',
  'cryptonight.wasm',
  'grfrgeafew.tk',
  'gridcash.net',
  'hatcoin.org',
  'hashanywhere.com',
  'hashunlock.com',
  'hostingcloud.download',
  'host-games.com',
  'jqcdn.download',
  'jscdn.date',
  'jshosting.pw',
  'jscdn.codes',
  'jquery.host',
  'kippfrend.top',
  'kissdoujin.com',
  'kissmanga.com/Content/js/cpt.js',
  'ledhenone.com',
  'lightminer.co',
  'lmodr.biz',
  'lpcdn.bid',
  'lpcdn.biz',
  'lpcdn.date',
  'lpcdn.download',
  'lpcdn.faith',
  'lpcdn.loan',
  'lpcdn.men',
  'lpcdn.party',
  'lpcdn.pw',
  'lpcdn.racing',
  'lpcdn.review',
  'lpcdn.science',
  'lpcdn.stream',
  'lpcdn.trade',
  'lpcdn.win',
  'lpcdn.xyz',
  'mepirtedic.com',
  'minerad.biz',
  'minergate.com/miner',
  'minerhills.com',
  'monerise.com',
  'monerominer.rocks',
  'mxcdn.bid',
  'mxcdn.biz',
  'mxcdn.date',
  'mxcdn.download',
  'mxcdn.faith',
  'mxcdn.men',
  'mxcdn.racing',
  'mxcdn.review',
  'mxcdn.science',
  'mxcdn.stream',
  'mxcdn.trade',
  'mxcdn.win',
];

/**
 * Generate blocking patterns from domain list
 * @param {string[]} domains - List of domains
 * @returns {string[]} - List of blocking patterns
 */
function generatePatternsFromDomains(domains) {
  const patterns = [];
  for (const domain of domains) {
    // Add patterns for all protocols
    patterns.push(`*://${domain}/*`);
    patterns.push(`*://*.${domain}/*`);
  }
  return patterns;
}

/**
 * Built-in filter lists with patterns
 */
const BUILTIN_FILTERS = {
  ads: {
    name: 'Advertisements',
    description: 'Blocks common advertising networks and ad servers',
    patterns: generatePatternsFromDomains(AD_DOMAINS),
    enabled: true,
  },
  trackers: {
    name: 'Trackers',
    description: 'Blocks analytics and tracking services',
    patterns: generatePatternsFromDomains(TRACKER_DOMAINS),
    enabled: true,
  },
  social: {
    name: 'Social Media Widgets',
    description: 'Blocks social media sharing buttons and embedded content',
    patterns: generatePatternsFromDomains(SOCIAL_WIDGET_DOMAINS),
    enabled: false,
  },
  cryptominers: {
    name: 'Cryptocurrency Miners',
    description: 'Blocks browser-based cryptocurrency mining scripts',
    patterns: generatePatternsFromDomains(CRYPTO_MINER_DOMAINS),
    enabled: true,
  },
};

/**
 * Additional blocking patterns for specific ad/tracker URLs
 */
const ADDITIONAL_PATTERNS = {
  ads: [
    // Script patterns
    '*://*/ads.js',
    '*://*/ads.min.js',
    '*://*/advertisement.js',
    '*://*/ad_*.js',
    '*://*/advert*.js',
    '*://*/banner*.js',
    '*://*/popup*.js',
    '*://*/sponsor*.js',
    // Image patterns
    '*://*/ads/*',
    '*://*/ad/*',
    '*://*/advertisement/*',
    '*://*/banners/*',
    '*://*/sponsor/*',
    // Query patterns
    '*://*/*?*ad=*',
    '*://*/*?*ads=*',
    '*://*/*?*advert*=*',
  ],
  trackers: [
    // Common tracking endpoints
    '*://*/beacon*',
    '*://*/pixel*',
    '*://*/track*',
    '*://*/collect*',
    '*://*/analytics*',
    '*://*/telemetry*',
    '*://*/metrics*',
    '*://*/log*',
    '*://*/event*',
    // Query patterns for tracking
    '*://*/*?*utm_*=*',
    '*://*/*?*fbclid=*',
    '*://*/*?*gclid=*',
    '*://*/*?*_ga=*',
  ],
};

/**
 * Parse an EasyList format filter list
 * Supports basic EasyList syntax
 * @param {string} content - EasyList format content
 * @returns {Object} - Parsed filters
 */
function parseEasyList(content) {
  const result = {
    title: '',
    homepage: '',
    lastModified: '',
    version: '',
    blockPatterns: [],
    allowPatterns: [],
    elementHideRules: [],
    errors: [],
  };

  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip empty lines and comments
    if (!line || line.startsWith('!')) {
      // Parse metadata from comments
      if (line.startsWith('! Title:')) {
        result.title = line.substring(8).trim();
      } else if (line.startsWith('! Homepage:')) {
        result.homepage = line.substring(11).trim();
      } else if (line.startsWith('! Last modified:')) {
        result.lastModified = line.substring(16).trim();
      } else if (line.startsWith('! Version:')) {
        result.version = line.substring(10).trim();
      }
      continue;
    }

    // Skip filter list header
    if (line.startsWith('[Adblock')) {
      continue;
    }

    try {
      // Element hiding rules (##)
      if (line.includes('##') && !line.startsWith('@@')) {
        const [domains, selector] = line.split('##');
        result.elementHideRules.push({
          domains: domains ? domains.split(',') : ['*'],
          selector: selector,
        });
        continue;
      }

      // Element hiding exception (@#)
      if (line.includes('#@#')) {
        // Skip for now - element hiding exceptions
        continue;
      }

      // Exception rules (@@)
      if (line.startsWith('@@')) {
        const pattern = convertEasyListPatternToGlob(line.substring(2));
        if (pattern) {
          result.allowPatterns.push(pattern);
        }
        continue;
      }

      // Regular blocking rules
      const pattern = convertEasyListPatternToGlob(line);
      if (pattern) {
        result.blockPatterns.push(pattern);
      }
    } catch (error) {
      result.errors.push({
        line: i + 1,
        content: line,
        error: error.message,
      });
    }
  }

  return result;
}

/**
 * Convert EasyList pattern to glob pattern
 * @param {string} pattern - EasyList pattern
 * @returns {string|null} - Glob pattern or null if not convertible
 */
function convertEasyListPatternToGlob(pattern) {
  if (!pattern) return null;

  // Remove options part (after $)
  let cleanPattern = pattern.split('$')[0];

  if (!cleanPattern) return null;

  // Handle domain anchors (||)
  if (cleanPattern.startsWith('||')) {
    cleanPattern = cleanPattern.substring(2);
    // Convert to wildcard protocol pattern
    return `*://*.${cleanPattern.replace(/\^/g, '*').replace(/\|/g, '')}`;
  }

  // Handle start anchor (|)
  if (cleanPattern.startsWith('|')) {
    cleanPattern = cleanPattern.substring(1);
    return cleanPattern.replace(/\^/g, '*').replace(/\|/g, '');
  }

  // Handle end anchor (|)
  if (cleanPattern.endsWith('|')) {
    cleanPattern = cleanPattern.substring(0, cleanPattern.length - 1);
  }

  // Convert separator (^) to wildcard
  cleanPattern = cleanPattern.replace(/\^/g, '*');

  // If no protocol specified, add wildcard protocol
  if (!cleanPattern.includes('://')) {
    cleanPattern = `*://*${cleanPattern}`;
  }

  return cleanPattern;
}

/**
 * Get all built-in filter patterns
 * @param {string[]} categories - Categories to include (empty = all enabled)
 * @returns {Object} - Block and allow patterns
 */
function getBuiltinPatterns(categories = []) {
  const blockPatterns = [];
  const includedCategories = categories.length > 0
    ? categories
    : Object.keys(BUILTIN_FILTERS).filter(k => BUILTIN_FILTERS[k].enabled);

  for (const category of includedCategories) {
    const filter = BUILTIN_FILTERS[category];
    if (filter) {
      blockPatterns.push(...filter.patterns);
      if (ADDITIONAL_PATTERNS[category]) {
        blockPatterns.push(...ADDITIONAL_PATTERNS[category]);
      }
    }
  }

  // Remove duplicates
  return {
    blockPatterns: [...new Set(blockPatterns)],
    allowPatterns: [],
  };
}

/**
 * Get filter list info
 * @returns {Object} - Info about available filter lists
 */
function getFilterListInfo() {
  const info = {};
  for (const [key, filter] of Object.entries(BUILTIN_FILTERS)) {
    info[key] = {
      name: filter.name,
      description: filter.description,
      patternCount: filter.patterns.length,
      enabled: filter.enabled,
    };
  }
  return info;
}

/**
 * Common EasyList URLs
 */
const EASYLIST_URLS = {
  easylist: 'https://easylist.to/easylist/easylist.txt',
  easyprivacy: 'https://easylist.to/easylist/easyprivacy.txt',
  easylistCookie: 'https://easylist-downloads.adblockplus.org/easylist-cookie.txt',
  fanboySocial: 'https://easylist.to/easylist/fanboy-social.txt',
  fanboyAnnoyance: 'https://easylist.to/easylist/fanboy-annoyance.txt',
  antiadblock: 'https://easylist-downloads.adblockplus.org/antiadblockfilters.txt',
  uBlockAnnoyances: 'https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/annoyances.txt',
  peterlowe: 'https://pgl.yoyo.org/adservers/serverlist.php?hostformat=adblockplus&showintro=1&mimetype=plaintext',
};

module.exports = {
  AD_DOMAINS,
  TRACKER_DOMAINS,
  SOCIAL_WIDGET_DOMAINS,
  CRYPTO_MINER_DOMAINS,
  BUILTIN_FILTERS,
  ADDITIONAL_PATTERNS,
  EASYLIST_URLS,
  parseEasyList,
  convertEasyListPatternToGlob,
  getBuiltinPatterns,
  getFilterListInfo,
  generatePatternsFromDomains,
};
