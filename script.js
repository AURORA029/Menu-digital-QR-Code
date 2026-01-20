// CONFIGURATION
// Tes liens ont été intégrés ici :
const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS7lTNMQNNmgQrlsBbtD0lsq4emQqNVoeVUxpgG2WFLOgopD_z6u5fQ6S31krFBuTqiwFfUX6nU6O7g/pub?gid=0&single=true&output=csv'; 
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyt2vbix3M94n_thVPXzmYdFirabX0HO7BKNvkE6LDUm6CQVGQKzLuZQ6bgkQS28sc6eQ/exec'; 

// Remplace par ton numéro ou celui du client (format international sans le +)
const WHATSAPP_PHONE = '33612345678'; 

let menuData = [];
let cart = [];

// 1. CHARGEMENT DU MENU
document.addEventListener('DOMContentLoaded', () => {
    fetch(CSV_URL)
        .then(response => response.text())
        .then(csvText => {
            menuData = parseCSV(csvText);
            renderMenu(menuData);
        })
        .catch(err => console.error("Erreur chargement menu:", err));
});

// Parseur CSV simple
function parseCSV(str) {
    const lines = str.split('\n').filter(l => l.trim() !== '');
    const headers = lines[0].split(',').map(h => h.trim());
    
    return lines.slice(1).map(line => {
        const values = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];
        const cleanValues = values.map(val => val.replace(/^"|"$/g, '').trim());
        
        let obj = {};
        headers.forEach((h, i) => obj[h] = cleanValues[i]);
        return obj;
    });
}

// 2. RENDU DU MENU
function renderMenu(items) {
    const container = document.getElementById('menu-container');
    container.innerHTML = '';
    
    const categories = [...new Set(items.map(i => i.Categorie))];
    
    if (categories.length === 0) {
        container.innerHTML = '<p>Aucun article trouvé. Vérifiez le Google Sheet.</p>';
        return;
    }

    categories.forEach(cat => {
        if(!cat) return;
        const catItems = items.filter(i => i.Categorie === cat);
        
        let html = `<h2 class="category-title">${cat}</h2>`;
        
        catItems.forEach(item => {
            html += `
            <div class="menu-item">
                <div class="item-info">
                    <h3>${item.Nom}</h3>
                    <p class="item-desc">${item.Description || ''}</p>
                    <span class="item-price">${item.Prix} €</span>
                </div>
                <button class="add-btn" onclick="addToCart('${item.Nom.replace(/'/g, "\\'")}', ${parseFloat(item.Prix)})">+</button>
            </div>`;
        });
        
        container.innerHTML += html;
    });
}

// 3. GESTION DU PANIER
function addToCart(name, price) {
    const existing = cart.find(i => i.name === name);
    if(existing) {
        existing.qty++;
    } else {
        cart.push({ name, price, qty: 1 });
    }
    updateCartUI();
}

function removeFromCart(name) {
    const idx = cart.findIndex(i => i.name === name);
    if(idx > -1) {
        cart[idx].qty--;
        if(cart[idx].qty === 0) cart.splice(idx, 1);
    }
    updateCartUI();
}

function updateCartUI() {
    const count = cart.reduce((acc, item) => acc + item.qty, 0);
    const total = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
    
    document.getElementById('cart-count').innerText = count;
    document.getElementById('cart-total').innerText = total.toFixed(2) + ' €';
    
    const cartList = document.getElementById('cart-items');
    if(cart.length === 0) {
        cartList.innerHTML = '<p class="empty-msg">Votre panier est vide.</p>';
    } else {
        cartList.innerHTML = cart.map(item => `
            <div class="cart-item">
                <span>${item.name}</span>
                <div class="qty-controls">
                    <button onclick="removeFromCart('${item.name.replace(/'/g, "\\'")}')">-</button>
                    <span>${item.qty}</span>
                    <button onclick="addToCart('${item.name.replace(/'/g, "\\'")}', ${item.price})">+</button>
                </div>
                <span>${(item.price * item.qty).toFixed(2)}€</span>
            </div>
        `).join('');
    }
}

function toggleCart() {
    const modal = document.getElementById('cart-modal');
    modal.style.display = modal.style.display === 'flex' ? 'none' : 'flex';
}

// 4. DATA & ENVOI
function getOrderData() {
    const table = document.getElementById('table-num').value;
    const client = document.getElementById('client-name').value;
    const note = document.getElementById('client-note').value;
    
    if(!table || !client) {
        alert("Merci de remplir le numéro de table et votre nom.");
        return null;
    }

    const orderId = '#CMD-' + Math.floor(Math.random() * 10000);
    const total = document.getElementById('cart-total').innerText;
    let details = cart.map(i => `${i.qty}x ${i.name}`).join(', ');

    return { orderId, table, client, note, total, details, cart };
}

function sendOrderWhatsApp() {
    const data = getOrderData();
    if(!data) return;

    let text = `*Nouvelle Commande ${data.orderId}*\n`;
    text += `👤 ${data.client} - Table ${data.table}\n`;
    text += `----------------\n`;
    data.cart.forEach(item => {
        text += `${item.qty}x ${item.name} (${(item.price * item.qty).toFixed(2)}€)\n`;
    });
    text += `----------------\n`;
    text += `*TOTAL: ${data.total}*\n`;
    if(data.note) text += `📝 Note: ${data.note}`;

    const url = `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
}

function sendOrderAppsScript() {
    const data = getOrderData();
    if(!data) return;
    
    const btn = document.querySelector('.btn-order');
    btn.innerText = 'Envoi en cours...';
    btn.disabled = true;

    // Utilisation de no-cors
    fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors', 
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    }).then(() => {
        alert(`Commande ${data.orderId} envoyée en cuisine !`);
        cart = [];
        updateCartUI();
        toggleCart();
        btn.innerText = 'Envoyer en Cuisine';
        btn.disabled = false;
        
        // Optionnel : vider le formulaire
        document.getElementById('table-num').value = '';
        document.getElementById('client-name').value = '';
        document.getElementById('client-note').value = '';
        
    }).catch(err => {
        console.error(err);
        alert("Erreur technique lors de l'envoi.");
        btn.disabled = false;
    });
}
