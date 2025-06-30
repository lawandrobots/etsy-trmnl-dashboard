// server.js - Simple Etsy API proxy server
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Serve static files

// Configuration from environment variables
const ETSY_API_KEY = process.env.ETSY_API_KEY;
const SHOP_ID = process.env.ETSY_SHOP_ID;

// Mock data for testing (remove this once you have real API keys)
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
      creation_timestamp: Math.floor((Date.now() - 2 * 60 * 60 * 1000) / 1000), // 2 hours ago
      buyer_user_id: "1234",
      transactions: [
        { title: "Custom Coffee Mug" },
        { title: "Sticker Pack" }
      ]
    },
    {
      receipt_id: 2,
      grandtotal: "23.50",
      creation_timestamp: Math.floor((Date.now() - 4 * 60 * 60 * 1000) / 1000), // 4 hours ago
      buyer_user_id: "5678",
      transactions: [
        { title: "Vintage T-Shirt" }
      ]
    },
    {
      receipt_id: 3,
      grandtotal: "78.00",
      creation_timestamp: Math.floor((Date.now() - 6 * 60 * 60 * 1000) / 1000), // 6 hours ago
      buyer_user_id: "9101",
      transactions: [
        { title: "Custom Art Print" },
        { title: "Wooden Frame" }
      ]
    }
  ]
};

// Main API endpoint
app.get('/api/etsy-data', async (req, res) => {
  try {
    // If no API keys are set, return mock data for testing
    if (!ETSY_API_KEY || !SHOP_ID) {
      console.log('Using mock data - set ETSY_API_KEY and ETSY_SHOP_ID for real data');
      
      // Calculate stats from mock data
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
      
      return res.json(response);
    }

    // Real Etsy API calls (when you have API keys)
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

    // Calculate today's revenue
    const todayRevenue = orders.reduce((sum, order) => 
      sum + parseFloat(order.grandtotal || 0), 0
    );

    // Format the response
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
        monthlyRevenue: todayRevenue * 15, // Rough estimate
        monthlySalesCount: orders.length * 15 // Rough estimate
      }
    };

    res.json(response);

  } catch (error) {
    console.error('Error fetching Etsy data:', error);
    res.status(500).json({ 
      error: 'Failed to fetch Etsy data',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    hasApiKeys: !!(ETSY_API_KEY && SHOP_ID)
  });
});

// Serve the HTML plugin at root
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Etsy Dashboard Server running on port ${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}`);
  console.log(`🔧 API endpoint: http://localhost:${PORT}/api/etsy-data`);
  console.log(`❤️  Health check: http://localhost:${PORT}/health`);
  
  if (!ETSY_API_KEY || !SHOP_ID) {
    console.log('⚠️  Using mock data - set ETSY_API_KEY and ETSY_SHOP_ID for real data');
  } else {
    console.log('✅ Using real Etsy API');
  }
});

module.exports = app;
