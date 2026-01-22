// ================= CONFIGURATION =================
// 1. Tes liens (Ceux de ton projet)
const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS7lTNMQNNmgQrlsBbtD0lsq4emQqNVoeVUxpgG2WFLOgopD_z6u5fQ6S31krFBuTqiwFfUX6nU6O7g/pub?gid=0&single=true&output=csv'; 
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyt2vbix3M94n_thVPXzmYdFirabX0HO7BKNvkE6LDUm6CQVGQKzLuZQ6bgkQS28sc6eQ/exec'; 

// 2. Tes numéros intégrés
const WHATSAPP_PHONE = '261340494520';    // Format international sans +
const RESTAURANT_PHONE_SMS = '0340494520'; // Numéro local pour le SMS de secours

let menuData = [];
let cart = [];

// ================= CHARGEMENT =================
document.addEventListener('DOMContentLoaded', () => {
    fetch(CSV_URL)
        .then(response => response.text())
        .then(csvText => {
            menuData = parseCSV(csvText);
            renderMenu();
        })
        .catch(err => {
            console.error("Erreur chargement menu:", err);
            document.getElementById('menu-container').innerHTML = '<p style="color:red;text-align:center;margin-top:20px;">Erreur de connexion.<br>Veuillez rafraîchir la page.</p>';
        });

    const toast = document.createElement('div');
    toast.id = 'toast';
    document.body.appendChild(toast);
});

// ================= PARSEUR CSV (Robuste) =================
function parseCSV(str) {
    const lines = str.split('\n').filter(l => l.trim() !== '');
    if (lines.length < 2) return [];
    
    const headers = lines[0].split(',').map(h => h.trim());
    
    return lines.slice(1).map(line => {
        // Découpe en respectant les virgules DANS les guillemets
        const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
        
        const cleanValues = values.map(val => {
            return val ? val.trim().replace(/^"|"$/g, '').replace(/""/g, '"') : '';
        });
        
        let obj = {};
        headers.forEach((h, i) => obj[h] = cleanValues[i] || '');
        return obj;
    });
}

// ================= RENDU DU MENU =================
function renderMenu() {
    const container = document.getElementById('menu-container');
    container.innerHTML = '';
    
    // Récupère les catégories uniques
    const categories = [...new Set(menuData.map(i => i.Categorie))].filter(c => c);
    
    if (categories.length === 0) {
        container.innerHTML = '<p style="text-align:center">Menu en cours de chargement...</p>';
        return;
    }

    categories.forEach(cat => {
        let html = `<h2 class="category-title">${cat}</h2>`;
        const catItems = menuData.filter(i => i.Categorie === cat);
        
        catItems.forEach(item => {
            const qty = getQtyInCart(item.Nom);
            const imgTag = item.ImageURL ? `<img src="${item.ImageURL}" class="item-img" alt="${item.Nom}" loading="lazy">` : '';
            // Sécurisation des noms avec apostrophes pour le onclick
            const safeName = item.Nom.replace(/'/g, "\\'");

            // On nettoie la valeur de la colonne Dispo (enlève espaces et met en majuscule)
const dispo = (item.Dispo || 'OUI').trim().toUpperCase();
const isAvailable = dispo !== 'NON'; // Si c'est "NON", c'est faux.

let controlsHtml = '';

if (!isAvailable) {
    // CAS 1 : RUPTURE DE STOCK
    controlsHtml = `<button class="add-btn disabled" disabled style="background:#ccc; cursor:not-allowed;">Épuisé</button>`;
} else if (qty > 0) {
    // CAS 2 : DÉJÀ AU PANIER
    controlsHtml = `
    <div class="item-controls">
        <button onclick="updateQty('${safeName}', -1)">-</button>
        <span class="item-qty">${qty}</span>
        <button onclick="updateQty('${safeName}', 1)">+</button>
    </div>`;
} else {
    // CAS 3 : DISPONIBLE (Affichage normal)
    controlsHtml = `<button class="add-btn" onclick="updateQty('${safeName}', 1)">+</button>`;
}

// Optionnel : Griser toute la carte si épuisé
const cardClass = isAvailable ? "menu-item" : "menu-item exhausted";


            html += `
            <div class="menu-item">
                ${imgTag}
                <div class="item-info">
                    <h3>${item.Nom}</h3>
                    <p class="item-desc">${item.Description || ''}</p>
                    <span class="item-price">${item.Prix} Ar</span>
                </div>
                <div class="action-area">
                    ${controlsHtml}
                </div>
            </div>`;
        });
        
        container.innerHTML += html;
    });
}

// ================= FONCTIONS PANIER =================
function getQtyInCart(name) {
    const item = cart.find(i => i.name === name);
    return item ? item.qty : 0;
}

function updateQty(name, change) {
    const itemData = menuData.find(i => i.Nom === name);
    const existing = cart.find(i => i.name === name);

    if (existing) {
        existing.qty += change;
        if (existing.qty <= 0) {
            cart = cart.filter(i => i.name !== name);
        }
    } else if (change > 0) {
        cart.push({ name: name, price: parseFloat(itemData.Prix), qty: 1 });
        showToast(`${name} ajouté`);
    }
    
    updateCartUI();
    renderMenu();
}

function showToast(message) {
    const x = document.getElementById("toast");
    if(x) {
        x.innerText = message;
        x.className = "show";
        setTimeout(function(){ x.className = x.className.replace("show", ""); }, 3000);
    }
}

function updateCartUI() {
    const count = cart.reduce((acc, item) => acc + item.qty, 0);
    const total = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
    
    document.getElementById('cart-count').innerText = count;
    document.getElementById('cart-total').innerText = total.toLocaleString('fr-FR') + ' Ar';
    
    const cartList = document.getElementById('cart-items');
    if(cart.length === 0) {
        cartList.innerHTML = '<p class="empty-msg">Votre panier est vide.</p>';
    } else {
        cartList.innerHTML = cart.map(item => `
            <div class="cart-item">
                <span>${item.qty}x ${item.name}</span>
                <div class="qty-controls">
                    <button onclick="updateQty('${item.name.replace(/'/g, "\\'")}', -1)">-</button>
                    <button onclick="updateQty('${item.name.replace(/'/g, "\\'")}', 1)">+</button>
                </div>
                <span>${(item.price * item.qty).toLocaleString('fr-FR')} Ar</span>
            </div>
        `).join('');
    }
}

function toggleCart() {
    const modal = document.getElementById('cart-modal');
    // Si on ouvre le panier alors qu'il y a un message de succès, on reload la page
    if (modal.style.display === 'flex' && document.querySelector('.success-modal')) {
        location.reload(); 
    }
    modal.style.display = modal.style.display === 'flex' ? 'none' : 'flex';
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

// ================= ENVOI HYBRIDE (INTERNET + SMS SECOURS) =================

function sendOrderAppsScript() {
    const data = getOrderData();
    if(!data) return;
    
    const btn = document.querySelector('.btn-order');
    const originalText = btn.innerText;
    
    // Feedback visuel
    btn.innerText = 'Envoi en cours...';
    btn.disabled = true;

    // 1. Essai Internet
    fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors', 
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(data)
    }).then(() => {
        // SUCCÈS INTERNET
        showSuccessModal(data);
        
    }).catch(err => {
        // ÉCHEC INTERNET -> PLAN B : SMS
        console.warn("Erreur internet, passage SMS", err);
        
        if(confirm("La connexion Internet est instable.\nEnvoyer la commande par SMS ?")) {
            sendViaSMSBackup(data);
            showSuccessModal(data, true); // true = c'est un SMS
        } else {
            // Annulation
            btn.innerText = originalText;
            btn.disabled = false;
        }
    });
}

