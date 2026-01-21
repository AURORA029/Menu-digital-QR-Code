// CONFIGURATION
// Tes liens EXACTS sont ici :
const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS7lTNMQNNmgQrlsBbtD0lsq4emQqNVoeVUxpgG2WFLOgopD_z6u5fQ6S31krFBuTqiwFfUX6nU6O7g/pub?gid=0&single=true&output=csv'; 
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyt2vbix3M94n_thVPXzmYdFirabX0HO7BKNvkE6LDUm6CQVGQKzLuZQ6bgkQS28sc6eQ/exec'; 

// Ton numéro (ou celui du client)
const WHATSAPP_PHONE = '33612345678'; 

let menuData = [];
let cart = [];

// 1. CHARGEMENT
document.addEventListener('DOMContentLoaded', () => {
    fetch(CSV_URL)
        .then(response => response.text())
        .then(csvText => {
            menuData = parseCSV(csvText);
            renderMenu(); // On lance le rendu
        })
        .catch(err => console.error("Erreur chargement menu:", err));

    // Création dynamique du "Toast" (notification) pour ne pas toucher au HTML
    const toast = document.createElement('div');
    toast.id = 'toast';
    document.body.appendChild(toast);
});

// Parseur CSV (Identique à ta version)
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

// 2. RENDU DU MENU (AMÉLIORÉ AVEC COMPTEURS)
function renderMenu() {
    const container = document.getElementById('menu-container');
    container.innerHTML = '';
    
    const categories = [...new Set(menuData.map(i => i.Categorie))];
    
    if (categories.length === 0) {
        container.innerHTML = '<p>Aucun article trouvé.</p>';
        return;
    }

    categories.forEach(cat => {
        if(!cat) return;
        
        let html = `<h2 class="category-title">${cat}</h2>`;
        
        // On filtre les items de cette catégorie
        const catItems = menuData.filter(i => i.Categorie === cat);
        
        catItems.forEach(item => {
            // On vérifie si l'item est déjà dans le panier pour afficher la quantité
            const qty = getQtyInCart(item.Nom);
            const imgTag = item.ImageURL ? `<img src="${item.ImageURL}" class="item-img" alt="${item.Nom}">` : '';

            // LOGIQUE DES BOUTONS :
            // Si quantité > 0, on affiche [- 1 +], sinon juste [+]
            let controlsHtml = '';
            if (qty > 0) {
                controlsHtml = `
                <div class="item-controls">
                    <button onclick="updateQty('${item.Nom.replace(/'/g, "\\'")}', -1)">-</button>
                    <span class="item-qty">${qty}</span>
                    <button onclick="updateQty('${item.Nom.replace(/'/g, "\\'")}', 1)">+</button>
                </div>`;
            } else {
                controlsHtml = `<button class="add-btn" onclick="updateQty('${item.Nom.replace(/'/g, "\\'")}', 1)">+</button>`;
            }

            html += `
            <div class="menu-item">
                ${imgTag}
                <div class="item-info">
                    <h3>${item.Nom}</h3>
                    <p class="item-desc">${item.Description || ''}</p>
                    <span class="item-price">${item.Prix} €</span>
                </div>
                <div class="action-area">
                    ${controlsHtml}
                </div>
            </div>`;
        });
        
        container.innerHTML += html;
    });
}

// Helper pour savoir combien on en a dans le panier
function getQtyInCart(name) {
    const item = cart.find(i => i.name === name);
    return item ? item.qty : 0;
}

// 3. GESTION UNIFIÉE DU PANIER (+ et -)
// Cette fonction remplace "addToCart" et "removeFromCart"
function updateQty(name, change) {
    const itemData = menuData.find(i => i.Nom === name);
    const existing = cart.find(i => i.name === name);

    if (existing) {
        existing.qty += change;
        // Si on descend à 0, on le retire du panier
        if (existing.qty <= 0) {
            cart = cart.filter(i => i.name !== name);
        }
    } else if (change > 0) {
        // Nouvel ajout
        cart.push({ name: name, price: parseFloat(itemData.Prix), qty: 1 });
        showToast(`${name} ajouté au panier`); // Petit message pop-up
    }
    
    updateCartUI();
    renderMenu(); // IMPORTANT : On recharge le menu pour mettre à jour les boutons [+ -] sur les cartes
}

// Affiche le petit message noir temporaire
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
    document.getElementById('cart-total').innerText = total.toFixed(2) + ' €';
    
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
                <span>${(item.price * item.qty).toFixed(2)}€</span>
            </div>
        `).join('');
    }
}

function toggleCart() {
    const modal = document.getElementById('cart-modal');
    // Si on ferme la modale, on vérifie si c'était le message de succès pour recharger la page
    if (modal.style.display === 'flex' && document.querySelector('.success-modal')) {
        location.reload(); 
    }
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
    text += `👤 ${data.client} - Table ${data.table}\n----------------\n`;
    data.cart.forEach(item => {
        text += `${item.qty}x ${item.name} (${(item.price * item.qty).toFixed(2)}€)\n`;
    });
    text += `----------------\n*TOTAL: ${data.total}*\n`;
    if(data.note) text += `📝 Note: ${data.note}`;

    const url = `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
}

// ENVOI VERS GOOGLE SHEETS (Back Office)
function sendOrderAppsScript() {
    const data = getOrderData();
    if(!data) return;
    
    const btn = document.querySelector('.btn-order');
    const originalText = btn.innerText;
    btn.innerText = 'Envoi...';
    btn.disabled = true;

    fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors', 
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(data)
    }).then(() => {
        // SUCCÈS : On vide le panier
        cart = [];
        updateCartUI();
        renderMenu(); // Remet les boutons à zéro sur le menu
        
        // On remplace le contenu de la modale par le message de succès (Pop-up)
        const modalContent = document.querySelector('.modal-content');
        modalContent.innerHTML = `
            <div class="success-modal">
                <i class="fas fa-check-circle success-icon"></i>
                <h2>Commande Envoyée !</h2>
                <p>Numéro : <strong>${data.orderId}</strong></p>
                <p>Merci ${data.client}, ça part en cuisine.</p>
                <button class="btn-order" onclick="location.reload()">Nouvelle commande</button>
            </div>
        `;
        
    }).catch(err => {
        console.error(err);
        alert("Erreur technique lors de l'envoi.");
        btn.innerText = originalText;
        btn.disabled = false;
    });
}
