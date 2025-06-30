// server.js - Etsy API server for Railway with debugging
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

// JSON endpoint specifically for trmnl
app.get('/trmnl', async (req, res) => {
  console.log('trmnl endpoint called');
  
  try {
    // Get the same data as the regular API
    const apiData = await getEtsyData();
    const { shop, todaysSales, stats } = apiData;
    
    // Format for trmnl display
    const trmnlData = {
      title: "🛍️ ETSY DASHBOARD",
      shop_name: shop.shop_name,
      alert: stats.todaySalesCount > 0 ? `🔔 ${stats.todaySalesCount} NEW SALE${stats.todaySalesCount > 1 ? 'S' : ''} TODAY!` : null,
      today_revenue: `${stats.todayRevenue.toFixed(2)}`,
      today_sales: stats.todaySalesCount,
      monthly_revenue: `${stats.monthlyRevenue.toFixed(2)}`,
      total_sales: shop.total_sales,
      recent_sales: todaysSales.slice(0, 5).map(sale => ({
        amount: `${sale.amount.toFixed(2)}`,
        items: sale.items.slice(0, 2).join(', '),
        time: formatTimeForTrmnl(sale.time)
      })),
      last_updated: new Date().toLocaleTimeString(),
      status_message: stats.todaySalesCount > 0 ? "🎉 Great sales today!" : "💪 Keep pushing!"
    };
    
    res.json(trmnlData);
    
  } catch (error) {
    console.error('Error in trmnl endpoint:', error);
    res.status(500).json({ 
      error: 'Failed to fetch data',
      message: error.message
    });
  }
});

// Helper function to get Etsy data (extracted from main endpoint)
async function getEtsyData() {
  if (!ETSY_API_KEY || !SHOP_ID) {
    // Return mock data
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
  
  // Real API calls would go here
  // For now, return mock data
  return getEtsyData();
}

function formatTimeForTrmnl(date) {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
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
app.get('/api/etsy-data', async (req, res) => {
  console.log('API endpoint called!');
  
  try {
    // If no API keys are set, return mock data for testing
    if (!ETSY_API_KEY || !SHOP_ID) {
      console.log('Using mock data - no API keys set');
      
      const todayRevenue = mockData.todaysSales.reduce((sum, order) => 
        sum + parseFloat(order.grandtotal), 0
      );
      
      const response = {
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
      
      console.log('Sending mock data response');
      return res.json(response);
    }

    console.log('Using real Etsy API');
    
    // Real Etsy API calls
    const headers = {
      'x-api-key': ETSY_API_KEY,
      'Authorization': `Bearer ${ETSY_API_KEY}`,
      'Content-Type': 'application/json'
    };

    // Get shop info
    const shopResponse = await fetch(
      `https://openapi.etsy.com/v3/application/shops/${SHOP_ID}`,
      { headers }
    );
    
    if (!shopResponse.ok) {
      throw new Error(`Shop API error: ${shopResponse.status}`);
    }
    
    const shopData = await shopResponse.json();

    // Get today's orders
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const minCreated = Math.floor(today.getTime() / 1000);

    const ordersResponse = await fetch(
      `https://openapi.etsy.com/v3/application/shops/${SHOP_ID}/receipts?min_created=${minCreated}&limit=20&includes=transactions`,
      { headers }
    );
    
    if (!ordersResponse.ok) {
      throw new Error(`Orders API error: ${ordersResponse.status}`);
    }
    
    const ordersData = await ordersResponse.json();
    const orders = ordersData.results || [];

    const todayRevenue = orders.reduce((sum, order) => 
      sum + parseFloat(order.grandtotal || 0), 0
    );

    const response = {
      shop: shopData,
      todaysSales: orders.map(sale => ({
        id: sale.receipt_id,
        amount: parseFloat(sale.grandtotal || 0),
        buyer: sale.buyer_user_id ? `Customer #${sale.buyer_user_id}` : 'Guest',
        time: new Date(sale.creation_timestamp * 1000),
        items: sale.transactions ? sale.transactions.map(t => t.title) : ['Order items']
      })),
      stats: {
        todayRevenue: todayRevenue,
        todaySalesCount: orders.length,
        monthlyRevenue: todayRevenue * 15,
        monthlySalesCount: orders.length * 15
      }
    };

    console.log('Sending real API data response');
    res.json(response);

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
  console.log(`❤️  Health: http://localhost:${PORT}/health`);
  
  if (!ETSY_API_KEY || !SHOP_ID) {
    console.log('⚠️  Using mock data - set ETSY_API_KEY and ETSY_SHOP_ID for real data');
  } else {
    console.log('✅ Using real Etsy API');
  }
});

module.exports = app;