// Fonction de secours SMS
function sendViaSMSBackup(data) {
    let smsBody = `CMD ${data.orderId}\n`;
    smsBody += `Table: ${data.table} - ${data.client}\n`;
    data.cart.forEach(item => {
        smsBody += `${item.qty}x ${item.name}\n`;
    });
    smsBody += `TOTAL: ${data.total}`;
    if(data.note) smsBody += `\nNote: ${data.note}`;

    const encodedBody = encodeURIComponent(smsBody);
    
    // Détection iPhone vs Android pour le séparateur
    const ua = navigator.userAgent.toLowerCase();
    const separator = (ua.indexOf("iphone") > -1 || ua.indexOf("ipad") > -1) ? '&' : '?';
    
    const smsUrl = `sms:${RESTAURANT_PHONE_SMS}${separator}body=${encodedBody}`;
    window.open(smsUrl, '_self');
}

function showSuccessModal(data, isSMS = false) {
    cart = [];
    updateCartUI();
    renderMenu(); 
    
    const msg = isSMS ? 
        "L'application SMS s'est ouverte. Envoyez le message pour valider !" : 
        "La cuisine a reçu votre commande !";
    
    const modalContent = document.querySelector('.modal-content');
    modalContent.innerHTML = `
        <div class="success-modal">
            <i class="fas fa-check-circle success-icon"></i>
            <h2>Commande Validée !</h2>
            <p>${msg}</p>
            <p>Numéro : <strong>${data.orderId}</strong></p>
            <p>Merci ${data.client}.</p>
            <button class="btn-order" onclick="location.reload()">Nouvelle commande</button>
        </div>
    `;
}

function sendOrderWhatsApp() {
    const data = getOrderData();
    if(!data) return;

    let text = `*Nouvelle Commande ${data.orderId}*\n`;
    text += `👤 ${data.client} - Table ${data.table}\n----------------\n`;
    data.cart.forEach(item => {
        text += `${item.qty}x ${item.name} (${item.price * item.qty} Ar)\n`;
    });
    text += `----------------\n*TOTAL: ${data.total}*\n`;
    if(data.note) text += `📝 Note: ${data.note}`;

    const url = `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
}
