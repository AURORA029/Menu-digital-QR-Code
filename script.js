// ================= CONFIGURATION =================
const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS7lTNMQNNmgQrlsBbtD0lsq4emQqNVoeVUxpgG2WFLOgopD_z6u5fQ6S31krFBuTqiwFfUX6nU6O7g/pub?gid=0&single=true&output=csv'; 
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyt2vbix3M94n_thVPXzmYdFirabX0HO7BKNvkE6LDUm6CQVGQKzLuZQ6bgkQS28sc6eQ/exec'; 

// Numéros de téléphone
const WHATSAPP_PHONE = '261340494520'; // METTRE LE VRAI NUMERO WHATSAPP ICI (Sans +)
const RESTAURANT_PHONE_SMS = 0340494520'; // METTRE LE NUMERO DU RESTO POUR LE SECOURS SMS

// ================= VARIABLES =================
let menuData = [];
let cart = [];

// ================= INITIALISATION =================
document.addEventListener('DOMContentLoaded', () => {
    fetch(CSV_URL)
        .then(response => response.text())
        .then(csvText => {
            menuData = parseCSV(csvText);
            renderMenu();
        })
        .catch(err => {
            console.error("Erreur chargement menu:", err);
            // Petit feedback si le chargement échoue totalement
            document.getElementById('menu-container').innerHTML = '<p style="text-align:center;color:red">Erreur de connexion. Veuillez actualiser.</p>';
        });

    const toast = document.createElement('div');
    toast.id = 'toast';
    document.body.appendChild(toast);
});

// ================= FONCTIONS CRITIQUES =================

// Parseur CSV Robuste (Gère les virgules dans les guillemets)
function parseCSV(str) {
    const lines = str.split('\n').filter(l => l.trim() !== '');
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim());
    
    return lines.slice(1).map(line => {
        const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
        const cleanValues = values.map(val => {
            return val ? val.trim().replace(/^"|"$/g, '').replace(/""/g, '"') : '';
        });
        
        let obj = {};
        headers.forEach((h, i) => obj[h] = cleanValues[i] || '');
        return obj;
    });
}

function getOrderData() {
    const table = document.getElementById('table-num').value;
    const client = document.getElementById('client-name').value;
    const note = document.getElementById('client-note').value;
    
    if(!table || !client) {
        alert("⚠️ Merci de remplir le numéro de table et votre nom.");
        return null;
    }

    const orderId = '#CMD-' + Math.floor(Math.random() * 10000);
    const total = document.getElementById('cart-total').innerText;
    let details = cart.map(i => `(${i.qty}) ${i.name}`).join(', ');

    return { orderId, table, client, note, total, details, cart };
}

// ================= ENVOI SÉCURISÉ (INTERNET + SMS) =================

function sendOrderAppsScript() {
    const data = getOrderData();
    if(!data) return;
    
    const btn = document.querySelector('.btn-order');
    const originalText = btn.innerText;
    
    // Feedback visuel
    btn.innerText = 'Tentative envoi...';
    btn.disabled = true;
    btn.style.opacity = '0.7';

    // 1. Essai Internet (Google Sheet)
    fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors', 
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(data)
    })
    .then(() => {
        // SUCCÈS INTERNET
        cart = [];
        updateCartUI();
        renderMenu(); 
        showSuccessModal(data);
    })
    .catch(err => {
        // ÉCHEC INTERNET -> PLAN B : SMS
        console.warn("Échec Internet, bascule SMS");
        
        if(confirm("La connexion Internet est instable.\nEnvoyer la commande par SMS ?")) {
            sendViaSMSBackup(data);
            // On considère que c'est bon si le client a dit OUI au SMS
            cart = [];
            updateCartUI();
            renderMenu();
            showSuccessModal(data, true); // true = mode SMS
        } else {
            // Annulation
            btn.innerText = originalText;
            btn.disabled = false;
            btn.style.opacity = '1';
        }
    });
}

function sendViaSMSBackup(data) {
    let smsBody = `CMD ${data.orderId}\n`;
    smsBody += `Table: ${data.table} - ${data.client}\n`;
    data.cart.forEach(item => {
        smsBody += `${item.qty}x ${item.name}\n`;
    });
    smsBody += `TOTAL: ${data.total}`;
    if(data.note) smsBody += `\nNote: ${data.note}`;

    const encodedBody = encodeURIComponent(smsBody);
    
    // Détection iOS vs Android
    const ua = navigator.userAgent.toLowerCase();
    const separator = (ua.indexOf("iphone") > -1 || ua.indexOf("ipad") > -1) ? '&' : '?';
    
    const smsUrl = `sms:${RESTAURANT_PHONE_SMS}${separator}body=${encodedBody}`;
    window.open(smsUrl, '_self');
}

