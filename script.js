// STATE MANAGEMENT
const state = {
    fileName: '',
    fileSize: '',
    rawRows: [],          // Full parsed dataset (array of objects)
    headers: [],          // Column headers
    activeRows: [],       // Sampled or full dataset used for analysis (cap at 5000)
    columnMetadata: {},   // Stats profile per column
    correlations: [],     // Pearson correlations list
    activeSheet: '',      // Current Excel sheet
    sheets: [],           // List of Excel sheet names

    // LLM Configuration
    llmProvider: localStorage.getItem('llm_provider') || sessionStorage.getItem('llm_provider') || 'gemini',
    llmModel: localStorage.getItem('llm_model') || sessionStorage.getItem('llm_model') || 'gemini-3.6-flash',
    llmKey: localStorage.getItem('llm_key') || sessionStorage.getItem('llm_key') || '',
    llmPersist: localStorage.getItem('llm_persist') === 'true' || sessionStorage.getItem('llm_persist') === 'true' || false,

    report: null,         // Executive summary, title, insights
    tablePage: 1,
    tableRowsPerPage: 15,
    filteredRows: [],
    currentCharts: [],    // Store Chart.js instances for cleanup
    chatHistory: []       // Conversational logs
};


// INITIALIZATION
document.addEventListener('DOMContentLoaded', () => {
    initUI();
    initSampleDatasets();
    checkApiConfiguration();
});

// UI EVENT BINDINGS
function initUI() {
    // Icons
    if (window.lucide) {
        window.lucide.createIcons();
    }

    // Config Modals & Badge bindings
    const apiConfigModal = document.getElementById('apiConfigModal');
    const apiConfigBadge = document.getElementById('apiConfigBadge');
    const closeApiConfigBtn = document.getElementById('closeApiConfigBtn');

    // Onboarding Form Elements
    const onboardTabs = document.querySelectorAll('#onboardTabs .provider-tab');
    const onboardModelSelect = document.getElementById('onboardModel');
    const onboardKeyInput = document.getElementById('onboardKey');
    const onboardPersistCheckbox = document.getElementById('onboardPersist');
    const onboardStatusPanel = document.getElementById('onboardStatusPanel');
    const onboardTestBtn = document.getElementById('onboardTestBtn');
    const onboardUnlockBtn = document.getElementById('onboardUnlockBtn');

    // Modal Form Elements
    const modalTabs = document.querySelectorAll('#modalTabs .provider-tab');
    const modalModelSelect = document.getElementById('modalModel');
    const modalKeyInput = document.getElementById('modalKey');
    const modalPersistCheckbox = document.getElementById('modalPersist');
    const modalStatusPanel = document.getElementById('modalStatusPanel');
    const modalTestBtn = document.getElementById('modalTestBtn');
    const modalSaveBtn = document.getElementById('modalSaveBtn');
    const modalDisconnectBtn = document.getElementById('modalDisconnectBtn');

    // WIRING: ONBOARDING PROVIDER TABS
    onboardTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            onboardTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const provider = tab.getAttribute('data-provider');

            populateModelDropdown(provider, onboardModelSelect);
            onboardKeyInput.value = '';
            onboardKeyInput.placeholder = `Enter your ${provider === 'openai' ? 'OpenAI' : provider === 'anthropic' ? 'Anthropic' : 'Gemini'} API key...`;

            onboardStatusPanel.style.display = 'none';
            onboardStatusPanel.innerHTML = '';
            onboardUnlockBtn.disabled = true;
        });
    });

    // WIRING: MODAL PROVIDER TABS
    modalTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            modalTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const provider = tab.getAttribute('data-provider');

            populateModelDropdown(provider, modalModelSelect);
            modalKeyInput.value = '';
            modalKeyInput.placeholder = `Enter your ${provider === 'openai' ? 'OpenAI' : provider === 'anthropic' ? 'Anthropic' : 'Gemini'} API key...`;

            modalStatusPanel.style.display = 'none';
            modalStatusPanel.innerHTML = '';
            modalSaveBtn.disabled = true;
        });
    });

    // WIRING: CONNECTION TEST BUTTONS
    onboardTestBtn.addEventListener('click', () => {
        const activeTab = document.querySelector('#onboardTabs .provider-tab.active');
        const provider = activeTab.getAttribute('data-provider');
        const model = onboardModelSelect.value;
        const key = onboardKeyInput.value.trim();
        performConnectionTest(provider, model, key, onboardStatusPanel, onboardTestBtn, onboardUnlockBtn);
    });

    modalTestBtn.addEventListener('click', () => {
        const activeTab = document.querySelector('#modalTabs .provider-tab.active');
        const provider = activeTab.getAttribute('data-provider');
        const model = modalModelSelect.value;
        const key = modalKeyInput.value.trim();
        performConnectionTest(provider, model, key, modalStatusPanel, modalTestBtn, modalSaveBtn);
    });

    // WIRING: SAVE/UNLOCK ACTIONS
    onboardUnlockBtn.addEventListener('click', () => {
        const activeTab = document.querySelector('#onboardTabs .provider-tab.active');
        const provider = activeTab.getAttribute('data-provider');
        const model = onboardModelSelect.value;
        const key = onboardKeyInput.value.trim();
        const persist = onboardPersistCheckbox.checked;

        saveCredentials(provider, model, key, persist);

        document.getElementById('onboardingScreen').style.display = 'none';
        document.getElementById('uploadScreen').style.display = 'flex';
        showToast('Application unlocked! Ingestion layer active.');
    });

    modalSaveBtn.addEventListener('click', () => {
        const activeTab = document.querySelector('#modalTabs .provider-tab.active');
        const provider = activeTab.getAttribute('data-provider');
        const model = modalModelSelect.value;
        const key = modalKeyInput.value.trim();
        const persist = modalPersistCheckbox.checked;

        saveCredentials(provider, model, key, persist);

        apiConfigModal.classList.remove('show');
        showToast('LLM Configuration updated successfully!');

        if (state.rawRows.length > 0) {
            runReasoningAndComposition();
        }
    });

    modalDisconnectBtn.addEventListener('click', () => {
        clearCredentials();
        apiConfigModal.classList.remove('show');
        showToast('LLM credentials disconnected. Application locked.', 'warning');
    });

    // WIRING: SETTINGS MODAL TRIGGER
    apiConfigBadge.addEventListener('click', () => {
        if (state.llmKey) {
            closeApiConfigBtn.style.display = 'block';
        } else {
            closeApiConfigBtn.style.display = 'none';
        }

        // Set active tab based on active provider
        modalTabs.forEach(tab => {
            if (tab.getAttribute('data-provider') === state.llmProvider) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });

        populateModelDropdown(state.llmProvider, modalModelSelect);
        modalModelSelect.value = state.llmModel;
        modalKeyInput.value = state.llmKey;
        modalKeyInput.placeholder = `Enter your ${state.llmProvider === 'openai' ? 'OpenAI' : state.llmProvider === 'anthropic' ? 'Anthropic' : 'Gemini'} API key...`;
        modalPersistCheckbox.checked = state.llmPersist;

        modalStatusPanel.style.display = 'none';
        modalStatusPanel.innerHTML = '';
        modalSaveBtn.disabled = true;

        apiConfigModal.classList.add('show');
    });

    closeApiConfigBtn.addEventListener('click', () => {
        apiConfigModal.classList.remove('show');
    });

    // File Upload Area
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');

    uploadArea.addEventListener('click', () => {
        if (!state.llmKey) {
            promptApiSetup();
            return;
        }
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleUploadedFile(e.target.files[0]);
        }
    });

    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = 'var(--primary-light)';
        uploadArea.style.background = 'rgba(79, 70, 229, 0.06)';
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.style.borderColor = 'rgba(255, 255, 255, 0.15)';
        uploadArea.style.background = 'rgba(255, 255, 255, 0.02)';
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = 'rgba(255, 255, 255, 0.15)';
        uploadArea.style.background = 'rgba(255, 255, 255, 0.02)';
        if (!state.llmKey) {
            promptApiSetup();
            return;
        }
        if (e.dataTransfer.files.length > 0) {
            handleUploadedFile(e.dataTransfer.files[0]);
        }
    });

    // Reset Button
    document.getElementById('resetBtn').addEventListener('click', resetApp);

    // Sheet Selector
    document.getElementById('sheetSelect').addEventListener('change', (e) => {
        state.activeSheet = e.target.value;
        processExcelSheet();
    });

    // Data Preview Modal
    const previewModal = document.getElementById('dataPreviewModal');
    document.getElementById('toggleDataPreviewBtn').addEventListener('click', () => {
        state.filteredRows = [...state.rawRows];
        state.tablePage = 1;
        renderModalTable();
        previewModal.classList.add('show');
    });

    document.getElementById('closeModalBtn').addEventListener('click', () => {
        previewModal.classList.remove('show');
    });

    previewModal.addEventListener('click', (e) => {
        if (e.target === previewModal) {
            previewModal.classList.remove('show');
        }
    });

    // Search Input inside Modal Table
    document.getElementById('tableSearchInput').addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        if (!query) {
            state.filteredRows = [...state.rawRows];
        } else {
            state.filteredRows = state.rawRows.filter(row => {
                return Object.values(row).some(val =>
                    val !== null && val !== undefined && String(val).toLowerCase().includes(query)
                );
            });
        }
        state.tablePage = 1;
        renderModalTable();
    });

    // Modal Pagination Buttons
    document.getElementById('prevPageBtn').addEventListener('click', () => {
        if (state.tablePage > 1) {
            state.tablePage--;
            renderModalTable();
        }
    });

    document.getElementById('nextPageBtn').addEventListener('click', () => {
        const totalPages = Math.ceil(state.filteredRows.length / state.tableRowsPerPage);
        if (state.tablePage < totalPages) {
            state.tablePage++;
            renderModalTable();
        }
    });

    // Chat Actions
    document.getElementById('sendChatBtn').addEventListener('click', handleUserChatMessage);
    document.getElementById('chatInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleUserChatMessage();
        }
    });
}

