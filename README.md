# 🚀 LLM Gateway

A high-performance, resilient API Gateway built with **Node.js**, **Express**, and **TypeScript** for interacting with Large Language Models (LLMs) such as Google Gemini. Designed with automatic model fallback, SSE streaming, smart retries with exponential backoff, and containerized infrastructure support.

---

## ✨ Features

- 🔄 **Smart Model Fallback**: Automatically cascades through fallback models if the primary model hits rate limits (`429`) or server overload (`503`).
- 🌊 **Server-Sent Events (SSE) Streaming**: Real-time response streaming for seamless LLM chat and completions.
- ⏱️ **Automatic Retries & Exponential Backoff**: Built-in retry mechanism with progressive backoff for transient errors.
- 🧪 **Built-in Model Tester**: Quick diagnostic utility (`test-models.js`) to probe Gemini model availability against your API key.
- 🐳 **Docker & Microservice Ready**: Full `docker-compose.yml` included for running the app alongside PostgreSQL and Redis.
- 🛡️ **Clean & Modular Architecture**: Clear separation of routes, services, and configurations.

---

## 🏗️ Architecture & Fallback Flow

```
User Request
     │
     ▼
Express Gateway (/api/search)
     │
     ▼
Gemini Service (callGeminiWithFallback)
     │
     ├─► Primary Model (e.g. gemini-3.8-flash)
     │     ├─► Success ──────────────► Stream / JSON Response
     │     └─► 503 / 429 Error ─────► Retry (Backoff)
     │
     └─► Next Fallback Model ────────► (If retries exhausted)
```

---

## 📁 Project Structure

```text
LLM-Gateway/
├── src/
│   ├── config/
│   │   ├── model.config.ts    # Fallback model list & retry configuration
│   │   └── test-models.js     # Script to test available models on your API key
│   ├── routes/
│   │   └── search.ts          # Express routes for search & SSE streaming
│   ├── services/
│   │   └── gemini.service.ts  # Core LLM call logic, retries, and fallback
│   └── server.ts              # Express application entry point
├── docker-compose.yml         # Container setup with Postgres & Redis
├── .env.example               # Environment variable template
├── package.json
└── tsconfig.json
```

---

## 🚀 Getting Started

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [npm](https://www.npmjs.com/)
- A Google Gemini API Key from [Google AI Studio](https://aistudio.google.com/)

### 2. Clone & Install
```bash
git clone https://github.com/varshalshivhare-boop/LLM-Gateway.git
cd LLM-Gateway
npm install
```

### 3. Environment Variables
Copy `.env.example` to `.env` and insert your Gemini API key:
```bash
cp .env.example .env
```
Edit `.env`:
```env
PORT=3000
GEMINI_API_KEY=your_actual_gemini_api_key_here
```

### 4. Run Development Server
```bash
npm run dev
```
The server will start on `http://localhost:3000`.

---

## 🧪 Testing Model Availability

To test which Gemini models are active and available for your API key:
```bash
node src/config/test-models.js
```
This script checks each model and reports status (e.g., `WORKING`, `OVERLOADED`, or `DEPRECATED`), making it easy to configure `FALLBACK_MODELS` in `src/config/model.config.ts`.

---

## 📡 API Endpoints

### 1. Health Check
```http
GET /health
```
**Response:**
```json
{
  "status": "ok",
  "message": "Health from Express.js LLM Gateway!",
  "httpVersion": "1.1"
}
```

### 2. Streaming Query (Server-Sent Events)
```http
GET /api/search?q=Explain+quantum+computing+in+simple+terms
```
Streams token chunks in real-time as `text/event-stream`.

### 3. JSON Request
```http
POST /api/search
Content-Type: application/json

{
  "contents": [
    {
      "parts": [
        { "text": "What are the benefits of an LLM gateway?" }
      ]
    }
  ]
}
```

---

## 🐳 Running with Docker Compose

Launch the complete stack (LLM Gateway + PostgreSQL + Redis):
```bash
docker compose up -d
```

---

## 📄 License
This project is open source and available under the [MIT License](LICENSE).
