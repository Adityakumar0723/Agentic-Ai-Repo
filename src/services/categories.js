const CATEGORIES = {
  world: ["bbc", "bbc_world", "bbc_uk", "bbc_politics", "cnn", "cnn_world", "cnn_us", "cnn_politics", "guardian", "guardian_uk", "guardian_us", "guardian_opinion", "aljazeera", "npr", "npr_world", "npr_politics", "pbs", "skynews", "skynews_uk", "dw", "france24", "nhk", "axios", "thehill", "nytimes", "nytimes_world", "nytimes_us", "nytimes_politics", "nytimes_opinion", "foxnews", "abcnews", "cbsnews", "vox", "slate", "newsweek", "huffpost", "usatoday_top", "time", "theintercept", "thedailybeast", "salon", "motherjones", "reason", "foreignpolicy", "theatlantic"],
  asia: ["scmp", "straitstimes", "abcaus", "abcaus_world", "cbcca", "cbcca_world", "japantimes", "bangkokpost", "channelnewsasia", "nzherald", "smh", "koreaherald", "globalnews_ca"],
  india: ["ndtv", "ndtv_india", "ndtv_world", "ndtv_sports", "toi", "toi_world", "toi_tech", "toi_sports", "toi_entertainment", "hindustantimes", "hindustantimes_world", "thehindu", "thehindu_international", "indianexpress", "indianexpress_world", "indianexpress_tech", "economictimes", "economictimes_tech", "economictimes_markets", "livemint", "livemint_tech", "indiatoday", "indiatoday_india", "businessstandard", "news18", "news18_world", "dnaindia", "oneindia", "deccanherald", "tribuneindia"],
  middleeast: ["jerusalempost", "middleeasteye", "arabnews", "thenationalnews", "aljazeera"],
  europe: ["lemonde", "derspiegel", "elpais", "euronews", "irish_times", "dutchnews", "thelocal_se", "thelocal_de", "thelocal_fr", "thelocal_it", "thelocal_es", "rte", "swissinfo", "balkan_insight"],
  latam: ["mercopress", "batimes", "ticotimes"],
  africa: ["allafrica", "news24_sa", "theeastafrican", "citizen_za"],
  business: ["bloomberg", "cnbc", "cnbc_world", "cnbc_tech", "cnbc_finance", "marketwatch", "businessinsider", "ft", "moneycontrol", "moneycontrol_markets", "seeking_alpha", "yahoo_finance", "nytimes_business", "nytimes_economy", "guardian_business", "investing_com", "fortune", "economictimes", "economictimes_markets", "businessstandard", "livemint"],
  crypto: ["coindesk", "cointelegraph", "theblock", "decrypt", "bitcoinmagazine", "cryptoslate", "beincrypto", "ambcrypto", "cryptopotato", "defiant"],
  technology: ["bbc_tech", "cnn_tech", "guardian_tech", "nytimes_tech", "techcrunch", "theverge", "wired", "arstechnica", "engadget", "hackernews", "mashable", "zdnet", "tomshardware", "androidcentral", "nine_to_five_mac", "nine_to_five_google", "thenextweb", "gizmodo", "cnet", "techradar", "theregister", "slashdot", "pcworld", "macrumors", "mit_tech_review", "howtogeek", "xda", "windowscentral", "bleepingcomputer", "digitrends", "lifehacker", "makeuseof"],
  cybersecurity: ["hackernews_security", "darkreading", "threatpost", "krebsonsecurity", "securityweek", "thehackernews_sec", "naked_security", "bleepingcomputer"],
  programming: ["dev_to", "hackernoon", "smashingmag", "css_tricks", "scotch_io", "sitepoint", "infoq", "dzone", "github_blog"],
  ai: ["openai_blog", "deepmind_blog", "mlnews", "towardsdatascience", "analyticsvidhya", "kdnuggets", "venturebeat_ai", "huggingface_blog", "aitrends"],
  science: ["bbc_science", "nytimes_science", "guardian_science", "npr_science", "sciencedaily", "nasa", "nasa_image", "newscientist", "phys_org", "space_com", "livescience", "eos", "iflscience", "sciencealert", "smithsonianmag", "popularmechanics", "popsci"],
  health: ["cnn_health", "nytimes_health", "npr_health", "who_news", "statnews", "medpagetoday", "healthline", "medicalnewstoday", "health_com"],
  climate: ["guardian_environment", "guardian_climate", "mongabay", "carbonbrief", "climatehome", "treehugger", "insideclimatenews", "ecowatch"],
  sports: ["bbc_sport", "bbc_football", "bbc_cricket", "bbc_tennis", "bbc_f1", "nytimes_sports", "espn", "espn_football", "espn_nba", "espn_nfl", "skysports", "skysports_football", "sportskeeda", "cricinfo", "f1", "cbssports", "si", "theathletic", "ndtv_sports", "toi_sports"],
  entertainment: ["variety", "hollywoodreporter", "deadline", "tmz", "eonline", "collider", "screenrant", "avclub", "indiewire", "comicbook", "denofgeek", "toi_entertainment"],
  gaming: ["polygon", "ign", "kotaku", "eurogamer", "gamespot", "pcgamer", "rockpapershotgun", "nintendolife", "gamesradar", "pushsquare", "purexbox", "destructoid", "gamedeveloper"],
  music: ["billboard", "rollingstone", "pitchfork", "nme", "stereogum", "consequenceofsound", "brooklynvegan"],
  food: ["eater", "bonappetit", "seriouseats", "foodandwine", "tastingtable"],
  travel: ["lonelyplanet", "cntraveler", "travelandleisure", "afar"],
  automotive: ["motortrend", "caranddriver", "jalopnik", "autoblog", "topgear", "electrek", "insideevs"],
  realestate: ["curbed", "housingwire"],
  education: ["mit_news", "ed_week", "chronicle_he", "insidehighered", "edsurge", "ted_blog"],
  law: ["lawfaremedia", "scotusblog", "jurist"],
  startups: ["techcrunch_startups", "saastr", "producthunt", "betalist", "startupgrind"],
  design: ["designernews", "uxdesign", "abduzeedo", "creativebloq", "yankodesign"],
  space: ["nasa", "nasa_image", "spacenews", "nasaspaceflight", "universetoday", "skyandtelescope", "planetary_org", "space_com"],
  defense: ["defensenews", "janes", "warisboring"],
  philosophy: ["aeon", "brainpickings", "openculture", "dailystoic"],
};

function getCategoryForSource(sourceKey) {
  for (const [cat, keys] of Object.entries(CATEGORIES)) {
    if (keys.includes(sourceKey)) return cat;
  }
  return "uncategorized";
}

function getSourcesForCategory(category) {
  return CATEGORIES[category] || [];
}

function listCategories() {
  return Object.entries(CATEGORIES).map(([name, keys]) => ({
    name,
    count: keys.length,
  }));
}

module.exports = { CATEGORIES, getCategoryForSource, getSourcesForCategory, listCategories };