function checkApiConfiguration() {
    updateApiStatusBadge();

    // Populate initial onboarding values
    const onboardModelSelect = document.getElementById('onboardModel');
    populateModelDropdown(state.llmProvider, onboardModelSelect);
    onboardModelSelect.value = state.llmModel;
    document.getElementById('onboardKey').value = state.llmKey;
    document.getElementById('onboardPersist').checked = state.llmPersist;

    // Set active tab in onboarding
    const onboardTabs = document.querySelectorAll('#onboardTabs .provider-tab');
    onboardTabs.forEach(tab => {
        if (tab.getAttribute('data-provider') === state.llmProvider) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });

    if (state.llmKey) {
        document.getElementById('onboardingScreen').style.display = 'none';
        document.getElementById('uploadScreen').style.display = 'flex';
    } else {
        document.getElementById('onboardingScreen').style.display = 'flex';
        document.getElementById('uploadScreen').style.display = 'none';
    }
}

function promptApiSetup() {
    showToast('LLM Configuration Required: Please connect an API key.', 'warning');
    document.getElementById('uploadScreen').style.display = 'none';
    document.getElementById('onboardingScreen').style.display = 'flex';
}

function populateModelDropdown(provider, selectEl) {
    selectEl.innerHTML = '';
    const models = LLM_MODELS[provider] || [];
    models.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = m.displayName;
        selectEl.appendChild(opt);
    });
}

function updateApiStatusBadge() {
    const badgeText = document.getElementById('apiStatusText');
    const statusDot = document.getElementById('apiKeyStatusDot');

    if (state.llmKey) {
        const providerName = state.llmProvider.toUpperCase();
        const providerList = LLM_MODELS[state.llmProvider] || [];
        const modelConfig = providerList.find(m => m.id === state.llmModel);
        const displayName = modelConfig ? modelConfig.displayName.split(' ')[0] : state.llmModel;

        badgeText.textContent = `${providerName}: ${displayName}`;
        statusDot.classList.add('active');
    } else {
        badgeText.textContent = "Setup LLM API";
        statusDot.classList.remove('active');
    }
}

// STORAGE CREDENTIALS ACTIONS
function saveCredentials(provider, model, key, persist) {
    state.llmProvider = provider;
    state.llmModel = model;
    state.llmKey = key;
    state.llmPersist = persist;

    // Clear previous settings
    localStorage.removeItem('llm_provider');
    localStorage.removeItem('llm_model');
    localStorage.removeItem('llm_key');
    localStorage.removeItem('llm_persist');

    sessionStorage.removeItem('llm_provider');
    sessionStorage.removeItem('llm_model');
    sessionStorage.removeItem('llm_key');
    sessionStorage.removeItem('llm_persist');

    const storage = persist ? localStorage : sessionStorage;
    storage.setItem('llm_provider', provider);
    storage.setItem('llm_model', model);
    storage.setItem('llm_key', key);
    storage.setItem('llm_persist', String(persist));

    updateApiStatusBadge();
}

