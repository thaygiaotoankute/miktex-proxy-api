// proxy-api.js - Deploy trên Vercel hoặc Fly.io
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

// Cho phép CORS từ các nguồn cụ thể (bao gồm Google Apps Script domains)
app.use(cors({
  origin: [
    'https://script.google.com',
    'https://script.googleusercontent.com',
    /^https:\/\/[a-z0-9-]+\.googleusercontent\.com$/,
    /^https:\/\/[a-z0-9-]+\.google\.com$/
  ],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Endpoint chính để proxy PDF từ MikTeX
app.get('/proxy-pdf', async (req, res) => {
  try {
    // Lấy URL của PDF từ query parameter
    const pdfUrl = req.query.url;
    
    if (!pdfUrl) {
      return res.status(400).json({ error: 'URL parameter is required' });
    }
    
    console.log(`Proxying PDF from: ${pdfUrl}`);
    
    // Tải PDF từ MikTeX service
    const response = await axios({
      method: 'get',
      url: pdfUrl,
      responseType: 'arraybuffer',
      timeout: 10000 // 10 giây timeout
    });
    
    // Thiết lập header và trả về PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="tikz-diagram.pdf"');
    // Cache control để cải thiện hiệu suất
    res.setHeader('Cache-Control', 'public, max-age=86400'); // cache 1 ngày
    res.send(response.data);
    
    console.log(`Successfully served PDF from ${pdfUrl}`);
  } catch (error) {
    console.error('Error proxying PDF:', error.message);
    
    // Trả về lỗi dạng JSON
    res.status(500).json({ 
      error: 'Failed to proxy PDF',
      details: error.message,
      url: req.query.url
    });
  }
});

// Route đặc biệt cũng proxy PDF nhưng trả về dạng base64 (cho trường hợp cần nhúng trực tiếp vào HTML)
app.get('/proxy-pdf-base64', async (req, res) => {
  try {
    const pdfUrl = req.query.url;
    
    if (!pdfUrl) {
      return res.status(400).json({ error: 'URL parameter is required' });
    }
    
    // Tải PDF từ MikTeX service
    const response = await axios({
      method: 'get',
      url: pdfUrl,
      responseType: 'arraybuffer',
      timeout: 10000
    });
    
    // Chuyển đổi buffer thành base64
    const base64Data = Buffer.from(response.data).toString('base64');
    
    // Trả về dạng JSON với data base64
    res.json({
      success: true,
      base64Data: base64Data,
      contentType: 'application/pdf'
    });
  } catch (error) {
    console.error('Error creating base64 PDF:', error.message);
    res.status(500).json({ 
      error: 'Failed to create base64 PDF',
      details: error.message
    });
  }
});

// Endpoint health check
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'MikTeX PDF Proxy',
    endpoints: [
      '/proxy-pdf?url=http://your-pdf-url',
      '/proxy-pdf-base64?url=http://your-pdf-url'
    ]
  });
});

// Khởi động server
app.listen(PORT, () => {
  console.log(`PDF Proxy API running on port ${PORT}`);
});

// Export cho Vercel
module.exports = app;
