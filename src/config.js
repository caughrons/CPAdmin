export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APPID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

export const auth0Config = {
  clientId: import.meta.env.VITE_AUTH0_CLIENT_ID,
  domain: import.meta.env.VITE_AUTH0_DOMAIN,
};

export const cognitoConfig = {
  userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
  clientId: import.meta.env.VITE_COGNITO_CLIENT_ID,
};

// Region Packages Configuration for CPAdmin Tile Management
export const REGION_PACKAGES = {
  "US East Coast": [
    {
      id: "us_east_north",
      name: "North Package",
      description: "Maine to Cape Cod",
      bounds: { north: 47.5, south: 41.0, east: -69.5, west: -71.5 },
      seasonalInfo: {
        peakSeason: "June-Oct",
        offSeason: "Nov-May",
        optimalMonths: ["June", "July", "August", "September", "October"],
        cautionMonths: ["November", "December", "January", "February", "March", "April", "May"],
      },
      estimatedSizeMB: 180,
      includedAreas: ["Maine", "New Hampshire", "Massachusetts", "Cape Cod"],
    },
    {
      id: "us_east_mid_atlantic",
      name: "Mid-Atlantic Package",
      description: "Long Island to Chesapeake Bay",
      bounds: { north: 41.0, south: 36.5, east: -74.0, west: -77.5 },
      seasonalInfo: {
        peakSeason: "May-Nov",
        offSeason: "Dec-Apr",
        optimalMonths: ["May", "June", "July", "August", "September", "October", "November"],
        cautionMonths: ["December", "January", "February", "March", "April"],
      },
      estimatedSizeMB: 200,
      includedAreas: ["Long Island", "New Jersey", "Delaware", "Chesapeake Bay", "Virginia"],
    },
    {
      id: "us_east_southeast",
      name: "Southeast Package",
      description: "Georgia to Florida",
      bounds: { north: 36.5, south: 25.0, east: -80.0, west: -82.5 },
      seasonalInfo: {
        peakSeason: "Dec-Apr",
        offSeason: "May-Nov",
        optimalMonths: ["December", "January", "February", "March", "April"],
        cautionMonths: ["May", "June", "July", "August", "September", "October", "November"],
      },
      estimatedSizeMB: 220,
      includedAreas: ["Georgia", "Florida", "Jacksonville", "Miami", "Key West"],
    },
    {
      id: "us_east_icw",
      name: "Intracoastal Waterway Package",
      description: "Full ICW route",
      bounds: { north: 47.5, south: 25.0, east: -75.0, west: -82.5 },
      seasonalInfo: {
        peakSeason: "Oct-May southbound, Apr-Jun northbound",
        offSeason: "Jul-Sep",
        optimalMonths: ["October", "November", "December", "January", "February", "March", "April", "May", "June"],
        cautionMonths: ["July", "August", "September"],
      },
      estimatedSizeMB: 350,
      includedAreas: ["Full ICW route from Norfolk to Miami"],
    },
  ],
  "US West": [
    {
      id: "us_west_pacific_northwest",
      name: "Pacific Northwest Package",
      description: "Washington to Northern California",
      bounds: { north: 49.0, south: 38.0, east: -122.0, west: -125.0 },
      seasonalInfo: {
        peakSeason: "May-Sep",
        offSeason: "Oct-Apr",
        optimalMonths: ["May", "June", "July", "August", "September"],
        cautionMonths: ["October", "November", "December", "January", "February", "March", "April"],
      },
      estimatedSizeMB: 240,
      includedAreas: ["Washington", "Oregon", "Northern California"],
    },
    {
      id: "us_west_central_california",
      name: "Central California Package",
      description: "San Francisco to Los Angeles",
      bounds: { north: 38.0, south: 34.0, east: -118.0, west: -123.0 },
      seasonalInfo: {
        peakSeason: "Year-round",
        offSeason: "None significant",
        optimalMonths: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
        cautionMonths: [],
      },
      estimatedSizeMB: 180,
      includedAreas: ["San Francisco", "Monterey", "San Luis Obispo", "Santa Barbara", "Los Angeles"],
    },
    {
      id: "us_west_southern_california",
      name: "Southern California Package",
      description: "LA to San Diego",
      bounds: { north: 34.0, south: 32.0, east: -117.0, west: -118.5 },
      seasonalInfo: {
        peakSeason: "Year-round, peak summer",
        offSeason: "None significant",
        optimalMonths: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
        cautionMonths: [],
      },
      estimatedSizeMB: 120,
      includedAreas: ["Los Angeles", "Orange County", "San Diego"],
    },
  ],
  "Caribbean": [
    {
      id: "caribbean_leeward",
      name: "Leeward Islands Package",
      description: "Virgin Islands to Antigua",
      bounds: { north: 18.5, south: 16.0, east: -61.5, west: -65.0 },
      seasonalInfo: {
        peakSeason: "Dec-May",
        offSeason: "Jun-Nov",
        hurricaneSeason: "Jun-Nov",
        optimalMonths: ["December", "January", "February", "March", "April", "May"],
        cautionMonths: ["June", "July", "August", "September", "October", "November"],
      },
      estimatedSizeMB: 150,
      includedAreas: ["Virgin Islands", "St. Martin", "St. Barts", "Antigua", "Barbuda"],
    },
    {
      id: "caribbean_windward",
      name: "Windward Islands Package",
      description: "Martinique to Grenada",
      bounds: { north: 14.5, south: 11.5, east: -60.5, west: -62.0 },
      seasonalInfo: {
        peakSeason: "Dec-May",
        offSeason: "Jun-Nov",
        hurricaneSeason: "Jun-Nov",
        optimalMonths: ["December", "January", "February", "March", "April", "May"],
        cautionMonths: ["June", "July", "August", "September", "October", "November"],
      },
      estimatedSizeMB: 130,
      includedAreas: ["Martinique", "St. Lucia", "St. Vincent", "Grenada"],
    },
    {
      id: "caribbean_greater_antilles",
      name: "Greater Antilles Package",
      description: "Cuba, Jamaica, Hispaniola, Puerto Rico",
      bounds: { north: 23.5, south: 17.5, east: -65.5, west: -85.0 },
      seasonalInfo: {
        peakSeason: "Dec-Apr",
        offSeason: "May-Nov",
        hurricaneSeason: "Jun-Nov",
        optimalMonths: ["December", "January", "February", "March", "April"],
        cautionMonths: ["May", "June", "July", "August", "September", "October", "November"],
      },
      estimatedSizeMB: 280,
      includedAreas: ["Cuba", "Jamaica", "Hispaniola", "Puerto Rico"],
    },
    {
      id: "caribbean_western",
      name: "Western Caribbean Package",
      description: "Belize, Honduras, Mexico",
      bounds: { north: 21.5, south: 15.5, east: -80.0, west: -92.0 },
      seasonalInfo: {
        peakSeason: "Nov-Apr",
        offSeason: "May-Oct",
        hurricaneSeason: "Jun-Nov",
        optimalMonths: ["November", "December", "January", "February", "March", "April"],
        cautionMonths: ["May", "June", "July", "August", "September", "October"],
      },
      estimatedSizeMB: 200,
      includedAreas: ["Belize", "Honduras", "Mexico Yucatan", "Cayman Islands"],
    },
  ],
  "Mediterranean": [
    {
      id: "med_western",
      name: "Western Med Package",
      description: "Spain, Balearics, Southern France",
      bounds: { north: 44.5, south: 35.0, east: 5.0, west: -10.0 },
      seasonalInfo: {
        peakSeason: "May-Oct",
        offSeason: "Nov-Apr",
        optimalMonths: ["May", "June", "July", "August", "September", "October"],
        cautionMonths: ["November", "December", "January", "February", "March", "April"],
      },
      estimatedSizeMB: 320,
      includedAreas: ["Spain", "Balearic Islands", "Southern France", "Monaco"],
    },
    {
      id: "med_central",
      name: "Central Med Package",
      description: "Italy, Sardinia, Corsica",
      bounds: { north: 46.0, south: 36.5, east: 18.0, west: 8.0 },
      seasonalInfo: {
        peakSeason: "Apr-Oct",
        offSeason: "Nov-Mar",
        optimalMonths: ["April", "May", "June", "July", "August", "September", "October"],
        cautionMonths: ["November", "December", "January", "February", "March"],
      },
      estimatedSizeMB: 280,
      includedAreas: ["Italy", "Sardinia", "Corsica", "Malta"],
    },
    {
      id: "med_eastern",
      name: "Eastern Med Package",
      description: "Greece, Turkey, Cyprus",
      bounds: { north: 42.0, south: 34.0, east: 36.0, west: 19.0 },
      seasonalInfo: {
        peakSeason: "Apr-Oct",
        offSeason: "Nov-Mar",
        optimalMonths: ["April", "May", "June", "July", "August", "September", "October"],
        cautionMonths: ["November", "December", "January", "February", "March"],
      },
      estimatedSizeMB: 350,
      includedAreas: ["Greece", "Turkey", "Cyprus", "Aegean Islands"],
    },
    {
      id: "med_adriatic",
      name: "Adriatic Package",
      description: "Croatia, Montenegro, Albania",
      bounds: { north: 46.0, south: 39.0, east: 19.0, west: 13.5 },
      seasonalInfo: {
        peakSeason: "May-Sep",
        offSeason: "Oct-Apr",
        optimalMonths: ["May", "June", "July", "August", "September"],
        cautionMonths: ["October", "November", "December", "January", "February", "March", "April"],
      },
      estimatedSizeMB: 180,
      includedAreas: ["Croatia", "Montenegro", "Albania", "Bosnia"],
    },
    {
      id: "med_north_africa",
      name: "North Africa Package",
      description: "Morocco, Algeria, Tunisia, Libya",
      bounds: { north: 37.0, south: 23.0, east: 25.0, west: -7.0 },
      seasonalInfo: {
        peakSeason: "Apr-Oct",
        offSeason: "Nov-Mar",
        optimalMonths: ["April", "May", "June", "July", "August", "September", "October"],
        cautionMonths: ["November", "December", "January", "February", "March"],
      },
      estimatedSizeMB: 300,
      includedAreas: ["Morocco", "Algeria", "Tunisia", "Libya"],
    },
  ],
  "Pacific": [
    {
      id: "pacific_south",
      name: "South Pacific Package",
      description: "French Polynesia, Fiji, Tonga",
      bounds: { north: -10.0, south: -25.0, east: -150.0, west: -180.0 },
      seasonalInfo: {
        peakSeason: "Apr-Nov",
        offSeason: "Dec-Mar",
        cycloneSeason: "Dec-Mar",
        optimalMonths: ["April", "May", "June", "July", "August", "September", "October", "November"],
        cautionMonths: ["December", "January", "February", "March"],
      },
      estimatedSizeMB: 450,
      includedAreas: ["French Polynesia", "Fiji", "Tonga", "Samoa", "Cook Islands"],
    },
    {
      id: "pacific_north",
      name: "North Pacific Package",
      description: "Hawaii, Alaska",
      bounds: { north: 71.5, south: 18.0, east: -154.0, west: -178.0 },
      seasonalInfo: {
        peakSeason: "May-Sep Alaska, year-round Hawaii",
        offSeason: "Oct-Apr Alaska",
        optimalMonths: ["May", "June", "July", "August", "September"],
        cautionMonths: ["October", "November", "December", "January", "February", "March", "April"],
      },
      estimatedSizeMB: 520,
      includedAreas: ["Hawaii", "Alaska", "Aleutian Islands"],
    },
    {
      id: "pacific_west",
      name: "West Pacific Package",
      description: "Philippines, Indonesia, Papua New Guinea",
      bounds: { north: 23.0, south: -11.0, east: 140.0, west: 115.0 },
      seasonalInfo: {
        peakSeason: "Nov-Apr",
        offSeason: "May-Oct",
        typhoonSeason: "May-Oct",
        optimalMonths: ["November", "December", "January", "February", "March", "April"],
        cautionMonths: ["May", "June", "July", "August", "September", "October"],
      },
      estimatedSizeMB: 480,
      includedAreas: ["Philippines", "Indonesia", "Papua New Guinea", "Borneo"],
    },
  ],
  "US Gulf": [
    {
      id: "gulf_western",
      name: "Western Gulf Package",
      description: "Texas to Louisiana",
      bounds: { north: 30.5, south: 25.5, east: -89.0, west: -97.5 },
      seasonalInfo: {
        peakSeason: "Oct-May",
        offSeason: "Jun-Nov",
        hurricaneSeason: "Jun-Nov",
        optimalMonths: ["October", "November", "December", "January", "February", "March", "April", "May"],
        cautionMonths: ["June", "July", "August", "September", "October", "November"],
      },
      estimatedSizeMB: 160,
      includedAreas: ["Texas", "Louisiana", "Houston", "New Orleans"],
    },
    {
      id: "gulf_central",
      name: "Central Gulf Package",
      description: "Mississippi to Alabama",
      bounds: { north: 31.0, south: 29.0, east: -87.5, west: -89.5 },
      seasonalInfo: {
        peakSeason: "Year-round, peak spring/fall",
        offSeason: "Summer heat",
        optimalMonths: ["March", "April", "May", "September", "October", "November"],
        cautionMonths: ["June", "July", "August"],
      },
      estimatedSizeMB: 80,
      includedAreas: ["Mississippi", "Alabama", "Biloxi", "Mobile"],
    },
    {
      id: "gulf_eastern",
      name: "Eastern Gulf Package",
      description: "Florida Gulf Coast",
      bounds: { north: 30.5, south: 25.5, east: -82.0, west: -87.5 },
      seasonalInfo: {
        peakSeason: "Year-round, peak winter",
        offSeason: "Summer heat/humidity",
        optimalMonths: ["October", "November", "December", "January", "February", "March", "April"],
        cautionMonths: ["May", "June", "July", "August", "September"],
      },
      estimatedSizeMB: 140,
      includedAreas: ["Florida Gulf Coast", "Tampa Bay", "Fort Myers", "Pensacola"],
    },
  ],
  "Southern Ocean": [
    {
      id: "southern_south_atlantic",
      name: "South Atlantic Package",
      description: "Argentina, Chile, Falklands",
      bounds: { north: -35.0, south: -56.0, east: -53.0, west: -75.0 },
      seasonalInfo: {
        peakSeason: "Nov-Mar",
        offSeason: "Apr-Oct",
        optimalMonths: ["November", "December", "January", "February", "March"],
        cautionMonths: ["April", "May", "June", "July", "August", "September", "October"],
      },
      estimatedSizeMB: 380,
      includedAreas: ["Argentina", "Chile", "Falkland Islands", "Cape Horn"],
    },
    {
      id: "southern_indian_ocean",
      name: "Indian Ocean Package",
      description: "South Africa, Madagascar, Australia",
      bounds: { north: -25.0, south: -47.0, east: 115.0, west: 20.0 },
      seasonalInfo: {
        peakSeason: "Nov-Mar",
        offSeason: "Apr-Oct",
        optimalMonths: ["November", "December", "January", "February", "March"],
        cautionMonths: ["April", "May", "June", "July", "August", "September", "October"],
      },
      estimatedSizeMB: 520,
      includedAreas: ["South Africa", "Madagascar", "Australia", "Kerguelen Islands"],
    },
  ],
};