function clearCredentials() {
    state.llmProvider = 'gemini';
    state.llmModel = 'gemini-3.6-flash';
    state.llmKey = '';
    state.llmPersist = false;

    localStorage.removeItem('llm_provider');
    localStorage.removeItem('llm_model');
    localStorage.removeItem('llm_key');
    localStorage.removeItem('llm_persist');

    sessionStorage.removeItem('llm_provider');
    sessionStorage.removeItem('llm_model');
    sessionStorage.removeItem('llm_key');
    sessionStorage.removeItem('llm_persist');

    updateApiStatusBadge();
    resetApp();

    document.getElementById('uploadScreen').style.display = 'none';
    document.getElementById('onboardingScreen').style.display = 'flex';
}

// CONNECTION TEST PING
async function performConnectionTest(provider, modelId, key, statusPanel, actionBtn, saveBtn) {
    statusPanel.style.display = 'block';
    statusPanel.className = 'connection-status-panel';
    statusPanel.textContent = 'Verifying connection... Please wait.';
    actionBtn.disabled = true;
    if (saveBtn) saveBtn.disabled = true;

    const startTime = Date.now();

    try {
        if (!key) {
            throw new Error("API Key cannot be empty");
        }

        const system = "You are a helpful ping assistant. Reply with 'pong'.";
        const user = "ping";

        await sendLLMRequest(provider, modelId, key, system, user, true);

        const latency = Date.now() - startTime;
        statusPanel.className = 'connection-status-panel success';
        statusPanel.innerHTML = `🟢 Connection successful!<br><small>Verified in ${latency}ms via CORS Proxy.</small>`;

        if (saveBtn) saveBtn.disabled = false;
    } catch (err) {
        statusPanel.className = 'connection-status-panel error';
        statusPanel.innerHTML = `🔴 Connection failed:<br><small>${err.message}</small>`;
    } finally {
        actionBtn.disabled = false;
    }
}

