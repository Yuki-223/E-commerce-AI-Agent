# CartPilot — Multimodal E-commerce AI Agent

[English](README.md) | [简体中文](README.zh-CN.md)

<p align="center">
  <img alt="ByteDance Outstanding Project" src="https://img.shields.io/badge/ByteDance-Outstanding_Project-F5A623?style=flat&amp;logo=bytedance&amp;logoColor=white">
  <a href="client/README.md"><img alt="iOS 17+" src="https://img.shields.io/badge/iOS-17%2B-000000?logo=apple&amp;logoColor=white"></a>
  <a href="#1-requirements"><img alt="Python 3.10+" src="https://img.shields.io/badge/Python-3.10%2B-3776AB?logo=python&amp;logoColor=white"></a>
  <a href="https://github.com/YufanPeter/E-commerce-AI-Agent/stargazers"><img alt="GitHub stars" src="https://img.shields.io/github/stars/YufanPeter/E-commerce-AI-Agent?style=flat&amp;logo=github"></a>
  <a href="https://github.com/YufanPeter/E-commerce-AI-Agent/issues"><img alt="GitHub issues" src="https://img.shields.io/github/issues/YufanPeter/E-commerce-AI-Agent?logo=github"></a>
  <img alt="Repository visitors" src="https://visitor-badge.laobi.icu/badge?page_id=YufanPeter.E-commerce-AI-Agent&amp;left_text=visitors&amp;left_color=%23595959&amp;right_color=%231283C3&amp;logo=github">
  <a href="LICENSE"><img alt="MIT License" src="https://img.shields.io/badge/license-MIT-22C55E"></a>
</p>

<p align="center">
  <img src="bytedance.svg" height="35">
</p>

<h3 align="center">
  Bytedance Outstanding Project Award
</h3>

CartPilot is a **women's supply platform**. It is built around themes that recur in research on women's sport and nutrition (iron and energy intake, bone health, the menstrual cycle, sports-bra support), and it sells sports nutrition, women's micronutrients, cycle care, sportswear, recovery care and functional food. Shoppers describe a need by text, voice or photo. The assistant recommends with their body profile, ingredient restrictions and current cycle phase in mind, and handles comparison, product detail, cart and checkout in the same conversation.

The project uses a native SwiftUI client, a FastAPI backend, a controllable `router → tool → composer` agent, hybrid RAG retrieval, and SQLite-backed product facts.

## Demo

<p align="center">
  <a href="assets/demo_pic.png"><img src="assets/demo_pic.png" alt="CartPilot iOS app home screen" width="300"></a>
</p>

<p align="center"><sub>CartPilot iOS app — start a shopping conversation with text, voice, or a product image.</sub></p>

## Core capabilities

- **Multimodal input:** text, Chinese speech recognition, camera, and photo library.
- **Conversational shopping:** recommendation, refinement, clarification, comparison, product detail, and cart operations.
- **Context and memory:** resolves references such as “the second one,” keeps session context, and stores undoable user preferences.
- **Hybrid retrieval:** structured filters + Chroma vector recall + BM25/RRF + optional reranking.
- **Ingredient safety:** pregnancy/trying-to-conceive/breastfeeding, sensitive skin, no caffeine, vegan and allergens (dairy, soy, nuts, gluten, fish) hard-filter products on structured attributes. Phrases such as “no caffeine” use the same rules (`backend/search/safety.py`).
- **Body profile and cycle care:** skin type, undertone and sizes preselect size and shade options. The web app can record the menstrual cycle locally. The home page then suggests supplies for the menstrual, follicular, ovulatory and luteal phases, and cycle data never leaves the device.
- **Grounded facts:** prices, SKUs, stock, and cart totals come from SQLite rather than generated text.

The included catalog contains 48 products and 166 SKUs across six categories: sports nutrition, women's micronutrients, cycle care, sportswear, recovery care and functional food. All brands are fictional, and the data is generated from `scripts/women_catalog_spec.py` (`python3 scripts/generate_women_catalog.py`). Descriptions cover use and audience and make no treatment claims.

## Architecture

