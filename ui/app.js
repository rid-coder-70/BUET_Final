const ORDER_SERVICE_URL = 'http://localhost:3001';
const INVENTORY_SERVICE_URL = 'http://localhost:3002';

// Activity log
const activityLog = [];

function addActivity(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    activityLog.unshift({ message, type, timestamp });
    if (activityLog.length > 10) activityLog.pop();
    updateActivityLog();
}

function updateActivityLog() {
    const logElement = document.getElementById('activity-log');
    logElement.innerHTML = activityLog.map(item => `
        <div class="activity-item ${item.type}">
            <div class="timestamp">${item.timestamp}</div>
            <div>${item.message}</div>
        </div>
    `).join('');
}

// Check service health
async function checkHealth() {
    try {
        const orderResponse = await fetch(`${ORDER_SERVICE_URL}/health`);
        const orderHealth = await orderResponse.json();
        document.getElementById('order-status').textContent = '✅';
        document.getElementById('order-health').textContent = orderHealth.status;
    } catch (error) {
        document.getElementById('order-status').textContent = '❌';
        document.getElementById('order-health').textContent = 'Offline';
    }

    try {
        const inventoryResponse = await fetch(`${INVENTORY_SERVICE_URL}/health`);
        const inventoryHealth = await inventoryResponse.json();
        document.getElementById('inventory-status').textContent = '✅';
        document.getElementById('inventory-health').textContent = inventoryHealth.status;
    } catch (error) {
        document.getElementById('inventory-status').textContent = '❌';
        document.getElementById('inventory-health').textContent = 'Offline';
    }

    // Check circuit breaker
    try {
        const cbResponse = await fetch(`${ORDER_SERVICE_URL}/api/resilience/stats`);
        const cbStats = await cbResponse.json();
        const state = cbStats.state;
        document.getElementById('cb-state').textContent = state.toUpperCase();
        if (state === 'closed') {
            document.getElementById('cb-status').textContent = '✅';
        } else if (state === 'open') {
            document.getElementById('cb-status').textContent = '🔴';
        } else {
            document.getElementById('cb-status').textContent = '🟡';
        }
    } catch (error) {
        document.getElementById('cb-status').textContent = '❌';
        document.getElementById('cb-state').textContent = 'Unknown';
    }
}

// Load inventory
async function loadInventory() {
    const gridElement = document.getElementById('inventory-grid');
    gridElement.innerHTML = '<p>Loading...</p>';

    const products = ['PROD-001', 'PROD-002', 'PROD-003', 'PROD-004', 'PROD-005'];
    const productNames = {
        'PROD-001': 'Dell XPS 15',
        'PROD-002': 'Xbox Series X',
        'PROD-003': 'Nintendo Switch',
        'PROD-004': 'Meta Quest 3',
        'PROD-005': 'ASUS ROG Monitor'
    };

    let html = '';
    for (const productId of products) {
        try {
            const response = await fetch(`${INVENTORY_SERVICE_URL}/api/inventory/${productId}`);
            const data = await response.json();
            const stock = data.product.stockQuantity;
            let stockClass = stock > 50 ? '' : stock > 0 ? 'low' : 'out';
            html += `
                <div class="inventory-item">
                    <h3>${productNames[productId]}</h3>
                    <p>Product ID: ${productId}</p>
                    <p class="stock-level ${stockClass}">Stock: ${stock} units</p>
                </div>
            `;
        } catch (error) {
            html += `
                <div class="inventory-item">
                    <h3>${productNames[productId]}</h3>
                    <p class="stock-level out">Error loading</p>
                </div>
            `;
        }
    }
    gridElement.innerHTML = html;
}

// Create order
document.getElementById('order-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const resultBox = document.getElementById('order-result');
    resultBox.className = 'result-box';
    resultBox.innerHTML = 'Creating order...';
    resultBox.style.display = 'block';

    const customerId = document.getElementById('customerId').value;
    const productId = document.getElementById('productId').value;
    const productName = document.getElementById('productId').options[document.getElementById('productId').selectedIndex].text;
    const quantity = parseInt(document.getElementById('quantity').value);
    const useIdempotency = document.getElementById('useIdempotency').checked;

    const orderData = {
        customerId,
        productId,
        productName,
        quantity
    };

    if (useIdempotency) {
        orderData.idempotencyKey = `ORDER-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    try {
        const response = await fetch(`${ORDER_SERVICE_URL}/api/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderData)
        });

        const result = await response.json();
        
        if (response.ok) {
            resultBox.className = 'result-box success';
            resultBox.innerHTML = `
                <h3>✅ ${result.message}</h3>
                <p><strong>Order ID:</strong> ${result.order.id}</p>
                <p><strong>Status:</strong> ${result.order.status}</p>
                <p><strong>Quantity:</strong> ${result.order.quantity}</p>
                ${result.inventoryError ? `<p style="color: var(--warning-color)">⚠️ ${result.inventoryError}</p>` : ''}
            `;
            addActivity(`Order created: ${result.order.id} (${productName} x${quantity})`, 'success');
            setTimeout(loadInventory, 500);
        } else {
            throw new Error(result.error || 'Unknown error');
        }
    } catch (error) {
        resultBox.className = 'result-box error';
        resultBox.innerHTML = `<h3>❌ Error</h3><p>${error.message}</p>`;
        addActivity(`Order failed: ${error.message}`, 'error');
    }
});

// Chaos controls
async function loadChaosStats() {
    try {
        const gremlinResponse = await fetch(`${INVENTORY_SERVICE_URL}/api/gremlin/stats`);
        const gremlinStats = await gremlinResponse.json();
        
        const crashResponse = await fetch(`${INVENTORY_SERVICE_URL}/api/gremlin/crash-stats`);
        const crashStats = await crashResponse.json();

        document.getElementById('gremlin-toggle').checked = gremlinStats.enabled;
        document.getElementById('gremlin-status').textContent = gremlinStats.enabled ? 'Enabled' : 'Disabled';
        
        document.getElementById('crash-toggle').checked = crashStats.enabled;
        document.getElementById('crash-status').textContent = crashStats.enabled ? 'Enabled' : 'Disabled';

        document.getElementById('chaos-stats').textContent = JSON.stringify({
            gremlin: gremlinStats,
            crashSimulator: crashStats
        }, null, 2);
    } catch (error) {
        console.error('Failed to load chaos stats:', error);
    }
}

// Note: Toggle functionality would require backend API endpoints to enable/disable gremlins
document.getElementById('gremlin-toggle').addEventListener('change', (e) => {
    alert('To enable/disable gremlins, update ENABLE_GREMLIN in docker-compose.yml and restart the service');
    e.target.checked = !e.target.checked;
});

document.getElementById('crash-toggle').addEventListener('change', (e) => {
    alert('To enable/disable crash simulation, update ENABLE_CRASH_SIMULATION in docker-compose.yml and restart the service');
    e.target.checked = !e.target.checked;
});

// Initialize
checkHealth();
loadInventory();
loadChaosStats();

// Auto-refresh
setInterval(checkHealth, 10000);
setInterval(loadChaosStats, 15000);

addActivity('Dashboard initialized', 'success');