// UNIFIED ADAPTER AND CORS PROXY PIPELINE
async function sendLLMRequest(provider, modelId, key, systemPrompt, userPrompt, isPing = false) {
    const providerList = LLM_MODELS[provider] || [];
    const modelConfig = providerList.find(m => m.id === modelId) || providerList[0];
    const apiModelId = modelConfig ? modelConfig.apiModelId : modelId;

    if (provider === 'gemini') {
        const targetUrl = API_ENDPOINTS.gemini(apiModelId, key);
        const finalUrl = `${CORS_PROXY_URL}${encodeURIComponent(targetUrl)}`;

        const payload = {
            contents: [{
                role: "user",
                parts: [{ text: userPrompt }]
            }],
            systemInstruction: {
                parts: [{ text: systemPrompt }]
            }
        };

        if (!isPing) {
            payload.generationConfig = {
                responseMimeType: "application/json"
            };
        } else {
            payload.generationConfig = {
                maxOutputTokens: 5
            };
        }

        const res = await fetch(finalUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Gemini Error (${res.status}): ${errText}`);
        }

        const data = await res.json();
        return data.candidates[0].content.parts[0].text;
    }

    if (provider === 'openai') {
        const targetUrl = API_ENDPOINTS.openai();
        const finalUrl = `${CORS_PROXY_URL}${encodeURIComponent(targetUrl)}`;

        const payload = {
            model: apiModelId,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ]
        };

        if (!isPing) {
            payload.response_format = { type: "json_object" };
        } else {
            payload.max_tokens = 5;
        }

        const res = await fetch(finalUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${key}`
            },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`OpenAI Error (${res.status}): ${errText}`);
        }

        const data = await res.json();
        return data.choices[0].message.content;
    }

    if (provider === 'anthropic') {
        const targetUrl = API_ENDPOINTS.anthropic();
        const finalUrl = `${CORS_PROXY_URL}${encodeURIComponent(targetUrl)}`;

        const payload = {
            model: apiModelId,
            max_tokens: isPing ? 5 : 4000,
            system: systemPrompt,
            messages: [
                { role: "user", content: userPrompt }
            ]
        };

        const res = await fetch(finalUrl, {
            method: 'POST',
            headers: {
                'x-api-key': key,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Anthropic Error (${res.status}): ${errText}`);
        }

        const data = await res.json();
        return data.content[0].text;
    }

    throw new Error(`Unsupported provider: ${provider}`);
}

// INGESTION LAYER - SANDBOX DATASETS
function initSampleDatasets() {
    const sampleChips = document.querySelectorAll('.sample-chip');
    sampleChips.forEach(chip => {
        chip.addEventListener('click', () => {
            if (!state.llmKey) {
                promptApiSetup();
                return;
            }
            const sampleType = chip.getAttribute('data-sample');
            loadSampleDataset(sampleType);
        });
    });
}

async function loadSampleDataset(type) {
    let fileName = '';

    if (type === 'tech-sales') {
        fileName = 'tech_sales_q1_2025.csv';
    } else if (type === 'user-demographics') {
        fileName = 'user_demographics_profiles.csv';
    } else if (type === 'weather-trends') {
        fileName = 'weather_trends_global.csv';
    }

    try {
        const response = await fetch('samples.json');
        if (!response.ok) {
            throw new Error(`Failed to load samples.json (${response.status})`);
        }
        const samples = await response.json();
        const rows = samples[type];

        if (!rows || rows.length === 0) {
            throw new Error(`Sample type "${type}" not found in samples.json`);
        }

        state.fileName = fileName;
        state.fileSize = 'Mock CSV (Virtual)';
        state.rawRows = rows;
        state.headers = Object.keys(rows[0] || {});

        // Auto process dataset
        processDataset();
    } catch (err) {
        console.error("Error loading sample data:", err);
        showToast(`Failed to load sample dataset: ${err.message}`, "danger");
    }
}

// INGESTION LAYER - UPLOAD & PARSING
function handleUploadedFile(file) {
    state.fileName = file.name;
    state.fileSize = formatFileSize(file.size);

    const fileExtension = file.name.split('.').pop().toLowerCase();

    if (fileExtension === 'csv') {
        // Parse CSV
        Papa.parse(file, {
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true,
            complete: function (results) {
                if (results.errors.length > 0) {
                    console.warn('PapaParse warnings:', results.errors);
                }
                if (results.data && results.data.length > 0) {
                    state.rawRows = results.data;
                    state.headers = Object.keys(results.data[0]);
                    document.getElementById('sheetSelectorContainer').style.display = 'none';
                    processDataset();
                } else {
                    showToast('Error: CSV file seems to be empty.', 'danger');
                }
            },
            error: function (err) {
                showToast('Failed to parse CSV file: ' + err.message, 'danger');
            }
        });
    } else if (['xlsx', 'xls'].includes(fileExtension)) {
        // Parse Excel
        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                state.sheets = workbook.SheetNames;
                state.activeSheet = workbook.SheetNames[0];
                state.workbookInstance = workbook; // cache workbook

                // Show sheet selector
                const sheetSelect = document.getElementById('sheetSelect');
                sheetSelect.innerHTML = '';
                state.sheets.forEach(sheet => {
                    const opt = document.createElement('option');
                    opt.value = sheet;
                    opt.textContent = sheet;
                    sheetSelect.appendChild(opt);
                });
                document.getElementById('sheetSelectorContainer').style.display = 'flex';

                processExcelSheet();
            } catch (err) {
                showToast('Failed to parse Excel file: ' + err.message, 'danger');
            }
        };
        reader.readAsArrayBuffer(file);
    } else {
        showToast('Unsupported file type. Please upload a .csv, .xlsx, or .xls file.', 'danger');
    }
}

function processExcelSheet() {
    const sheet = state.workbookInstance.Sheets[state.activeSheet];
    const data = XLSX.utils.sheet_to_json(sheet, { defval: null });

    if (data.length > 0) {
        state.rawRows = data;
        state.headers = Object.keys(data[0]);
        processDataset();
    } else {
        showToast('Sheet is empty. Please select another sheet or file.', 'danger');
    }
}

// INGESTION LAYER - SAMPLING AND INITIAL STATS
function processDataset() {
    // Cap rows for performance in profiling/reasoning (5000 max)
    const MAX_ROWS = 5000;
    if (state.rawRows.length > MAX_ROWS) {
        showToast(`Dataset of ${state.rawRows.length} rows is capped at ${MAX_ROWS} for high-performance profiling.`, 'info');
        state.activeRows = shuffleAndSample(state.rawRows, MAX_ROWS);
    } else {
        state.activeRows = [...state.rawRows];
    }

    // Switch views
    document.getElementById('uploadScreen').style.display = 'none';
    document.getElementById('dashboardScreen').style.display = 'flex';
    document.getElementById('resetBtn').style.display = 'inline-flex';

    // Update basic sidebar metadata
    document.getElementById('metaFileName').textContent = state.fileName;
    document.getElementById('metaFileSize').textContent = state.fileSize;
    document.getElementById('metaTotalRows').textContent = state.rawRows.length.toLocaleString();
    document.getElementById('metaTotalCols').textContent = state.headers.length.toLocaleString();
    document.getElementById('colCountBadge').textContent = `${state.headers.length} Cols`;

    // Trigger Profile
    runProfiling();
}

// PROFILING LAYER - STATS ENGINE
function runProfiling() {
    const profile = {};
    const numericCols = [];

    state.headers.forEach(col => {
        const values = state.activeRows.map(r => r[col]);
        const type = inferColumnType(values);

        const nullCount = values.filter(v => v === null || v === undefined || v === '').length;
        const nullPct = (nullCount / values.length) * 100;

        const colProfile = {
            type: type,
            nullCount: nullCount,
            nullPercentage: Math.round(nullPct * 10) / 10
        };

        if (type === 'numeric') {
            numericCols.push(col);
            const validNums = values.filter(v => typeof v === 'number' && !isNaN(v)).sort((a, b) => a - b);

            if (validNums.length > 0) {
                const min = validNums[0];
                const max = validNums[validNums.length - 1];
                const sum = validNums.reduce((a, b) => a + b, 0);
                const mean = sum / validNums.length;

                // Median
                const mid = Math.floor(validNums.length / 2);
                const median = validNums.length % 2 !== 0 ? validNums[mid] : (validNums[mid - 1] + validNums[mid]) / 2;

                // Std Dev
                const sqDiffSum = validNums.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0);
                const stdDev = Math.sqrt(sqDiffSum / validNums.length);

                // Outliers (IQR)
                const q1 = validNums[Math.floor(validNums.length * 0.25)];
                const q3 = validNums[Math.floor(validNums.length * 0.75)];
                const iqr = q3 - q1;
                const lowerBound = q1 - 1.5 * iqr;
                const upperBound = q3 + 1.5 * iqr;
                const outlierValues = validNums.filter(v => v < lowerBound || v > upperBound);

                // Histogram (10 bins)
                const bins = [];
                const binCount = 10;
                const step = (max - min) / binCount;
                for (let i = 0; i < binCount; i++) {
                    const start = min + i * step;
                    const end = start + step;
                    bins.push({
                        label: `${formatNumberCompact(start)} - ${formatNumberCompact(end)}`,
                        start: start,
                        end: end,
                        count: 0
                    });
                }

                validNums.forEach(v => {
                    let placed = false;
                    for (let i = 0; i < binCount; i++) {
                        if (v >= bins[i].start && v <= bins[i].end) {
                            bins[i].count++;
                            placed = true;
                            break;
                        }
                    }
                    if (!placed && bins.length > 0) {
                        // Place boundary case on edge
                        bins[bins.length - 1].count++;
                    }
                });

                colProfile.min = Math.round(min * 100) / 100;
                colProfile.max = Math.round(max * 100) / 100;
                colProfile.mean = Math.round(mean * 100) / 100;
                colProfile.median = Math.round(median * 100) / 100;
                colProfile.stdDev = Math.round(stdDev * 100) / 100;
                colProfile.outlierCount = outlierValues.length;
                colProfile.histogram = bins.map(b => ({ label: b.label, count: b.count }));
            }
        } else if (type === 'categorical') {
            const counts = {};
            values.forEach(v => {
                if (v !== null && v !== undefined && v !== '') {
                    counts[v] = (counts[v] || 0) + 1;
                }
            });

            const frequencies = Object.entries(counts)
                .map(([val, count]) => ({ value: val, count: count }))
                .sort((a, b) => b.count - a.count);

            colProfile.uniqueCount = frequencies.length;
            colProfile.frequencies = frequencies.slice(0, 15); // Top 15 categories
        } else if (type === 'date') {
            const validDates = values.map(v => Date.parse(v)).filter(v => !isNaN(v)).sort((a, b) => a - b);
            if (validDates.length > 0) {
                colProfile.minDate = new Date(validDates[0]).toISOString().split('T')[0];
                colProfile.maxDate = new Date(validDates[validDates.length - 1]).toISOString().split('T')[0];
            }
        }

        profile[col] = colProfile;
    });

    state.columnMetadata = profile;

    // Linear Correlations between numeric variables (Pearson r)
    state.correlations = [];
    for (let i = 0; i < numericCols.length; i++) {
        for (let j = i + 1; j < numericCols.length; j++) {
            const colA = numericCols[i];
            const colB = numericCols[j];
            const pairs = state.activeRows.map(r => [r[colA], r[colB]])
                .filter(p => typeof p[0] === 'number' && typeof p[1] === 'number' && !isNaN(p[0]) && !isNaN(p[1]));

            if (pairs.length > 5) {
                const x = pairs.map(p => p[0]);
                const y = pairs.map(p => p[1]);
                const r = calculatePearson(x, y);
                if (Math.abs(r) >= 0.3) {
                    state.correlations.push({
                        col1: colA,
                        col2: colB,
                        value: Math.round(r * 100) / 100
                    });
                }
            }
        }
    }
    state.correlations.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

    // Render columns in sidebar
    renderSidebarColumns();

    // Trigger Reasoning & Composition
    runReasoningAndComposition();
}

function inferColumnType(values) {
    const total = values.length;
    let numCount = 0;
    let dateCount = 0;
    let nonNullCount = 0;

    // Check type sample size
    const sampleLimit = Math.min(total, 500);
    const sampledValues = shuffleAndSample(values, sampleLimit);

    sampledValues.forEach(v => {
        if (v === null || v === undefined || v === '') return;
        nonNullCount++;

        // Check number
        if (typeof v === 'number') {
            numCount++;
            return;
        }
        if (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v))) {
            numCount++;
            return;
        }

        // Check date
        // Reject simple short numbers or patterns that Date.parse will false-positive
        if (typeof v === 'string' && isNaN(Number(v)) && v.length > 5) {
            const parsed = Date.parse(v);
            if (!isNaN(parsed)) {
                dateCount++;
            }
        }
    });

    if (nonNullCount === 0) return 'text';

    if (numCount / nonNullCount > 0.8) {
        return 'numeric';
    }
    if (dateCount / nonNullCount > 0.8) {
        return 'date';
    }

    // Determine if text is categorical or raw text
    const uniqueVals = new Set(sampledValues.filter(v => v !== null && v !== undefined && v !== ''));
    if (uniqueVals.size <= 15 || (uniqueVals.size / nonNullCount) < 0.2) {
        return 'categorical';
    }

    return 'text';
}

function calculatePearson(x, y) {
    const n = x.length;
    let sumX = 0, sumY = 0, sumXY = 0;
    let sumX2 = 0, sumY2 = 0;

    for (let i = 0; i < n; i++) {
        sumX += x[i];
        sumY += y[i];
        sumXY += x[i] * y[i];
        sumX2 += x[i] * x[i];
        sumY2 += y[i] * y[i];
    }

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    if (denominator === 0) return 0;
    return numerator / denominator;
}

// REASONING LAYER - MAIN RUNNER
async function runReasoningAndComposition() {
    // Display loading state
    const providerName = state.llmProvider.toUpperCase();
    document.getElementById('reportTitle').textContent = `Analyzing structure via ${providerName}...`;
    document.getElementById('reportNarrative').textContent = `Sending stats profile to ${state.llmModel}. This might take a few seconds...`;
    document.getElementById('insightsGrid').innerHTML = '<div class="insight-card"><h4 style="text-align:center;width:100%;">Contacting LLM...</h4></div>';

    try {
        const reportData = await generateLLMReport();
        state.report = reportData;

        // COMPOSITION LAYER
        resolveInsightsAndCharts();

        // PRESENTATION LAYER
        renderDashboard();
    } catch (err) {
        console.error("LLM Generation failed:", err);
        showToast(`LLM Request Failed: ${err.message}`, "danger");

        // Show error details on screen
        document.getElementById('reportTitle').textContent = "Analysis Failed";
        document.getElementById('reportNarrative').innerHTML = `
            <div style="color:var(--danger); font-weight:600; margin-bottom:10px;">Error calling LLM Provider: ${state.llmProvider.toUpperCase()}</div>
            <code style="display:block; background:rgba(239,68,68,0.08); padding:12px; border-radius:8px; border:1px solid rgba(239,68,68,0.2); font-family:monospace; color:#f87171; white-space:pre-wrap; word-break:break-all;">${err.message}</code>
            <p style="margin-top:15px; font-size:13px; color:var(--text-secondary);">Please verify your API key, network connection, or billing/model quota details by clicking the <strong>Setup LLM API</strong> button in the top-right header.</p>
        `;
        document.getElementById('insightsGrid').innerHTML = `
            <div class="insight-card" style="border-color:rgba(239,68,68,0.2); background:rgba(239,68,68,0.02); text-align:center;">
                <h4 style="color:#f87171; margin-bottom:10px;">Visualizations Blocked</h4>
                <p style="color:var(--text-secondary); font-size:13px;">Charts and insights could not be composed because the reasoning engine returned an error.</p>
            </div>
        `;
    }
}

// LLM REASONING LAYER (Gemini, OpenAI, and Anthropic Calls)
async function generateLLMReport() {
    const simplifiedProfile = {
        fileName: state.fileName,
        totalRows: state.rawRows.length,
        columnMetadata: {}
    };

    // Simplify column metadata to fit in LLM context limits safely
    Object.keys(state.columnMetadata).forEach(col => {
        const metadata = state.columnMetadata[col];
        simplifiedProfile.columnMetadata[col] = {
            type: metadata.type,
            nullPercentage: metadata.nullPercentage,
            min: metadata.min,
            max: metadata.max,
            mean: metadata.mean,
            uniqueCount: metadata.uniqueCount,
            frequencies: metadata.frequencies ? metadata.frequencies.slice(0, 5) : undefined, // top 5 only
            minDate: metadata.minDate,
            maxDate: metadata.maxDate
        };
    });

    const response = await fetch('insights_prompt.md');
    if (!response.ok) {
        throw new Error(`Failed to load insights_prompt.md (${response.status})`);
    }
    let promptTemplate = await response.text();

    const promptText = promptTemplate
        .replace('{{DATA_PROFILE}}', JSON.stringify(simplifiedProfile, null, 2))
        .replace('{{CORRELATIONS}}', JSON.stringify(state.correlations, null, 2));

    const systemPrompt = "You are a senior data analyst. You must return ONLY a JSON response matching the requested schema.";
    const responseContent = await sendLLMRequest(state.llmProvider, state.llmModel, state.llmKey, systemPrompt, promptText, false);
    return parseLLMJsonResponse(responseContent);
}

function parseLLMJsonResponse(text) {
    let cleanText = text.trim();
    if (cleanText.startsWith('```')) {
        cleanText = cleanText.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '').trim();
    }
    return JSON.parse(cleanText);
}

// COMPOSITION LAYER (Resolves chart specs against real raw data)
function resolveInsightsAndCharts() {
    if (!state.report || !state.report.insights) return;

    state.report.insights.forEach(insight => {
        // 1. Column correction / fuzzy matching
        const resolvedColumns = [];
        insight.columns.forEach(col => {
            const matchedCol = findFuzzyColumnMatch(col);
            if (matchedCol) {
                resolvedColumns.push(matchedCol);
            }
        });

        insight.columns = resolvedColumns;

        if (resolvedColumns.length === 0) {
            // Drop chart requirement if columns couldn't be resolved
            insight.chartType = null;
            return;
        }

        // 2. Compute actual chart data values
        try {
            insight.chartData = computeChartData(insight.chartType, resolvedColumns);
        } catch (err) {
            console.error(`Failed to compute chart data for insight: ${insight.title}`, err);
            insight.chartType = null; // revert to plain card if math calculation crashes
        }
    });
}

function findFuzzyColumnMatch(colName) {
    const list = state.headers;
    if (list.includes(colName)) return colName;

    // Direct case-insensitive search
    const lower = colName.toLowerCase().trim();
    const exactMatch = list.find(c => c.toLowerCase().trim() === lower);
    if (exactMatch) return exactMatch;

    // Substring match
    const subMatch = list.find(c => c.toLowerCase().includes(lower) || lower.includes(c.toLowerCase()));
    if (subMatch) return subMatch;

    return null;
}

function computeChartData(chartType, columns) {
    const rows = state.activeRows;

    if (chartType === 'line') {
        // Line Chart expects: columns[0] = Date/Time or numeric, columns[1] = Numeric (value)
        const xCol = columns[0];
        const yCol = columns[1] || columns[0]; // fallback to same if single

        // Group and sort
        const isXDate = state.columnMetadata[xCol]?.type === 'date';

        const grouped = {};
        rows.forEach(r => {
            let key = r[xCol];
            let val = Number(r[yCol]);
            if (key === null || key === undefined || isNaN(val)) return;

            if (isXDate) {
                // normalize date to readable key
                try {
                    const d = new Date(key);
                    if (!isNaN(d.getTime())) {
                        key = d.toISOString().split('T')[0]; // YYYY-MM-DD
                    }
                } catch (e) { }
            }

            if (!grouped[key]) {
                grouped[key] = { sum: 0, count: 0 };
            }
            grouped[key].sum += val;
            grouped[key].count++;
        });

        // Sort keys
        const sortedKeys = Object.keys(grouped).sort((a, b) => {
            if (isXDate) return Date.parse(a) - Date.parse(b);
            // Numeric sort
            if (!isNaN(Number(a)) && !isNaN(Number(b))) return Number(a) - Number(b);
            // Lexical sort
            return String(a).localeCompare(String(b));
        });

        // Limit density of points on screen (max 30 points to look clean)
        let keysToRender = sortedKeys;
        if (sortedKeys.length > 30) {
            const step = Math.ceil(sortedKeys.length / 30);
            keysToRender = sortedKeys.filter((_, idx) => idx % step === 0);
        }

        return {
            labels: keysToRender,
            datasets: [{
                label: `Average ${yCol}`,
                data: keysToRender.map(k => Math.round((grouped[k].sum / grouped[k].count) * 100) / 100),
                borderColor: '#6366f1',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.3
            }]
        };
    }

    if (chartType === 'bar' || chartType === 'pie') {
        const xCol = columns[0];
        const yCol = columns[1]; // might be undefined

        const grouped = {};

        rows.forEach(r => {
            const key = r[xCol];
            if (key === null || key === undefined || key === '') return;

            if (yCol) {
                const val = Number(r[yCol]);
                if (isNaN(val)) return;
                if (!grouped[key]) grouped[key] = { sum: 0, count: 0 };
                grouped[key].sum += val;
                grouped[key].count++;
            } else {
                // Frequency count
                if (!grouped[key]) grouped[key] = { count: 0 };
                grouped[key].count++;
            }
        });

        // Sort descending
        const sorted = Object.entries(grouped).map(([key, data]) => {
            const val = yCol ? (data.sum / data.count) : data.count;
            return { label: key, value: Math.round(val * 100) / 100 };
        }).sort((a, b) => b.value - a.value);

        // Cap at 10 items, combine others
        let finalData = [];
        if (sorted.length > 10) {
            finalData = sorted.slice(0, 9);
            const otherSum = sorted.slice(9).reduce((sum, item) => sum + item.value, 0);
            finalData.push({ label: 'Other', value: Math.round(otherSum * 100) / 100 });
        } else {
            finalData = sorted;
        }

        const colors = [
            '#6366f1', '#10b981', '#f59e0b', '#3b82f6', '#ec4899',
            '#8b5cf6', '#14b8a6', '#f43f5e', '#06b6d4', '#84cc16'
        ];

        return {
            labels: finalData.map(d => d.label),
            datasets: [{
                label: yCol ? `Average ${yCol}` : 'Count',
                data: finalData.map(d => d.value),
                backgroundColor: chartType === 'pie' ? colors : colors[0],
                borderColor: chartType === 'pie' ? '#0f172a' : 'transparent',
                borderWidth: chartType === 'pie' ? 2 : 0,
                borderRadius: chartType === 'bar' ? 6 : 0
            }]
        };
    }

    if (chartType === 'scatter') {
        // Scatter plot expects: columns[0] = X variable, columns[1] = Y variable (both numeric)
        const xCol = columns[0];
        const yCol = columns[1];

        // Sample data points to maximum of 150 for render speed and readability
        const validPoints = rows.map(r => ({
            x: Number(r[xCol]),
            y: Number(r[yCol])
        })).filter(p => !isNaN(p.x) && !isNaN(p.y));

        const sampledPoints = shuffleAndSample(validPoints, 150);

        return {
            datasets: [{
                label: `${xCol} vs ${yCol}`,
                data: sampledPoints,
                backgroundColor: 'rgba(16, 185, 129, 0.7)',
                borderColor: '#10b981',
                borderWidth: 1,
                pointRadius: 5,
                pointHoverRadius: 7
            }]
        };
    }

    return null;
}

// PRESENTATION LAYER - RENDERING UI
function renderSidebarColumns() {
    const container = document.getElementById('columnList');
    container.innerHTML = '';

    state.headers.forEach(col => {
        const metadata = state.columnMetadata[col];
        const div = document.createElement('div');
        div.className = 'column-item';

        let statsHtml = '';
        if (metadata.type === 'numeric') {
            statsHtml = `Mean: ${formatNumberCompact(metadata.mean)}`;
        } else if (metadata.type === 'categorical') {
            statsHtml = `${metadata.uniqueCount} unique`;
        } else if (metadata.type === 'date') {
            statsHtml = `Date range`;
        } else {
            statsHtml = `Text data`;
        }

        div.innerHTML = `
            <div class="column-name-type">
                <span class="col-type-tag ${metadata.type}">${metadata.type.slice(0, 3)}</span>
                <span class="col-name-label" title="${col}">${col}</span>
            </div>
            <div class="col-stats-summary">${statsHtml}</div>
        `;
        container.appendChild(div);
    });
}

function renderDashboard() {
    // Destroy previous Chart instances
    state.currentCharts.forEach(c => c.destroy());
    state.currentCharts = [];

    // Engine Banner Update
    const banner = document.getElementById('engineBanner');
    const bTitle = document.getElementById('engineBannerTitle');
    const bDesc = document.getElementById('engineBannerDesc');

    banner.className = "engine-banner ai-active";
    bTitle.textContent = `${state.llmProvider.toUpperCase()} AI Layer Connected`;
    bDesc.textContent = `Insights are powered by cognitive reasoning with ${state.llmModel} directly via secure API.`;

    // Update Report Text
    document.getElementById('reportTitle').textContent = state.report.title;
    document.getElementById('reportNarrative').textContent = state.report.summary;

    // Render Metrics Row
    renderMetricsRow();

    // Render Insights & Charts
    renderInsightsGrid();

    // Render Correlation Matrix Map
    renderCorrelationSection();

    // Suggestion Buttons in Chat
    renderChatSuggestions();
}

function renderMetricsRow() {
    const grid = document.getElementById('metricsGrid');
    grid.innerHTML = '';

    // Calculate overall missingness
    let totalCells = state.activeRows.length * state.headers.length;
    let missingCells = 0;
    state.headers.forEach(col => {
        missingCells += state.columnMetadata[col].nullCount;
    });
    const completeness = Math.round((1 - (missingCells / totalCells)) * 1000) / 10;

    const metrics = [
        {
            title: 'Completeness',
            value: `${completeness}%`,
            desc: 'Cell population rate',
            icon: 'check-circle'
        },
        {
            title: 'Numeric Attributes',
            value: Object.values(state.columnMetadata).filter(c => c.type === 'numeric').length,
            desc: 'Continuous variables',
            icon: 'trending-up'
        },
        {
            title: 'Categorical Keys',
            value: Object.values(state.columnMetadata).filter(c => c.type === 'categorical').length,
            desc: 'Discrete variables',
            icon: 'bar-chart'
        },
        {
            title: 'Outlier Count',
            value: Object.values(state.columnMetadata).filter(c => c.type === 'numeric').reduce((sum, c) => sum + (c.outlierCount || 0), 0),
            desc: 'Total anomalous points',
            icon: 'alert-triangle'
        }
    ];

    metrics.forEach(m => {
        const card = document.createElement('div');
        card.className = 'metric-card';
        card.innerHTML = `
            <div class="metric-header">
                <span>${m.title}</span>
                <i data-lucide="${m.icon}"></i>
            </div>
            <div>
                <div class="metric-value">${m.value}</div>
                <div class="metric-desc">${m.desc}</div>
            </div>
        `;
        grid.appendChild(card);
    });

    if (window.lucide) {
        window.lucide.createIcons({ attrs: { class: 'lucide-icon' } });
    }
}

function renderInsightsGrid() {
    const grid = document.getElementById('insightsGrid');
    grid.innerHTML = '';

    state.report.insights.forEach((insight, index) => {
        const card = document.createElement('div');
        card.className = 'insight-card';

        let chartHtml = '';
        if (insight.chartType) {
            chartHtml = `
                <div class="chart-container">
                    <canvas id="chart_canvas_${index}"></canvas>
                </div>
            `;
        }

        card.innerHTML = `
            <div class="insight-header">
                <div class="insight-title-group">
                    <span class="badge" style="margin-bottom:6px;">Insight #${index + 1} • ${insight.type}</span>
                    <h4>${insight.title}</h4>
                </div>
                <span class="insight-importance-badge ${insight.importance}">${insight.importance}</span>
            </div>
            <p class="insight-description">${insight.description}</p>
            ${chartHtml}
        `;

        grid.appendChild(card);

        // Render ChartJS
        if (insight.chartType && insight.chartData) {
            const ctx = document.getElementById(`chart_canvas_${index}`).getContext('2d');

            const config = {
                type: insight.chartType,
                data: insight.chartData,
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: insight.chartType === 'pie',
                            labels: {
                                color: '#94a3b8',
                                font: { family: 'Inter', size: 10 }
                            }
                        },
                        tooltip: {
                            backgroundColor: '#1e293b',
                            titleColor: '#fff',
                            bodyColor: '#cbd5e1',
                            borderColor: 'rgba(255,255,255,0.08)',
                            borderWidth: 1,
                            padding: 10,
                            displayColors: false
                        }
                    },
                    scales: insight.chartType === 'pie' ? undefined : {
                        x: {
                            type: insight.chartType === 'scatter' ? 'linear' : undefined,
                            grid: { color: 'rgba(255, 255, 255, 0.05)' },
                            ticks: {
                                color: '#94a3b8',
                                font: { family: 'Inter', size: 9 },
                                maxRotation: 30,
                                minRotation: 0
                            }
                        },
                        y: {
                            grid: { color: 'rgba(255, 255, 255, 0.05)' },
                            ticks: {
                                color: '#94a3b8',
                                font: { family: 'Inter', size: 9 }
                            }
                        }
                    }
                }
            };

            const chartInstance = new Chart(ctx, config);
            state.currentCharts.push(chartInstance);
        }
    });
}

