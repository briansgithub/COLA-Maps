export interface AcronymDef {
  term: string;
  expansion: string;
}

export interface BibliographyEntry {
  id: string;
  title: string;
  publisher: string;
  url: string;
  note?: string;
}

export interface ReliabilityNote {
  title: string;
  body: string;
}

export const ACRONYMS: AcronymDef[] = [
  { term: "ACS", expansion: "American Community Survey (U.S. Census Bureau)" },
  { term: "AHETPI", expansion: "Average Hourly Earnings of Production and Nonsupervisory Employees (BLS series redistributed by FRED)" },
  { term: "API", expansion: "Application Programming Interface" },
  { term: "BEA", expansion: "U.S. Bureau of Economic Analysis" },
  { term: "BLS", expansion: "U.S. Bureau of Labor Statistics" },
  { term: "CBSA", expansion: "Core-Based Statistical Area (metro/micro area code)" },
  { term: "CPI", expansion: "Consumer Price Index" },
  { term: "CPI-U", expansion: "Consumer Price Index for All Urban Consumers" },
  { term: "FIPS", expansion: "Federal Information Processing Series geographic code" },
  { term: "FMR", expansion: "Fair Market Rent (HUD)" },
  { term: "FRED", expansion: "Federal Reserve Economic Data (Federal Reserve Bank of St. Louis)" },
  { term: "FY", expansion: "Fiscal Year" },
  { term: "HUD", expansion: "U.S. Department of Housing and Urban Development" },
  { term: "kWh", expansion: "kilowatt-hour" },
  { term: "MARPP", expansion: "Metropolitan Area Regional Price Parities (BEA)" },
  { term: "MSPUS", expansion: "Median Sales Price of Houses Sold for the United States (Census/HUD series on FRED)" },
  { term: "OER", expansion: "Owners’ Equivalent Rent" },
  { term: "OUSEA", expansion: "Office of the Under Secretary for Economic Affairs (U.S. Department of Commerce)" },
  { term: "PCE", expansion: "Personal Consumption Expenditures price index" },
  { term: "RPP", expansion: "Regional Price Parities" },
  { term: "S&P", expansion: "S&P Global (publisher of the Case-Shiller home-price indexes; formerly S&P Cotality Case-Shiller)" },
  { term: "USPS", expansion: "United States Postal Service" },
];

export const BIBLIOGRAPHY: BibliographyEntry[] = [
  {
    id: "bls-cpi",
    title: "Consumer Price Index (CPI-U) and category indexes",
    publisher: "U.S. Bureau of Labor Statistics",
    url: "https://www.bls.gov/cpi/",
    note: "Series pages used in this app begin at https://data.bls.gov/timeseries/CUUR0000SA0",
  },
  {
    id: "bls-apu",
    title: "Average Price Data (APU) — observed shelf prices",
    publisher: "U.S. Bureau of Labor Statistics",
    url: "https://www.bls.gov/cpi/factsheets/average-prices.htm",
    note: "Example series: https://data.bls.gov/timeseries/APU0000708111",
  },
  {
    id: "bls-api",
    title: "BLS Public Data API",
    publisher: "U.S. Bureau of Labor Statistics",
    url: "https://www.bls.gov/developers/",
  },
  {
    id: "bea-pce",
    title: "Personal Consumption Expenditures Price Index (PCEPI)",
    publisher: "U.S. Bureau of Economic Analysis via FRED",
    url: "https://fred.stlouisfed.org/series/PCEPI",
  },
  {
    id: "bea-rpp",
    title: "Regional Price Parities / MARPP metro download",
    publisher: "U.S. Bureau of Economic Analysis",
    url: "https://apps.bea.gov/regional/zip/MARPP.zip",
    note: "Program overview: https://www.bea.gov/data/prices-inflation/regional-price-parities-state-and-metro-area",
  },
  {
    id: "fred",
    title: "Federal Reserve Economic Data (FRED)",
    publisher: "Federal Reserve Bank of St. Louis",
    url: "https://fred.stlouisfed.org/",
  },
  {
    id: "case-shiller",
    title: "S&P CoreLogic Case-Shiller U.S. National Home Price Index (CSUSHPINSA)",
    publisher: "S&P Dow Jones Indices via FRED",
    url: "https://fred.stlouisfed.org/series/CSUSHPINSA",
  },
  {
    id: "wages",
    title: "Average Hourly Earnings of Production and Nonsupervisory Employees (AHETPI)",
    publisher: "U.S. Bureau of Labor Statistics via FRED",
    url: "https://fred.stlouisfed.org/series/AHETPI",
  },
  {
    id: "mspus",
    title: "Median Sales Price of Houses Sold for the United States (MSPUS)",
    publisher: "U.S. Census Bureau / HUD via FRED",
    url: "https://fred.stlouisfed.org/series/MSPUS",
  },
  {
    id: "big-mac",
    title: "Big Mac Index full-index CSV",
    publisher: "The Economist",
    url: "https://raw.githubusercontent.com/TheEconomist/big-mac-data/master/output-data/big-mac-full-index.csv",
    note: "Project page: https://github.com/TheEconomist/big-mac-data",
  },
  {
    id: "usps",
    title: "Domestic letter rates since 1863",
    publisher: "United States Postal Service",
    url: "https://about.usps.com/who/profile/history/domestic-letter-rates-since-1863.htm",
  },
  {
    id: "farm-bureau",
    title: "Thanksgiving dinner cost survey",
    publisher: "American Farm Bureau Federation",
    url: "https://www.fb.org/news-release/cost-of-thanksgiving-dinner-declines",
    note: "Prior-year comparison PDF: https://www.fb.org/files/Year-Over-Year-Price-Comparison-2024.pdf",
  },
  {
    id: "ousea",
    title: "Experimental county-level Regional Price Parities dataset",
    publisher: "U.S. Department of Commerce, Office of the Under Secretary for Economic Affairs",
    url: "https://www.commerce.gov/sites/default/files/2024-03/0324-experimental-data-set.csv",
    note: "Working paper: https://www.commerce.gov/sites/default/files/2024-03/working-paper-estimating-county-level-regional-price-parities-from-public-data.pdf",
  },
  {
    id: "hud-fmr",
    title: "Fair Market Rents (FMR)",
    publisher: "U.S. Department of Housing and Urban Development",
    url: "https://www.huduser.gov/portal/datasets/fmr.html",
  },
  {
    id: "acs",
    title: "American Community Survey 5-year estimates",
    publisher: "U.S. Census Bureau",
    url: "https://www.census.gov/programs-surveys/acs",
    note: "Table browser: https://data.census.gov/ (tables B25064 median gross rent; B01003 total population)",
  },
  {
    id: "census-geo",
    title: "Cartographic boundary files",
    publisher: "U.S. Census Bureau",
    url: "https://www.census.gov/geographies/mapping-files/time-series/geo/cartographic-boundary.html",
  },
];

