// LLM PROVIDERS AND MODELS CONFIGURATION
const LLM_MODELS = {
    gemini: [
        { id: 'gemini-3.5-flash-lite', displayName: 'Gemini 3.5 Flash-Lite (Fast)', apiModelId: 'gemini-3.5-flash' },
        { id: 'gemini-3.6-flash', displayName: 'Gemini 3.6 Flash (Balanced)', apiModelId: 'gemini-3.6-flash' },
        { id: 'gemini-3.1-pro', displayName: 'Gemini 3.1 Pro (Frontier)', apiModelId: 'gemini-3.1-pro' }
    ],
    openai: [
        { id: 'gpt-5.6-luna', displayName: 'GPT-5.6 Luna (Fast)', apiModelId: 'gpt-5.6-luna' },
        { id: 'gpt-5.6-terra', displayName: 'GPT-5.6 Terra (Balanced)', apiModelId: 'gpt-5.6-terra' },
        { id: 'gpt-5.6-sol', displayName: 'GPT-5.6 Sol (Frontier)', apiModelId: 'gpt-5.6-sol' }
    ],
    anthropic: [
        { id: 'claude-3-5-haiku-20241022', displayName: 'Claude Haiku 4.5 (Fast)', apiModelId: 'claude-3-5-haiku-20241022' },
        { id: 'claude-3-5-sonnet-20241022', displayName: 'Claude Sonnet 5 (Balanced)', apiModelId: 'claude-3-5-sonnet-20241022' },
        { id: 'claude-3-opus-20240229', displayName: 'Claude Opus 5 (Frontier)', apiModelId: 'claude-3-opus-20240229' }
    ]
};

// API ENDPOINTS CONFIGURATION
const API_ENDPOINTS = {
    gemini: (apiModelId, key) => `https://generativelanguage.googleapis.com/v1beta/models/${apiModelId}:generateContent?key=${key}`,
    openai: () => `https://api.openai.com/v1/chat/completions`,
    anthropic: () => `https://api.anthropic.com/v1/messages`
};

// CORS PROXY CONFIGURATION
const CORS_PROXY_URL = 'https://corsproxy.io/?';