function renderCorrelationSection() {
    const section = document.getElementById('correlationSection');
    const list = document.getElementById('correlationList');
    list.innerHTML = '';

    if (state.correlations.length > 0) {
        section.style.display = 'block';
        state.correlations.slice(0, 6).forEach(c => {
            const isPos = c.value > 0;
            const badgeClass = isPos ? 'corr-positive' : 'corr-negative';
            const sign = isPos ? '+' : '';

            const div = document.createElement('div');
            div.className = 'correlation-item';
            div.innerHTML = `
                <div class="corr-variables">
                    <span class="corr-var" title="${c.col1}">🔗 ${c.col1}</span>
                    <span class="corr-var" title="${c.col2}">🔗 ${c.col2}</span>
                </div>
                <div class="corr-val-badge ${badgeClass}">${sign}${c.value}</div>
            `;
            list.appendChild(div);
        });
    } else {
        section.style.display = 'none';
    }
}

// PRESENTATION LAYER - RAW DATA VIEW
function renderModalTable() {
    const head = document.getElementById('previewTableHead');
    const body = document.getElementById('previewTableBody');

    head.innerHTML = '';
    body.innerHTML = '';

    if (state.headers.length === 0 || state.filteredRows.length === 0) {
        body.innerHTML = '<tr><td colspan="100" style="text-align:center;">No data matching your search criteria.</td></tr>';
        return;
    }

    // Render Headers
    state.headers.forEach(h => {
        const th = document.createElement('th');
        th.textContent = h;
        head.appendChild(th);
    });

    // Pagination slice
    const startIdx = (state.tablePage - 1) * state.tableRowsPerPage;
    const endIdx = startIdx + state.tableRowsPerPage;
    const pageRows = state.filteredRows.slice(startIdx, endIdx);

    // Render rows
    pageRows.forEach(row => {
        const tr = document.createElement('tr');
        state.headers.forEach(h => {
            const td = document.createElement('td');
            const val = row[h];
            td.textContent = val === null || val === undefined ? 'null' : String(val);
            td.title = td.textContent;
            tr.appendChild(td);
        });
        body.appendChild(tr);
    });

    // Pagination info
    const totalPages = Math.ceil(state.filteredRows.length / state.tableRowsPerPage);
    document.getElementById('pageIndicator').textContent = `Page ${state.tablePage} of ${totalPages || 1}`;
    document.getElementById('tableInfoText').textContent = `Showing ${startIdx + 1}-${Math.min(endIdx, state.filteredRows.length)} of ${state.filteredRows.length} rows`;

    document.getElementById('prevPageBtn').disabled = state.tablePage === 1;
    document.getElementById('nextPageBtn').disabled = state.tablePage >= totalPages;
}