function sendOrderWhatsApp() {
    const data = getOrderData();
    if(!data) return;
    let text = `*Nouvelle Commande ${data.orderId}*\n👤 ${data.client} - Table ${data.table}\n----------------\n`;
    data.cart.forEach(item => text += `${item.qty}x ${item.name} (${item.price * item.qty} Ar)\n`);
    text += `----------------\n*TOTAL: ${data.total}*\n`;
    if(data.note) text += `📝 Note: ${data.note}`;
    window.open(`https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(text)}`, '_blank');
}

// ================= UI & LOGIQUE PANIER =================

function renderMenu() {
    const container = document.getElementById('menu-container');
    container.innerHTML = '';
    const categories = [...new Set(menuData.map(i => i.Categorie))].filter(c => c); // Filtre les vides
    
    if (categories.length === 0) {
        container.innerHTML = '<p>Aucun article trouvé.</p>';
        return;
    }

    categories.forEach(cat => {
        let html = `<h2 class="category-title">${cat}</h2>`;
        const catItems = menuData.filter(i => i.Categorie === cat);
        
        catItems.forEach(item => {
            const qty = getQtyInCart(item.Nom);
            const imgTag = item.ImageURL ? `<img src="${item.ImageURL}" class="item-img" alt="${item.Nom}" loading="lazy">` : '';
            // Sécurité guillemets
            const safeName = item.Nom.replace(/'/g, "\\'");

            let controlsHtml = '';
            if (qty > 0) {
                controlsHtml = `
                <div class="item-controls">
                    <button onclick="updateQty('${safeName}', -1)">-</button>
                    <span class="item-qty">${qty}</span>
                    <button onclick="updateQty('${safeName}', 1)">+</button>
                </div>`;
            } else {
                controlsHtml = `<button class="add-btn" onclick="updateQty('${safeName}', 1)">+</button>`;
            }

            html += `
            <div class="menu-item">
                ${imgTag}
                <div class="item-info">
                    <h3>${item.Nom}</h3>
                    <p class="item-desc">${item.Description || ''}</p>
                    <span class="item-price">${item.Prix} Ar</span>
                </div>
                <div class="action-area">${controlsHtml}</div>
            </div>`;
        });
        container.innerHTML += html;
    });
}

function getQtyInCart(name) {
    const item = cart.find(i => i.name === name);
    return item ? item.qty : 0;
}

function updateQty(name, change) {
    const itemData = menuData.find(i => i.Nom === name);
    const existing = cart.find(i => i.name === name);

    if (existing) {
        existing.qty += change;
        if (existing.qty <= 0) cart = cart.filter(i => i.name !== name);
    } else if (change > 0) {
        cart.push({ name: name, price: parseFloat(itemData.Prix), qty: 1 });
        showToast(`${name} ajouté`);
    }
    updateCartUI();
    renderMenu();
}

function updateCartUI() {
    const count = cart.reduce((acc, item) => acc + item.qty, 0);
    const total = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
    
    document.getElementById('cart-count').innerText = count;
    document.getElementById('cart-total').innerText = total + ' Ar';
    
    const cartList = document.getElementById('cart-items');
    if(cart.length === 0) {
        cartList.innerHTML = '<p class="empty-msg">Votre panier est vide.</p>';
    } else {
        cartList.innerHTML = cart.map(item => `
            <div class="cart-item">
                <span>${item.name}</span>
                <div class="qty-controls">
                    <button onclick="updateQty('${item.name.replace(/'/g, "\\'")}', -1)">-</button>
                    <span>${item.qty}</span>
                    <button onclick="updateQty('${item.name.replace(/'/g, "\\'")}', 1)">+</button>
                </div>
                <span>${item.price * item.qty} Ar</span>
            </div>
        `).join('');
    }
}

function toggleCart() {
    const modal = document.getElementById('cart-modal');
    // Si on ouvre le panier alors que le message de succès est affiché, on reload
    if (modal.style.display === 'flex' && document.querySelector('.success-modal')) {
        location.reload(); 
    }
    modal.style.display = modal.style.display === 'flex' ? 'none' : 'flex';
}

function showToast(message) {
    const x = document.getElementById("toast");
    if(x) {
        x.innerText = message;
        x.className = "show";
        setTimeout(() => x.className = x.className.replace("show", ""), 3000);
    }
}

function showSuccessModal(data, isSMS = false) {
    const modalContent = document.querySelector('.modal-content');
    const msg = isSMS ? 
        "L'app SMS s'est ouverte. Envoyez le message pour valider !" : 
        "C'est envoyé en cuisine !";
        
    modalContent.innerHTML = `
        <div class="success-modal">
            <i class="fas fa-check-circle success-icon"></i>
            <h2>Merci ${data.client} !</h2>
            <p>${msg}</p>
            <p style="font-size:0.8em; color:#666">Commande ${data.orderId}</p>
            <button class="btn-order" onclick="location.reload()">Nouvelle commande</button>
        </div>
    `;
}
