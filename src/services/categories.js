const CATEGORIES = {
  world: ["bbc", "bbc_world", "bbc_uk", "bbc_politics", "bbc_education", "bbc_asia", "bbc_africa", "bbc_europe", "bbc_middleeast", "bbc_latam", "cnn", "cnn_world", "cnn_us", "cnn_politics", "guardian", "guardian_uk", "guardian_us", "guardian_opinion", "guardian_australia", "guardian_europe", "aljazeera", "npr", "npr_world", "npr_politics", "pbs", "skynews", "skynews_uk", "dw", "france24", "nhk", "axios", "thehill", "nytimes", "nytimes_world", "nytimes_us", "nytimes_politics", "nytimes_opinion", "foxnews", "abcnews", "cbsnews", "vox", "slate", "newsweek", "huffpost", "time", "theintercept", "thedailybeast", "salon", "motherjones", "reason", "foreignpolicy", "theatlantic", "csmonitor", "propublica", "theconversation", "globalvoices"],
  asia: ["scmp", "straitstimes", "abcaus", "abcaus_world", "cbcca", "cbcca_world", "cbcca_tech", "cbcca_politics", "cbcca_business", "japantimes", "bangkokpost", "channelnewsasia", "smh", "globalnews_ca", "stuff_nz", "dawn", "dailystar_bd", "inquirer_ph", "bbc_asia", "dw_asia"],
  india: ["ndtv", "ndtv_india", "ndtv_world", "ndtv_sports", "ndtv_tech", "toi", "toi_world", "toi_tech", "toi_sports", "toi_entertainment", "toi_business", "toi_city", "toi_life", "hindustantimes", "hindustantimes_world", "hindustantimes_sports", "hindustantimes_entertainment", "hindustantimes_tech", "thehindu", "thehindu_international", "thehindu_sports", "thehindu_entertainment", "thehindu_science", "thehindu_tech", "indianexpress", "indianexpress_world", "indianexpress_tech", "indianexpress_sports", "indianexpress_entertainment", "indianexpress_lifestyle", "economictimes", "economictimes_tech", "economictimes_markets", "economictimes_startups", "livemint", "livemint_tech", "livemint_markets", "indiatoday", "indiatoday_india", "indiatoday_tech", "businessstandard", "businessstandard_markets", "news18", "news18_world", "news18_tech", "news18_sports", "news18_entertainment", "dnaindia", "oneindia", "tribuneindia", "swarajya", "scroll_in", "thequint"],
  middleeast: ["jerusalempost", "arabnews", "thenationalnews", "middleeasteye", "almonitor", "aljazeera", "bbc_middleeast"],
  europe: ["lemonde", "derspiegel", "elpais", "euronews", "irish_times", "dutchnews", "thelocal_se", "thelocal_de", "thelocal_fr", "thelocal_it", "thelocal_es", "thelocal_no", "thelocal_at", "thelocal_ch", "thelocal_dk", "rte", "swissinfo", "balkan_insight", "politico_eu", "bbc_europe", "dw_europe", "guardian_europe"],
  latam: ["mercopress", "batimes", "ticotimes", "brasilwire", "bbc_latam"],
  africa: ["allafrica", "news24_sa", "theeastafrican", "citizen_za", "punch_ng", "premiumtimes_ng", "nation_ke", "bbc_africa"],
  business: ["bloomberg", "cnbc", "cnbc_world", "cnbc_tech", "cnbc_finance", "cnbc_earnings", "marketwatch", "marketwatch_markets", "businessinsider", "ft", "moneycontrol", "moneycontrol_markets", "moneycontrol_business", "moneycontrol_tech", "seeking_alpha", "yahoo_finance", "nytimes_business", "nytimes_economy", "guardian_business", "guardian_money", "investing_com", "fortune", "fastcompany", "entrepreneur", "inc", "hbr", "skynews_business", "dw_business", "npr_business", "economictimes", "economictimes_markets", "businessstandard", "businessstandard_markets", "livemint", "livemint_markets"],
  crypto: ["coindesk", "cointelegraph", "theblock", "decrypt", "bitcoinmagazine", "cryptoslate", "beincrypto", "ambcrypto", "cryptopotato", "defiant", "blockonomi", "newsbtc", "dailyhodl", "unchained", "bankless"],
  technology: ["bbc_tech", "cnn_tech", "guardian_tech", "nytimes_tech", "techcrunch", "techcrunch_apps", "techcrunch_gadgets", "theverge", "wired", "wired_gear", "arstechnica", "arstechnica_gadgets", "engadget", "hackernews", "hackernews_best", "mashable", "zdnet", "tomshardware", "androidcentral", "androidauthority", "nine_to_five_mac", "nine_to_five_google", "thenextweb", "gizmodo", "cnet", "techradar", "theregister", "slashdot", "pcworld", "macrumors", "mit_tech_review", "howtogeek", "xda", "windowscentral", "bleepingcomputer", "digitaltrends", "lifehacker", "makeuseof", "appleinsider", "phonearena", "gsmarena", "notebookcheck", "anandtech", "protocoldotcom", "restofworld", "skynews_tech", "dw_science", "cbcca_tech", "ndtv_tech", "toi_tech", "hindustantimes_tech", "thehindu_tech", "indianexpress_tech", "economictimes_tech", "livemint_tech", "indiatoday_tech", "news18_tech", "moneycontrol_tech"],
  cybersecurity: ["darkreading", "threatpost", "krebsonsecurity", "securityweek", "thehackernews_sec", "naked_security", "hackernews_security", "schneier", "cyberscoop", "zdnet_security", "tripwire", "bleepingcomputer"],
  programming: ["dev_to", "dev_to_top", "hackernoon", "smashingmag", "css_tricks", "sitepoint", "infoq", "dzone", "github_blog", "github_changelog", "freecodecamp", "stackoverflow_blog", "devops_com", "thenewstack", "hashnode", "medium_programming", "logrocket"],
  ai: ["openai_blog", "deepmind_blog", "mlnews", "towardsdatascience", "analyticsvidhya", "kdnuggets", "venturebeat_ai", "huggingface_blog", "aitrends", "marktechpost", "aibusiness", "aimag", "unite_ai", "datasciencecentral", "medium_ai"],
  science: ["bbc_science", "nytimes_science", "guardian_science", "npr_science", "sciencedaily", "sciencedaily_health", "sciencedaily_tech", "sciencedaily_environment", "nasa", "nasa_image", "newscientist", "phys_org", "phys_org_tech", "phys_org_space", "space_com", "livescience", "iflscience", "sciencealert", "smithsonianmag", "popularmechanics", "popsci", "eos", "quantamagazine", "scienceamerican", "wired_science", "arstechnica_science", "thehindu_science", "dw_science"],
  space: ["nasa", "nasa_image", "spacenews", "nasaspaceflight", "universetoday", "skyandtelescope", "planetary_org", "spacepolicyonline", "spaceflightnow", "space_com", "phys_org_space"],
  health: ["cnn_health", "nytimes_health", "npr_health", "who_news", "statnews", "medpagetoday", "healthline", "medicalnewstoday", "webmd_news", "everydayhealth", "health_harvard", "psychologytoday", "medscape", "sciencedaily_health"],
  climate: ["guardian_environment", "guardian_climate", "nytimes_climate", "mongabay", "carbonbrief", "climatehome", "treehugger", "insideclimatenews", "ecowatch", "grist", "cleantech", "reneweconomy", "sciencedaily_environment"],
  sports: ["bbc_sport", "bbc_football", "bbc_cricket", "bbc_tennis", "bbc_f1", "bbc_rugby", "bbc_golf", "bbc_boxing", "nytimes_sports", "espn", "espn_football", "espn_nba", "espn_nfl", "espn_mlb", "espn_tennis", "skysports", "skysports_football", "skysports_cricket", "skysports_f1", "sportskeeda", "cricinfo", "f1", "cbssports", "theathletic", "sbnation", "sportingnews", "bleacherreport", "wrestlinginc", "mmafighting", "marca_en", "ndtv_sports", "toi_sports", "hindustantimes_sports", "thehindu_sports", "indianexpress_sports", "news18_sports", "guardian_football", "guardian_cricket"],
  entertainment: ["variety", "hollywoodreporter", "deadline", "tmz", "eonline", "collider", "screenrant", "avclub", "indiewire", "comicbook", "denofgeek", "slashfilm", "cinemablend", "cbr", "giantfreakinrobot", "theplaylist", "filmschoolrejects", "cnn_entertainment", "nytimes_arts", "nytimes_movies", "guardian_film", "toi_entertainment", "hindustantimes_entertainment", "indianexpress_entertainment", "news18_entertainment", "thehindu_entertainment"],
  gaming: ["polygon", "ign", "ign_playstation", "ign_xbox", "ign_nintendo", "ign_pc", "kotaku", "eurogamer", "gamespot", "pcgamer", "rockpapershotgun", "nintendolife", "gamesradar", "pushsquare", "purexbox", "destructoid", "gamedeveloper", "dualshockers", "vg247", "siliconera", "toucharcade", "rpgsite"],
  music: ["billboard", "rollingstone", "rollingstone_music", "pitchfork", "nme", "stereogum", "consequenceofsound", "brooklynvegan", "spin", "loudwire", "metal_injection", "edm_com", "guardian_music"],
  food: ["eater", "bonappetit", "seriouseats", "foodandwine", "tastingtable", "thespruceeats", "epicurious", "saveur", "food52", "nytimes_food"],
  travel: ["cnn_travel", "cnn_travel2", "lonelyplanet", "cntraveler", "travelandleisure", "afar", "matadornetwork", "thepointsguy", "nomadicmatt", "skyscanner_news", "nytimes_travel"],
  automotive: ["motortrend", "caranddriver", "jalopnik", "autoblog", "topgear", "electrek", "insideevs", "thedrive", "roadandtrack", "carscoops", "carbuzz", "greencarreports"],
  realestate: ["curbed", "housingwire", "inman", "realtor_com", "nytimes_realestate"],
  education: ["mit_news", "ed_week", "insidehighered", "edsurge", "ted_blog", "edutopia", "campustechnology", "timeshighered", "harvard_gazette", "stanford_news", "oxford_news", "cambridge_news", "bbc_education", "npr_education", "guardian_education", "nytimes_education"],
  law: ["lawfaremedia", "scotusblog", "jurist", "law_com", "techdirt", "eff"],
  startups: ["techcrunch_startups", "techcrunch_venture", "saastr", "producthunt", "betalist", "startupgrind", "ycombinator_blog", "crunchbase_news", "eu_startups", "yourstory", "economictimes_startups"],
  design: ["uxdesign", "abduzeedo", "creativebloq", "yankodesign", "designboom", "archdaily", "dezeen", "core77", "designmilk", "itsnicethat", "designweek"],
  defense: ["defensenews", "warisboring", "defenseone", "breakingdefense", "militarytimes"],
  philosophy: ["aeon", "brainpickings", "openculture", "dailystoic", "philosophynow", "lithub", "electricliterature", "theparisreview", "nytimes_books", "npr_books", "guardian_books"],
  personalfinance: ["nerdwallet", "bankrate", "fool", "thebalance", "moneyunder30", "guardian_money"],
  fashion: ["vogue", "gq", "harpersbazaar", "allure", "refinery29", "highsnobiety", "hypebeast", "complex", "nytimes_fashion"],
  parenting: ["parents", "todaysparent", "fatherly", "romper", "scarymommy"],
  fitness: ["menshealth", "womenshealth", "runnersworld", "mindbodygreen", "wellandgood"],
  home: ["apartmenttherapy", "bobvila", "thekitchn", "bhg", "dwell"],
  pets: ["thedodo", "dogster", "catster"],
  photography: ["petapixel", "dpreview", "fstoppers", "diyphotography"],
  history: ["historydaily", "historyextra", "warhistoryonline"],
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