// INTERACTIVE CHAT LAYER
function renderChatSuggestions() {
    const list = document.getElementById('chatSuggestions');
    list.innerHTML = '';

    if (state.report && state.report.questions) {
        state.report.questions.forEach(q => {
            const btn = document.createElement('button');
            btn.className = 'chat-suggestion-btn';
            btn.textContent = q;
            btn.addEventListener('click', () => {
                document.getElementById('chatInput').value = q;
                handleUserChatMessage();
            });
            list.appendChild(btn);
        });
    }
}

async function handleUserChatMessage() {
    const input = document.getElementById('chatInput');
    const text = input.value.trim();
    if (!text) return;

    // Add user message to UI
    appendChatMessage(text, 'user');
    input.value = '';

    const loadingBubble = appendChatMessage("Thinking...", 'assistant loading');

    try {
        const answer = await callLLMChat(text);
        loadingBubble.remove();
        appendChatMessage(answer, 'assistant');
    } catch (err) {
        loadingBubble.remove();
        appendChatMessage(`Sorry, there was an error processing your query. (${err.message})`, 'assistant');
    }
}

function appendChatMessage(text, sender) {
    const container = document.getElementById('chatMessages');
    const div = document.createElement('div');
    div.className = `message ${sender}-msg`;
    div.textContent = text;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    return div;
}

