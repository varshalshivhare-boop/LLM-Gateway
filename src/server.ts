require('dotenv').config();
const express = require('express');
const searchRouter = require('./routes/search');

const app = express();
const PORT = process.env.PORT || 3000;

// Body parser middleware
app.use(express.json());

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