```mermaid
flowchart LR
    U["Text · voice · image"] --> IOS["SwiftUI iOS app"]
    IOS <-->|"REST + SSE"| API["FastAPI"]
    API --> AGENT["Router → Tool → Composer"]
    AGENT --> SEARCH["Query understanding + hybrid RAG"]
    SEARCH --> CHROMA["Chroma vectors"]
    SEARCH --> BM25["BM25 + RRF"]
    SEARCH --> RERANK["Optional rerank"]
    AGENT --> DB["SQLite facts · sessions · cart · preferences"]
```

The LLM interprets intent and writes the response. Deterministic tools perform search, comparison, and cart mutations; SQLite remains the source of truth for product facts.

## Quick start

```bash
git clone https://github.com/YufanPeter/E-commerce-AI-Agent.git
cd E-commerce-AI-Agent
```

### 1. Requirements

- macOS with Xcode 15+ and an iOS 17+ simulator
- Python 3.10+; Python 3.11 or 3.12 is recommended
- Compatible model API credentials for the capabilities enabled below

### 2. Configure API keys

The project uses three model capabilities; it does not require a specific model name:

| Capability | Where it is used | Interface requirement |
| --- | --- | --- |
| General multimodal LLM | Intent routing, query understanding, response composition, and image-to-query understanding | OpenAI-compatible chat API with function calling and image input |
| Embedding model | Offline Chroma index construction, online text-query embedding, and image similarity | Text and image embeddings in the same vector space; compatible with the current multimodal embedding adapter |
| Reranking model (optional) | Reorders retrieved evidence chunks before product aggregation | Rerank API compatible with the current reranker response format |

The `ARK_*` and `ZHIPU_*` names are retained only for compatibility with the current code; they do not prescribe a model provider. Their values should point to your chosen compatible APIs.

Create `.env` in the repository root:

```dotenv
# General multimodal LLM API
ARK_API_KEY=your_model_api_key
ARK_MODEL=your_general_model_id
ARK_BASE_URL=https://your-model-api.example.com/v1

# Embedding API; its key falls back to ARK_API_KEY when omitted
ARK_EMBEDDING_API_KEY=your_embedding_api_key
ARK_EMBEDDING_MODEL=your_embedding_model_id
ARK_EMBEDDING_BASE_URL=https://your-embedding-api.example.com/v1

# Optional reranking API
ZHIPU_API_KEY=your_rerank_api_key
RERANK_MODEL=your_reranking_model_id
RERANK_BASE_URL=https://your-rerank-api.example.com/rerank

USE_HYBRID=1
USE_RERANK=1
```

To run without a reranking model, omit its three variables and set `USE_RERANK=0`.

### 3. Install and initialize data

A fresh clone must generate its local SQLite database and Chroma metadata once:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r backend/requirements.txt

cd backend
python -m store.import_product_data --reset
python -m store.import_image_manifest
python -m rag.build_chroma --reset
cd ..
```

`rag.build_chroma` calls the embedding endpoint configured in `.env`.

> With the women's supply catalog, `backend/storage/image_index.json` (image vectors for photo search) starts empty. The bundled product images are SVG placeholders. After switching to real product photos, list their URLs in `backend/cdn/image_manifest.json` and run `python -m rag.build_image_index` so photo search can rerank by image similarity again.

### 4. Start the backend

```bash
./scripts/start_backend.sh
```

Confirm that it is ready:

```bash
curl http://127.0.0.1:8000/health
```

Expected response:

```json
{"status":"ok"}
```

For automatic reload during Python development, use `./scripts/dev.sh`.

### 5. Run the iOS app

```bash
open client/AIShoppingGuide.xcodeproj
```

In Xcode, open **Product → Scheme → Edit Scheme → Run → Arguments**. Set `BACKEND_BASE_URL` to `http://127.0.0.1:8000`, or disable that variable to use the simulator's localhost default.

Select an iPhone simulator, press **Run**, and try:

```text
经期也想照常训练，推荐 200 元以内、不含咖啡因的补给
```

### 6. Run the web app

The web client lives in `web/` (React + Vite + TypeScript + Tailwind) and needs Node.js 20+.

```bash
cd web
npm install
npm run dev:mock   # front end only: in-browser mock backend, no Python backend or model key
npm run dev        # against the local backend from step 4; /api/* is proxied to http://127.0.0.1:8000
```