async function callLLMChat(question) {
    const condensedProfile = {
        fileName: state.fileName,
        totalRows: state.rawRows.length,
        columns: Object.keys(state.columnMetadata).map(col => ({
            name: col,
            type: state.columnMetadata[col].type,
            nullPercent: state.columnMetadata[col].nullPercentage,
            mean: state.columnMetadata[col].mean,
            uniqueCount: state.columnMetadata[col].uniqueCount,
            minDate: state.columnMetadata[col].minDate,
            maxDate: state.columnMetadata[col].maxDate
        }))
    };

    const rowSample = state.rawRows.slice(0, 5);

    const response = await fetch('chat_prompt.md');
    if (!response.ok) {
        throw new Error(`Failed to load chat_prompt.md (${response.status})`);
    }
    let promptTemplate = await response.text();

    const systemPrompt = promptTemplate
        .replace('{{DATA_PROFILE}}', JSON.stringify(condensedProfile, null, 2))
        .replace('{{ROW_SAMPLE}}', JSON.stringify(rowSample, null, 2));

    const answer = await sendLLMRequest(state.llmProvider, state.llmModel, state.llmKey, systemPrompt, question, false);
    return answer.trim();
}

// UTILITIES
function formatFileSize(bytes) {
    if (bytes === 0 || isNaN(bytes)) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatNumberCompact(num) {
    if (Math.abs(num) >= 1e6) {
        return (num / 1e6).toFixed(1) + 'M';
    }
    if (Math.abs(num) >= 1e3) {
        return (num / 1e3).toFixed(1) + 'K';
    }
    return Number(num.toFixed(2)).toString();
}

function shuffleAndSample(arr, sampleSize) {
    if (arr.length <= sampleSize) return [...arr];
    const result = new Array(sampleSize);
    const len = arr.length;
    const taken = new Array(len);
    let count = 0;
    while (count < sampleSize) {
        const rand = Math.floor(Math.random() * len);
        if (!taken[rand]) {
            result[count] = arr[rand];
            taken[rand] = true;
            count++;
        }
    }
    return result;
}

function showToast(msg, type = 'info') {
    const toast = document.createElement('div');
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.left = '20px';
    toast.style.background = type === 'danger' ? 'var(--danger)' : type === 'warning' ? 'var(--warning)' : 'var(--primary)';
    toast.style.color = '#fff';
    toast.style.padding = '12px 20px';
    toast.style.borderRadius = '8px';
    toast.style.boxShadow = 'var(--shadow-lg)';
    toast.style.zIndex = '9999';
    toast.style.fontSize = '13px';
    toast.style.fontWeight = '500';
    toast.style.transition = 'opacity 0.3s ease';
    toast.textContent = msg;

    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

function resetApp() {
    state.fileName = '';
    state.fileSize = '';
    state.rawRows = [];
    state.headers = [];
    state.activeRows = [];
    state.columnMetadata = {};
    state.correlations = [];
    state.activeSheet = '';
    state.sheets = [];
    state.report = null;
    state.tablePage = 1;
    state.filteredRows = [];
    state.chatHistory = [];

    // Clear charts
    state.currentCharts.forEach(c => c.destroy());
    state.currentCharts = [];

    // Reset Inputs
    document.getElementById('fileInput').value = '';
    document.getElementById('sheetSelect').innerHTML = '';
    document.getElementById('sheetSelectorContainer').style.display = 'none';

    // Show upload screen
    document.getElementById('dashboardScreen').style.display = 'none';
    document.getElementById('uploadScreen').style.display = 'flex';
    document.getElementById('resetBtn').style.display = 'none';
}