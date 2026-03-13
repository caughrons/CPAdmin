/**
 * Mock financial data generator for Financials page
 * Generates realistic expense and revenue data for the past 12 months
 */

/**
 * Generate random value within a range with some variance
 */
const generateMonthlyData = (min, max, months = 12) => {
  const data = [];
  let baseValue = (min + max) / 2;
  
  for (let i = 0; i < months; i++) {
    // Add some randomness and trend
    const variance = (Math.random() - 0.5) * (max - min) * 0.3;
    const trend = ((i - months / 2) / months) * (max - min) * 0.2;
    let value = baseValue + variance + trend;
    
    // Keep within bounds
    value = Math.max(min, Math.min(max, value));
    
    // Round to 2 decimal places
    data.push(Math.round(value * 100) / 100);
    
    // Slightly adjust base for next month
    baseValue = value * 0.7 + baseValue * 0.3;
  }
  
  return data;
};

/**
 * Generate sporadic revenue (for sponsorship)
 */
const generateSporadicData = (min, max, probability = 0.3, months = 12) => {
  const data = [];
  
  for (let i = 0; i < months; i++) {
    if (Math.random() < probability) {
      const value = min + Math.random() * (max - min);
      data.push(Math.round(value * 100) / 100);
    } else {
      data.push(0);
    }
  }
  
  return data;
};

/**
 * Get month labels for the past 12 months
 */
export const getMonthLabels = () => {
  const labels = [];
  const now = new Date();
  
  for (let i = 11; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    labels.push(date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }));
  }
  
  return labels;
};

/**
 * Format currency value
 */
export const formatCurrency = (value) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
};

/**
 * Generate mock financial data
 */
export const generateMockFinancialData = () => {
  // Generate expense data
  const firebaseRTDBData = generateMonthlyData(50, 200);
  const firebaseFirestoreData = generateMonthlyData(100, 400);
  const cloudflareR2Data = generateMonthlyData(20, 80);
  const firebaseHostingData = generateMonthlyData(10, 30);
  const claudeCruisNewsData = generateMonthlyData(200, 600);
  const chatGPTImageData = generateMonthlyData(50, 150);
  const windsurfDevData = generateMonthlyData(500, 1000);
  
  // Generate revenue data
  const adMobAdsData = generateMonthlyData(100, 500);
  const sponsorshipData = generateSporadicData(0, 2000, 0.4);
  const merchandiseData = generateMonthlyData(50, 300);
  
  return {
    expenses: {
      firebaseRTDB: {
        monthlyData: firebaseRTDBData,
        currentMonth: firebaseRTDBData[firebaseRTDBData.length - 1]
      },
      firebaseFirestore: {
        monthlyData: firebaseFirestoreData,
        currentMonth: firebaseFirestoreData[firebaseFirestoreData.length - 1]
      },
      cloudflareR2: {
        monthlyData: cloudflareR2Data,
        currentMonth: cloudflareR2Data[cloudflareR2Data.length - 1]
      },
      firebaseHosting: {
        monthlyData: firebaseHostingData,
        currentMonth: firebaseHostingData[firebaseHostingData.length - 1]
      },
      claudeCruisNews: {
        monthlyData: claudeCruisNewsData,
        currentMonth: claudeCruisNewsData[claudeCruisNewsData.length - 1]
      },
      chatGPTImageCreation: {
        monthlyData: chatGPTImageData,
        currentMonth: chatGPTImageData[chatGPTImageData.length - 1]
      },
      windsurfDevelopment: {
        monthlyData: windsurfDevData,
        currentMonth: windsurfDevData[windsurfDevData.length - 1]
      }
    },
    revenue: {
      adMobAds: {
        monthlyData: adMobAdsData,
        currentMonth: adMobAdsData[adMobAdsData.length - 1]
      },
      sponsorship: {
        monthlyData: sponsorshipData,
        currentMonth: sponsorshipData[sponsorshipData.length - 1]
      },
      merchandise: {
        monthlyData: merchandiseData,
        currentMonth: merchandiseData[merchandiseData.length - 1]
      }
    }
  };
};

/**
 * Calculate aggregate totals for each month
 */
export const calculateAggregates = (data) => {
  const monthlyExpenses = [];
  const monthlyRevenue = [];
  
  // Calculate totals for each month
  for (let i = 0; i < 12; i++) {
    let expenseTotal = 0;
    let revenueTotal = 0;
    
    // Sum all expenses for this month
    Object.values(data.expenses).forEach(category => {
      expenseTotal += category.monthlyData[i];
    });
    
    // Sum all revenue for this month
    Object.values(data.revenue).forEach(category => {
      revenueTotal += category.monthlyData[i];
    });
    
    monthlyExpenses.push(Math.round(expenseTotal * 100) / 100);
    monthlyRevenue.push(Math.round(revenueTotal * 100) / 100);
  }
  
  return {
    expenses: monthlyExpenses,
    revenue: monthlyRevenue
  };
};