// Helper functions for package management
export const getAllPackages = () => {
  const allPackages = [];
  Object.entries(REGION_PACKAGES).forEach(([region, packages]) => {
    packages.forEach(pkg => {
      allPackages.push({
        ...pkg,
        region,
      });
    });
  });
  return allPackages;
};

export const getPackagesByRegion = (region) => {
  return REGION_PACKAGES[region] || [];
};

export const getPackageById = (packageId) => {
  const allPackages = getAllPackages();
  return allPackages.find(pkg => pkg.id === packageId);
};

export const getSeasonalRecommendation = (seasonalInfo) => {
  const currentDate = new Date();
  const currentMonth = currentDate.toLocaleString('default', { month: 'long' });
  
  if (seasonalInfo.cautionMonths.includes(currentMonth)) {
    if (seasonalInfo.hurricaneSeason) return '⚠️ Hurricane season - exercise caution';
    if (seasonalInfo.cycloneSeason) return '⚠️ Cyclone season - exercise caution';
    if (seasonalInfo.typhoonSeason) return '⚠️ Typhoon season - exercise caution';
    return '⚠️ Off-season - limited services';
  }
  
  if (seasonalInfo.optimalMonths.includes(currentMonth)) {
    return '✅ Peak season - ideal conditions';
  }
  
  return 'ℹ️ Shoulder season - generally good conditions';
};
