// Global State
let state = {
    connected: false,
    currentDevice: null,
    autoRefresh: false,
    refreshInterval: null,
    lastScreenX: 0,
    lastScreenY: 0
};

// DOM Elements
const deviceSelect = document.getElementById('deviceSelect');
const connectBtn = document.getElementById('connectBtn');
const refreshBtn = document.getElementById('refreshBtn');
const statusBox = document.getElementById('status');
const screenshotBtn = document.getElementById('screenshotBtn');
const autoRefreshBtn = document.getElementById('autoRefreshBtn');
const screenImage = document.getElementById('screenImage');
const coordinatesDisplay = document.getElementById('coordinates');
const textInput = document.getElementById('textInput');
const typeBtn = document.getElementById('typeBtn');

// Event Listeners
connectBtn.addEventListener('click', connectDevice);
refreshBtn.addEventListener('click', loadDevices);
screenshotBtn.addEventListener('click', takeScreenshot);
autoRefreshBtn.addEventListener('click', toggleAutoRefresh);
typeBtn.addEventListener('click', sendText);
textInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendText();
});

// Key buttons
document.querySelectorAll('.key-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const key = btn.dataset.key;
        pressKey(key);
    });
});

// Screen image interaction
screenImage.addEventListener('mousemove', (e) => {
    if (!screenImage.src) return;
    
    const rect = screenImage.getBoundingClientRect();
    const x = Math.round((e.clientX - rect.left) * screenImage.naturalWidth / rect.width);
    const y = Math.round((e.clientY - rect.top) * screenImage.naturalHeight / rect.height);
    
    coordinatesDisplay.textContent = `X: ${x}, Y: ${y}`;
    state.lastScreenX = x;
    state.lastScreenY = y;
});

screenImage.addEventListener('click', () => {
    if (!state.connected) {
        showNotification('Подключитесь к устройству!', 'error');
        return;
    }
    tap(state.lastScreenX, state.lastScreenY);
});

// API Functions
async function apiCall(endpoint, method = 'GET', data = null) {
    try {
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json'
            }
        };
        
        if (data) {
            options.body = JSON.stringify(data);
        }
        
        const response = await fetch(`/api${endpoint}`, options);
        
        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        showNotification(`Ошибка: ${error.message}`, 'error');
        return null;
    }
}

async function loadDevices() {
    const result = await apiCall('/devices');
    if (!result) return;
    
    deviceSelect.innerHTML = '<option value="">Выберите устройство...</option>';
    result.devices.forEach(device => {
        const option = document.createElement('option');
        option.value = device;
        option.textContent = device;
        deviceSelect.appendChild(option);
    });
    
    if (result.current) {
        deviceSelect.value = result.current;
    }
    
    showNotification(`Найдено устройств: ${result.devices.length}`, 'success');
}

async function connectDevice() {
    const deviceId = deviceSelect.value;
    
    if (!deviceId) {
        showNotification('Выберите устройство!', 'warning');
        return;
    }
    
    const result = await apiCall('/connect', 'POST', { device_id: deviceId });
    if (!result) return;
    
    if (result.success) {
        state.connected = true;
        state.currentDevice = deviceId;
        updateStatus();
        showNotification(`Подключено к ${deviceId}`, 'success');
        
        // Auto-take screenshot
        setTimeout(takeScreenshot, 500);
    } else {
        showNotification('Ошибка подключения!', 'error');
    }
}

async function takeScreenshot() {
    if (!state.connected) {
        showNotification('Подключитесь к устройству!', 'error');
        return;
    }
    
    screenshotBtn.disabled = true;
    screenshotBtn.textContent = '⏳ Загрузка...';
    
    const result = await apiCall('/screenshot');
    
    screenshotBtn.disabled = false;
    screenshotBtn.textContent = '📷 Скриншот';
    
    if (result && result.success) {
        screenImage.src = result.image;
        screenImage.style.display = 'block';
    } else {
        showNotification('Ошибка получения скриншота!', 'error');
    }
}

async function tap(x, y) {
    const result = await apiCall('/tap', 'POST', { x, y });
    if (result && result.success) {
        showNotification(`Нажато на (${x}, ${y})`, 'info');
        setTimeout(takeScreenshot, 200);
    }
}

async function swipe(x1, y1, x2, y2) {
    const result = await apiCall('/swipe', 'POST', { x1, y1, x2, y2 });
    if (result && result.success) {
        showNotification('Свайп выполнен', 'success');
    }
}

async function sendText() {
    const text = textInput.value.trim();
    
    if (!text) {
        showNotification('Введите текст!', 'warning');
        return;
    }
    
    if (!state.connected) {
        showNotification('Подключитесь к устройству!', 'error');
        return;
    }
    
    const result = await apiCall('/type', 'POST', { text });
    if (result && result.success) {
        showNotification('Текст отправлен', 'success');
        textInput.value = '';
    }
}

async function pressKey(key) {
    if (!state.connected) {
        showNotification('Подключитесь к устройству!', 'error');
        return;
    }
    
    const result = await apiCall('/key', 'POST', { key });
    if (result && result.success) {
        showNotification(`Нажата клавиша: ${key}`, 'info');
        setTimeout(takeScreenshot, 300);
    }
}

async function updateStatus() {
    const result = await apiCall('/status');
    if (!result) return;
    
    if (result.connected) {
        statusBox.classList.add('connected');
        statusBox.innerHTML = `
            <p>🟢 Подключено</p>
            <p style="font-size: 0.85em; margin-top: 5px;">Устройство: ${result.device_id}</p>
        `;
    } else {
        statusBox.classList.remove('connected');
        statusBox.innerHTML = '<p>🔴 Отключено</p>';
    }
}

function toggleAutoRefresh() {
    state.autoRefresh = !state.autoRefresh;
    autoRefreshBtn.classList.toggle('active');
    
    if (state.autoRefresh) {
        autoRefreshBtn.textContent = '⏸️ Авто-обновление';
        state.refreshInterval = setInterval(() => {
            if (state.connected) {
                takeScreenshot();
            }
        }, 1000);
        showNotification('Авто-обновление включено (1 сек)', 'success');
    } else {
        autoRefreshBtn.textContent = '▶️ Авто-обновление';
        clearInterval(state.refreshInterval);
        showNotification('Авто-обновление отключено', 'info');
    }
}

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        background: ${getNotificationColor(type)};
        color: white;
        border-radius: 5px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 1000;
        animation: slideIn 0.3s ease;
        font-weight: 500;
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function getNotificationColor(type) {
    const colors = {
        'success': '#4CAF50',
        'error': '#f44336',
        'warning': '#ff9800',
        'info': '#2196F3'
    };
    return colors[type] || colors['info'];
}

// Add animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Initialize on page load
window.addEventListener('load', () => {
    loadDevices();
    updateStatus();
    setInterval(updateStatus, 5000);
});

console.log('📱 Remote Android Access - v1.0');
console.log('Готово к использованию!');
