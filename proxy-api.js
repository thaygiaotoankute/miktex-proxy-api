// proxy-api.js - Deploy trên Vercel hoặc Fly.io
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware để log các request
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// CORS config cải tiến - cho phép tất cả các domain trong giai đoạn phát triển
// Bạn có thể giới hạn lại sau khi đã phát triển xong
app.use(cors({
  origin: '*', // Cho phép tất cả các nguồn 
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'Accept'],
  credentials: true,
  maxAge: 86400 // Cache CORS preflight trong 24 giờ
}));

// Middleware đặc biệt xử lý OPTIONS request cho CORS preflight
app.options('*', cors());

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
      timeout: 10000, // 10 giây timeout
      headers: {
        'Accept': 'application/pdf'
      }
    });
    
    // Thiết lập header và trả về PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="tikz-diagram.pdf"');
    
    // Các header quan trọng cho phép nhúng PDF trong iframe 
    res.setHeader('X-Frame-Options', 'ALLOWALL');
    res.setHeader('Content-Security-Policy', "frame-ancestors *");
    
    // Các header CORS đầy đủ
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS, HEAD');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Origin, Accept');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    
    // Cache control để cải thiện hiệu suất
    res.setHeader('Cache-Control', 'public, max-age=86400'); // cache 1 ngày
    
    // Gửi dữ liệu PDF
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
    
    console.log(`Creating base64 from: ${pdfUrl}`);
    
    // Tải PDF từ MikTeX service
    const response = await axios({
      method: 'get',
      url: pdfUrl,
      responseType: 'arraybuffer',
      timeout: 10000,
      headers: {
        'Accept': 'application/pdf'
      }
    });
    
    // Các header CORS đầy đủ
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Origin, Accept');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    
    // Chuyển đổi buffer thành base64
    const base64Data = Buffer.from(response.data).toString('base64');
    
    // Trả về dạng JSON với data base64
    res.json({
      success: true,
      base64Data: base64Data,
      contentType: 'application/pdf',
      source: pdfUrl,
      timestamp: new Date().toISOString()
    });
    
    console.log(`Successfully created base64 data for ${pdfUrl}`);
  } catch (error) {
    console.error('Error creating base64 PDF:', error.message);
    res.status(500).json({ 
      success: false,
      error: 'Failed to create base64 PDF',
      details: error.message,
      url: req.query.url
    });
  }
});

// Endpoint mới: Chuyển đổi PDF thành hình ảnh PNG và trả về dạng base64
// Lưu ý: Endpoint này yêu cầu cài đặt thư viện pdf-poppler hoặc pdf2image
// Trong phiên bản hiện tại, chúng ta bỏ qua việc này vì sẽ phức tạp hơn
app.get('/proxy-pdf-to-image', async (req, res) => {
  res.json({
    success: false,
    message: "PDF to image conversion is not implemented in this version. Please use /proxy-pdf-base64 endpoint instead.",
    alternatives: [
      "/proxy-pdf?url=YOUR_PDF_URL",
      "/proxy-pdf-base64?url=YOUR_PDF_URL"
    ]
  });
});

// Endpoint health check
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'MikTeX PDF Proxy',
    version: '1.1.0',
    endpoints: [
      '/proxy-pdf?url=http://your-pdf-url',
      '/proxy-pdf-base64?url=http://your-pdf-url'
    ],
    supportedOrigins: 'All origins (*)',
    lastUpdated: new Date().toISOString()
  });
});

// Xử lý các route không tồn tại
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested endpoint does not exist.',
    availableEndpoints: [
      '/',
      '/proxy-pdf?url=PDF_URL',
      '/proxy-pdf-base64?url=PDF_URL'
    ]
  });
});

// Xử lý lỗi tổng thể
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message || 'An unexpected error occurred'
  });
});

// Khởi động server
app.listen(PORT, () => {
  console.log(`PDF Proxy API running on port ${PORT}`);
  console.log(`Server time: ${new Date().toISOString()}`);
});

// Export cho Vercel
module.exports = app;