export const RELIABILITY_NOTES: ReliabilityNote[] = [
  {
    title: "Bureau of Labor Statistics CPI-U and category indexes",
    body: "The Consumer Price Index for All Urban Consumers (CPI-U) is the United States’ primary official measure of consumer inflation. The Bureau of Labor Statistics (BLS) collects prices across a large, documented sample of urban goods and services, publishes the methodology, and revises seasonally adjusted series on a known schedule. Category indexes such as food at home, rent, gasoline, medical care, and tuition inherit that institutional process, which makes them appropriate for tracking how broad spending categories change over decades. Their limitations matter: the CPI-U is a national urban average, so it does not show local price levels; Owners’ Equivalent Rent (OER) is a modeled homeowner cost rather than a market home-price series; and the fixed-weight structure can diverge from any one household’s lived basket. Missing months in thin categories sometimes require interpolation or splicing in this app’s workbook build.",
  },
  {
    title: "Bureau of Labor Statistics Average Price Data",
    body: "Average Price Data report actual observed dollar prices for specific items—eggs per dozen, milk per gallon, gasoline per gallon, electricity per kilowatt-hour, and similar shelf prices. Because the units are concrete dollars rather than index points, these series are useful cross-checks on how everyday items moved relative to the broader CPI. Reliability comes from the same BLS collection system, but coverage is narrower: only selected items are published, city and quality mix can shift, and some series start later than January 1995 or have gaps. They should be read as illustrative item prices, not as a complete cost-of-living index.",
  },
  {
    title: "Bureau of Economic Analysis Personal Consumption Expenditures price index",
    body: "The Personal Consumption Expenditures (PCE) price index is produced by the Bureau of Economic Analysis (BEA) and is the inflation gauge preferred by the Federal Reserve for monetary-policy analysis. It covers a broader consumption concept than CPI-U, updates weights more continuously, and is constructed within the national accounts framework. Those traits make it a strong second official benchmark alongside CPI-U. Limitations include different scope and formula choices from CPI-U, so the two series will not match exactly; PCE remains a national aggregate and does not locate prices by city or county.",
  },
  {
    title: "Federal Reserve Economic Data (FRED)",
    body: "Federal Reserve Economic Data (FRED), published by the Federal Reserve Bank of St. Louis, redistributes many official series—including BEA’s PCE index, BLS wage series, Case-Shiller home prices, and median home sale prices—without changing the underlying agency numbers. Using FRED is valid because it is a transparent mirror of primary statistical products with stable series identifiers and downloadable history. Its limitation is that FRED is a distributor: documentation depth, vintage notes, and methodological authority still belong to the originating agency, and users should treat the linked agency program pages as the ultimate source of method.",
  },
  {
    title: "S&P CoreLogic Case-Shiller national home-price index",
    body: "The Case-Shiller national index tracks repeat sales of the same houses over time, which reduces composition bias from the changing mix of homes sold in any one month. That design makes it a widely cited measure of U.S. house-price inflation and a better lived-experience complement to Owners’ Equivalent Rent when the question is “what did houses cost?” rather than “what is the CPI homeowner shelter component?” Limitations include focus on prices of homes that transact (not the full housing stock), national aggregation that hides local markets, and a concept that is not identical to the cost of owning or renting for a given household.",
  },
  {
    title: "Wages and median home sale prices",
    body: "Average hourly earnings for production and nonsupervisory employees (AHETPI) and the median sales price of houses sold (MSPUS) come from BLS and Census/HUD programs and are retrieved here through FRED. They are reliable for comparing income and transaction home prices against consumer inflation because they are long, official time series with public definitions. Limitations are material: AHETPI excludes supervisors and many professional occupations, so it is not an all-worker wage; MSPUS is a median of homes sold, which shifts with the mix of new versus existing sales and with regional composition, and it is not a constant-quality price index like Case-Shiller.",
  },
  {
    title: "The Economist Big Mac Index, USPS postage, and Farm Bureau Thanksgiving survey",
    body: "These lines are intentional cross-checks, not substitutes for CPI or PCE. The Big Mac Index is a transparent, long-running The Economist series based on a standardized product; USPS first-class letter rates are official posted prices; and the American Farm Bureau Federation’s Thanksgiving survey compiles a familiar holiday basket. Each is useful for intuition and communication because the items are recognizable. Their limitations are the point of labeling them unorthodox: a single burger, stamp, or holiday meal cannot represent the full consumption basket, survey methods differ from BLS probability samples, and Farm Bureau figures are annual snapshots rather than monthly official indexes.",
  },
  {
    title: "BEA Regional Price Parities for metro areas",
    body: "Regional Price Parities (RPP) from BEA compare price levels across metropolitan areas in a given year, with the national average indexed to 100. This app converts those levels so the median metro equals 1.00 and uses the 2024 metro all-items RPP for purchasing-power location adjustments. The series is valid for place-to-place comparisons because it is an official BEA product designed for spatial price levels rather than time inflation. Limitations include the cross-sectional vintage—2024 RPP is not a January 1995 time coefficient—and the metro grain: RPPs do not resolve neighborhoods, and they should not be mixed with county or place proxy coefficients in the same conversion.",
  },
  {
    title: "OUSEA experimental county Regional Price Parities",
    body: "County all-items estimates published by the Office of the Under Secretary for Economic Affairs (OUSEA) attempt to extend spatial price comparison below the metro level using public data. They are useful for exploratory county maps where official BEA metro RPPs are too coarse. Reliability is lower than BEA metro RPP: the release is explicitly experimental, approximately 2021-centered, and is not an official U.S. government statistical product in the same sense as BEA MARPP. Aggregating counties will not necessarily reproduce 2024 metro BEA figures, and the Map tab labels this grain accordingly.",
  },
  {
    title: "American Community Survey rents and HUD Fair Market Rents",
    body: "American Community Survey (ACS) 5-year median gross rent and HUD Fair Market Rent (FMR) for a two-bedroom unit are authoritative housing-cost sources from the Census Bureau and HUD. ACS rents reflect a multi-year survey window (here, 2019–2023), while FMR is a regulatory rent benchmark (FY2025 in this package). Both are valid for housing-only spatial comparisons and for blended exploratory averages. They are not full cost-of-living measures: goods, services, and non-housing prices are outside their scope, ACS suppresses some places, HUD coverage can miss a handful of metros after geographic coding changes, and neither series should replace BEA RPP when the question is overall purchasing power.",
  },
  {
    title: "Census place proxies and map boundaries",
    body: "Place-level coefficients in the Map tab are rent-scaled proxies built from county RPP and place-to-county rent ratios, not direct official all-items price indexes. Census cartographic boundary files supply the geography. These layers are useful for inspecting focus regions at a finer grain than metros, but they inherit county experimental vintages, ACS rent noise, and a modeling assumption that only part of the local price level moves with rent. Treat place values as approximate relative signals, keep comparisons within the same geographic grain, and read the vintage year shown beside each location label.",
  },
];
