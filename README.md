# 📊 Cognitive Data Analyzer & Profiler (BYOK)

A secure, client-side, provider-agnostic **Bring Your Own Key (BYOK)** data analysis application. This platform enables users to securely profile, query, and visualize CSV and Excel datasets using their own LLM API keys (Gemini, OpenAI, or Anthropic) without server-side credential exposure or data sharing.

---

## 🔑 Security & Architecture Principles

*   **Zero-Exposure Key Management (BYOK)**: Your API keys sit entirely in your browser (`localStorage` if you select "Remember Key", or `sessionStorage` if you want it to expire when the tab closes). Credentials are sent directly from the browser to the LLM providers and are **never** transmitted to our backend.
*   **"No-Invented-Numbers" Data Privacy**: Raw data rows are never sent in bulk to the LLM. Instead, the application computes deterministic statistical profiles (data types, missing percentages, min/max values, means, frequencies, and Pearson correlations) locally using JavaScript. The LLM only receives this JSON metadata profile to guide chart generation and narrative explanations, preventing AI hallucinations.
*   **Decoupled Architecture**:
    *   `config.js`: Centralized configuration for LLM providers, model tiers, and API endpoints.
    *   `insights_prompt.md`: The system instructions template used to guide the LLM's data analysis and chart composition.
    *   `chat_prompt.md`: The system instructions guiding the interactive data chat assistant.
    *   `samples.json`: Virtualized sandbox datasets loaded dynamically to enable instant testing.

---

## 🚀 Getting Started

### Prerequisites
Since this is a static client-side web application, you only need a modern web browser and a static HTTP server to run it.

### Running Locally
You can spin up a local server using Python, Node.js, or any static hosting server:

#### Using Python:
```bash
python3 -m http.server 8000
```
Then navigate to: `http://localhost:8000`

#### Using Node.js (via `npx` or `serve`):
```bash
npx serve
```

---

## 🛠 How to Use the Application

### Step 1: Onboarding Gate & Connection Testing
Upon opening the application, you will be greeted by the **Bring Your Own Key** settings panel:
1. Select your preferred LLM provider tab (**Gemini**, **OpenAI**, or **Anthropic**).
2. Choose your model tier (e.g., **Fast**, **Balanced**, or **Frontier**).
3. Paste your API key.
4. Toggle "Remember key in local browser storage" if you want the key to persist across browser visits.
5. Click **⚡ Test Connection**. The app will run a minimal ping payload via the CORS proxy to verify your credentials.
6. Once the connection is green, click **Unlock Application**.

### Step 2: Ingesting Data
You can load datasets into the workspace in two ways:
*   **Upload Your Own File**: Drag and drop or browse to upload any `.csv`, `.xlsx`, or `.xls` spreadsheet.
*   **Load Sandbox Data**: Click one of the virtual sandbox chips under the upload area to load sample records (*Tech Sales*, *User Demographics*, or *Weather Trends*).

### Step 3: Exploring the Dashboard
Once data is loaded, the application automatically:
1. Performs column-level type checking and descriptive statistical summaries.
2. Computes numeric correlations (Pearson's $r$).
3. Consults the configured LLM using the external `insights_prompt.md` instructions.
4. Renders interactive visualizations (using Chart.js) and narrative text summaries on the dashboard.

### Step 4: Interactive Data Chat
Ask specific questions in the chat bubble on the right side of the dashboard. The **Data Assistant** is governed by `chat_prompt.md` to safely answer questions based on the computed aggregate statistics profile without exposing or sharing private records.

---

## 📁 File Structure

```text
├── index.html            # Main dashboard and onboarding interface markup
├── style.css             # Glassmorphic UI design tokens & layout styles
├── script.js             # Core ingestion, profiling, and LLM adapter pipeline
├── config.js             # LLM model names, REST endpoints, and proxy settings
├── samples.json          # Pre-compiled static virtual sandbox datasets
├── insights_prompt.md    # System prompt template for report generation
└── chat_prompt.md        # System prompt template for the chat assistant
```
