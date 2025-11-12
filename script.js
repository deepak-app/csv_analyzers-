// Get DOM elements
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const fileInfo = document.getElementById('fileInfo');
const fileName = document.getElementById('fileName');
const fileSize = document.getElementById('fileSize');
const uploadBtn = document.getElementById('uploadBtn');
const message = document.getElementById('message');

let selectedFile = null;

// Click to browse
uploadArea.addEventListener('click', () => {
    fileInput.click();
});

// File selection handler
fileInput.addEventListener('change', (e) => {
    handleFile(e.target.files[0]);
});

// Drag and drop handlers
uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    
    const file = e.dataTransfer.files[0];
    handleFile(file);
});

// Handle file selection
function handleFile(file) {
    if (!file) return;
    
    selectedFile = file;
    
    // Display file info
    fileName.textContent = `File: ${file.name}`;
    fileSize.textContent = `Size: ${formatFileSize(file.size)}`;
    
    fileInfo.classList.add('show');
    uploadBtn.disabled = false;
    
    // Hide any previous messages
    message.classList.remove('show');
}

// Format file size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Upload button handler
uploadBtn.addEventListener('click', async () => {
    if (!selectedFile) return;
    
    uploadBtn.disabled = true;
    uploadBtn.textContent = 'Uploading...';
    
    try {
        // Simulate upload (replace with actual upload logic)
        await simulateUpload();
        
        showMessage('File uploaded successfully!', 'success');
        
        // Reset after success
        setTimeout(() => {
            resetForm();
        }, 2000);
        
    } catch (error) {
        showMessage('Upload failed. Please try again.', 'error');
        uploadBtn.disabled = false;
        uploadBtn.textContent = 'Upload File';
    }
});

// Simulate file upload (replace with actual API call)
function simulateUpload() {
    return new Promise((resolve) => {
        setTimeout(() => {
            console.log('File uploaded:', selectedFile.name);
            resolve();
        }, 1500);
    });
}

// Show message
function showMessage(text, type) {
    message.textContent = text;
    message.className = `message show ${type}`;
}

// Reset form
function resetForm() {
    selectedFile = null;
    fileInput.value = '';
    fileInfo.classList.remove('show');
    uploadBtn.disabled = true;
    uploadBtn.textContent = 'Upload File';
    message.classList.remove('show');
}