Open `http://localhost:5173`. The mock layer reads the product JSON and images under `data/`, answers chats with a scripted SSE stream and keeps the cart and preferences in the browser, using the same paths, SSE event names and fields as the real backend. The only switch is `VITE_USE_MOCK=1`. `npm test` runs the unit tests, `npm run build` writes `web/dist` (the mock layer is left out unless the flag is set), and `npm run preview` serves the build, including the installable PWA. See `web/README.md` for how to trigger each UI state in mock mode.

## Accounts, orders and the merchant console

Shoppers and merchants share one backend. Requests without a login still act as the demo shopper `demo_user`, so the iOS app and older web builds keep working.

- **Accounts:** `POST /auth/register` (`role` is `customer` or `merchant`; merchants also send `shop_name`), `POST /auth/login`, `GET /auth/me`. With `Authorization: Bearer <token>`, the cart, orders, addresses and the chat agent's add-to-cart and checkout all act on that account.
- **Orders:** checkout creates `pending_payment` orders and reserves stock in the same transaction. If stock runs out the request returns 409. Lines are split into one order per shop. Orders move `pending_payment → paid → shipped → completed`, and can also be cancelled or refunded: the shopper requests a refund and the merchant approves or rejects it. Cancelling, refunding and unpaid expiry (`ORDER_PAY_TIMEOUT_MINUTES`, default 30) release the stock. Payment is simulated.
- **Merchant console (`/merchant/*`):** dashboard; publishing and editing products and SKUs, listing and delisting, price and stock changes; shipping with a tracking number; refund decisions; and the shop profile. Each catalog write triggers an incremental Chroma update in the background (`rag/sync.py`), so the shopping agent can recommend new products right away. Without embedding credentials, set `RAG_SYNC_ON_WRITE=0` and run `python -m rag.sync --all` later.
- **Web app:** the account menu has 登录 / 注册 (log in / register), 我的订单 (my orders) and 收货地址 (shipping addresses). Merchant accounts also get 商家后台 (the merchant console).

```bash
cd backend
python -m store.manage create-admin --username admin --password <password>        # platform admin: manages every shop and the platform-operated catalog
python -m store.manage assign-products --merchant-user shop1 --brand 她力          # hand bundled products to a merchant for demos
```

| Variable | Effect |
| --- | --- |
| `AUTH_SECRET` | Token signing key. Set it for any deployment; a development key is used otherwise |
| `AUTH_REQUIRED=1` | Cart and order endpoints reject anonymous requests (default: treat them as the demo shopper) |
| `AUTH_TOKEN_TTL_SECONDS` | Token lifetime, 7 days by default |

Existing databases gain the new tables and `products.merchant_id` automatically on first use; no `--reset` needed.

## Try the API directly

FastAPI documentation is available at `http://127.0.0.1:8000/docs`.

```bash
curl -N http://127.0.0.1:8000/chat/stream \
  -H 'Content-Type: application/json' \
  -d '{"query":"推荐温和补铁的营养素","user_id":"demo_user"}'
```

The stream emits session metadata, progress status, structured tool results, text tokens, optional preference updates, and a final `done` event.

## Project structure

```text
backend/
├── api/       # FastAPI routes and SSE
├── agent/     # Router, orchestrator, composer, and tools
├── search/    # Query understanding, filters, BM25/RRF, visual search
├── rag/       # Chroma retrieval, embeddings, reranker, index builders
├── store/     # SQLite product, cart, session, and preference stores
├── eval/      # Labeled quality evaluations
└── llm/       # Model API client adapters

client/AIShoppingGuide/
├── GuideView.swift
├── FrontendServices.swift
├── ProductDetailView.swift
├── ComparisonView.swift
├── CartView.swift
└── PreferenceView.swift

web/           # Web client (React + Vite) with the mock data layer
data/          # Product JSON and catalog images
scripts/       # Local start, stop, restart, and development helpers
```

## Verification

```bash
cd backend
../.venv/bin/python -m pytest -q
../.venv/bin/python -m eval.consistency_eval
```

More implementation details are available in [the system design document](docs/system-design.md), [backend/README.md](backend/README.md), and [client/README.md](client/README.md).

## License

Released under the [MIT License](LICENSE).
