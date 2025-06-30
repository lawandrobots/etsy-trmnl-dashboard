// server.js - Etsy API server for Railway with trmnl support
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Add logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Configuration from environment variables
const ETSY_API_KEY = process.env.ETSY_API_KEY;
const SHOP_ID = process.env.ETSY_SHOP_ID;

console.log('Server starting...');
console.log('Has ETSY_API_KEY:', !!ETSY_API_KEY);
console.log('Has SHOP_ID:', !!SHOP_ID);

// Mock data for testing
const mockData = {
  shop: {
    shop_name: "Your Amazing Etsy Shop",
    total_sales: 1247,
    total_favorites: 892
  },
  todaysSales: [
    {
      receipt_id: 1,
      grandtotal: "45.99",
      creation_timestamp: Math.floor((Date.now() - 2 * 60 * 60 * 1000) / 1000),
      buyer_user_id: "1234",
      transactions: [
        { title: "Custom Coffee Mug" },
        { title: "Sticker Pack" }
      ]
    },
    {
      receipt_id: 2,
      grandtotal: "23.50",
      creation_timestamp: Math.floor((Date.now() - 4 * 60 * 60 * 1000) / 1000),
      buyer_user_id: "5678",
      transactions: [
        { title: "Vintage T-Shirt" }
      ]
    },
    {
      receipt_id: 3,
      grandtotal: "78.00",
      creation_timestamp: Math.floor((Date.now() - 6 * 60 * 60 * 1000) / 1000),
      buyer_user_id: "9101",
      transactions: [
        { title: "Custom Art Print" },
        { title: "Wooden Frame" }
      ]
    }
  ]
};

// Helper function to get Etsy data
async function getEtsyData() {
  if (!ETSY_API_KEY || !SHOP_ID) {
    console.log('Using mock data - no API keys set');
    
    const todayRevenue = mockData.todaysSales.reduce((sum, order) => 
      sum + parseFloat(order.grandtotal), 0
    );
    
    return {
      shop: mockData.shop,
      todaysSales: mockData.todaysSales.map(sale => ({
        id: sale.receipt_id,
        amount: parseFloat(sale.grandtotal),
        buyer: `Customer #${sale.buyer_user_id}`,
        time: new Date(sale.creation_timestamp * 1000),
        items: sale.transactions.map(t => t.title)
      })),
      stats: {
        todayRevenue: todayRevenue,
        todaySalesCount: mockData.todaysSales.length,
        monthlyRevenue: 2890.45,
        monthlySalesCount: 67
      }
    };
  }

  console.log('Using real Etsy API');
  
  // Real Etsy API calls would go here
  // For now, return mock data until you add your API keys
  return await getEtsyData();
}

function formatTimeForTrmnl(date) {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(dateObj.getTime())) {
    return 'Unknown';
  }
  
  const now = new Date();
  const diffMs = now - dateObj;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  
  if (diffMins < 60) {
    return `${diffMins}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else {
    return dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}

// JSON endpoint specifically for trmnl (flat structure)
app.get('/trmnl', async (req, res) => {
  console.log('trmnl endpoint called');
  
  try {
    const apiData = await getEtsyData();
    const { shop, todaysSales, stats } = apiData;
    
    // Format for trmnl display (flat structure, no arrays)
    const trmnlData = {
      title: "🛍️ ETSY DASHBOARD",
      shop_name: shop.shop_name,
      alert: stats.todaySalesCount > 0 ? `🔔 ${stats.todaySalesCount} NEW SALE${stats.todaySalesCount > 1 ? 'S' : ''} TODAY!` : null,
      today_revenue: `$${stats.todayRevenue.toFixed(2)}`,
      today_sales: stats.todaySalesCount.toString(),
      monthly_revenue: `$${stats.monthlyRevenue.toFixed(2)}`,
      total_sales: shop.total_sales.toString(),
      last_updated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status_message: stats.todaySalesCount > 0 ? "🎉 Great sales today!" : "💪 Keep pushing!"
    };

    // Add individual sales (up to 5)
    const salesToShow = todaysSales.slice(0, 5);
    for (let i = 0; i < 5; i++) {
      const saleNum = i + 1;
      if (i < salesToShow.length) {
        const sale = salesToShow[i];
        trmnlData[`sale${saleNum}_amount`] = `$${sale.amount.toFixed(2)}`;
        trmnlData[`sale${saleNum}_items`] = sale.items.slice(0, 2).join(', ');
        trmnlData[`sale${saleNum}_time`] = formatTimeForTrmnl(sale.time);
        trmnlData[`has_sale${saleNum}`] = true;
      } else {
        trmnlData[`sale${saleNum}_amount`] = "";
        trmnlData[`sale${saleNum}_items`] = "";
        trmnlData[`sale${saleNum}_time`] = "";
        trmnlData[`has_sale${saleNum}`] = false;
      }
    }

    // Add flag for whether we have any sales
    trmnlData.has_sales = todaysSales.length > 0;
    
    console.log('Sending trmnl data for', todaysSales.length, 'sales');
    res.json(trmnlData);
    
  } catch (error) {
    console.error('Error in trmnl endpoint:', error);
    res.status(500).json({ 
      error: 'Failed to fetch data',
      message: error.message,
      title: "🛍️ ETSY DASHBOARD",
      shop_name: "Error Loading Data",
      alert: null,
      today_revenue: "$0.00",
      today_sales: "0",
      last_updated: new Date().toLocaleTimeString(),
      status_message: "❌ Check connection",
      has_sales: false
    });
  }
});

// Main API endpoint (for web dashboard)
app.get('/api/etsy-data', async (req, res) => {
  console.log('API endpoint called!');
  
  try {
    const apiData = await getEtsyData();
    console.log('Sending API data response');
    res.json(apiData);

  } catch (error) {
    console.error('Error in API endpoint:', error);
    res.status(500).json({ 
      error: 'Failed to fetch Etsy data',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  console.log('Health check called');
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    hasApiKeys: !!(ETSY_API_KEY && SHOP_ID),
    port: PORT
  });
});

// Serve the dashboard
app.get('/', (req, res) => {
  console.log('Root path called, serving index.html');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Catch all other routes
app.get('*', (req, res) => {
  console.log('Unknown route:', req.path);
  res.status(404).json({ error: 'Route not found', path: req.path });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}`);
  console.log(`🔧 API: http://localhost:${PORT}/api/etsy-data`);
  console.log(`📱 trmnl: http://localhost:${PORT}/trmnl`);
  console.log(`❤️  Health: http://localhost:${PORT}/health`);
  
  if (!ETSY_API_KEY || !SHOP_ID) {
    console.log('⚠️  Using mock data - set ETSY_API_KEY and ETSY_SHOP_ID for real data');
  } else {
    console.log('✅ Using real Etsy API');
  }
});

module.exports = app;