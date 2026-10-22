require('dotenv').config();
const express = require('express');
const searchRouter = require('./routes/search');
const { authenticate } = require('./middleware/auth.middleware');

const app = express();
const PORT = process.env.PORT || 3000;

// Body parser middleware
app.use(express.json());

// Auth middleware — /api ke neeche sab routes protected (/health khula rahega)
app.use('/api', authenticate);

// Mount API routes
app.use('/api', searchRouter);

app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        message: 'Health from Express.js LLM Gateway!',
        httpVersion: req.httpVersion
    });
});

app.listen(PORT, () => {
    console.log(`Express Gateway server running on http://localhost:${PORT}`);
});
