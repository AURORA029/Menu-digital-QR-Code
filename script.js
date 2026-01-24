// ================= CONFIGURATION =================
// 1. Tes liens
const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS7lTNMQNNmgQrlsBbtD0lsq4emQqNVoeVUxpgG2WFLOgopD_z6u5fQ6S31krFBuTqiwFfUX6nU6O7g/pub?gid=0&single=true&output=csv'; 
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyt2vbix3M94n_thVPXzmYdFirabX0HO7BKNvkE6LDUm6CQVGQKzLuZQ6bgkQS28sc6eQ/exec'; 

// 2. Tes numéros de contact
const WHATSAPP_PHONE = '261340494520';    
const RESTAURANT_PHONE_SMS = '0340494520'; 

// 3. Tes infos de PAIEMENT (Avec NOMS COMPLETS)
const PAYMENT_INFO = {
    mvola: {
        number: "034 00 000 00",
        name: "RAKOTO Jean (Gastro Pizza)" // Le nom qui s'affiche dans l'app MVola
    },
    orange: {
        number: "032 00 000 00",
        name: "ANDRIA Malala"
    },
    airtel: {
        number: "033 00 000 00",
        name: "Société SAVEUR S.A"
    }
};
AIRTEL
};

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
        const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
        const cleanValues = values.map(val => {
            return val ? val.trim().replace(/^"|"$/g, '').replace(/""/g, '"') : '';
        });
        
        let obj = {};
        headers.forEach((h, i) => obj[h] = cleanValues[i] || '');
        return obj;
    });
}

// ================= MOTEUR DE RECHERCHE =================
function filterMenu() {
    const input = document.getElementById('search-input');
    const filter = input.value.toLowerCase().trim();

    if (filter === "") {
        renderMenu(menuData); 
        return;
    }

    const filteredData = menuData.filter(item => {
        const titleMatch = item.Nom.toLowerCase().includes(filter);
        const descMatch = (item.Description || '').toLowerCase().includes(filter);
        return titleMatch || descMatch;
    });

    renderMenu(filteredData);
}

// ================= RENDU DU MENU =================
function renderMenu(data = menuData) {
    const container = document.getElementById('menu-container');
    const navContainer = document.getElementById('category-nav'); 
    
    container.innerHTML = '';
    if(navContainer) navContainer.innerHTML = ''; 

    if (data.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding: 40px; color:#888;">
                <i class="fas fa-search" style="font-size: 2em; margin-bottom:10px;"></i>
                <p>Oups ! Aucun plat ne correspond à votre recherche.</p>
                <button onclick="document.getElementById('search-input').value=''; filterMenu()" style="margin-top:10px; padding:5px 15px; border:1px solid #ccc; background:white; border-radius:5px;">Tout afficher</button>
            </div>`;
        return;
    }

    const categories = [...new Set(data.map(i => i.Categorie))].filter(c => c);

    if(navContainer && categories.length > 1) { 
        categories.forEach((cat, index) => {
            const btn = document.createElement('button');
            btn.className = 'cat-btn';
            btn.innerText = cat;
            btn.onclick = () => {
                const element = document.getElementById(`cat-${index}`);
                if(element) {
                    const y = element.getBoundingClientRect().top + window.scrollY - 140;
                    window.scrollTo({top: y, behavior: 'smooth'});
                }
            };
            navContainer.appendChild(btn);
        });
    }

    categories.forEach((cat, index) => {
        let html = `<h2 id="cat-${index}" class="category-title">${cat}</h2>`;
        const catItems = data.filter(i => i.Categorie === cat);
        
        catItems.forEach(item => {
            const qty = getQtyInCart(item.Nom);
            const imgTag = item.ImageURL ? `<img src="${item.ImageURL}" class="item-img" alt="${item.Nom}" loading="lazy">` : '';
            const safeName = item.Nom.replace(/'/g, "\\'");

            let badgeHtml = '';
            const rawTag = (item.Tag || '').trim();
            
            if (rawTag.length > 0) {
                const tagUpper = rawTag.toUpperCase();
                let badgeClass = 'badge-default'; 
                let displayIcon = ''; 

                if (tagUpper === 'PROMO') { badgeClass = 'badge-promo'; }
                else if (tagUpper === 'NEW' || tagUpper === 'NOUVEAU') { badgeClass = 'badge-new'; }
                else if (tagUpper === 'VEGE' || tagUpper === 'VEGAN') { badgeClass = 'badge-vege'; displayIcon = '🌿 '; }
                else if (tagUpper === 'TOP' || tagUpper === 'BEST') { badgeClass = 'badge-top'; displayIcon = '★ '; }
                else if (tagUpper === 'HOT' || tagUpper === 'SPICY' || tagUpper === 'SAKAY') { 
                    badgeClass = 'badge-hot'; displayIcon = '🌶️ '; 
                }
                else if (tagUpper === 'FRAIS' || tagUpper === 'FRESH' || tagUpper === 'GLACE') {
                    badgeClass = 'badge-frais'; displayIcon = '❄️ ';
                }

                badgeHtml = `<span class="badge ${badgeClass}">${displayIcon}${rawTag}</span>`;
            }

            const dispo = (item.Dispo || 'OUI').trim().toUpperCase();
            const isAvailable = dispo !== 'NON'; 
            const cardClass = isAvailable ? "menu-item" : "menu-item exhausted";

            let controlsHtml = '';
            if (!isAvailable) {
                controlsHtml = `<button class="add-btn disabled" disabled style="background:#ccc; cursor:not-allowed; border:none; color:#666;">Épuisé</button>`;
            } else if (qty > 0) {
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
            <div class="${cardClass}">
                ${badgeHtml}
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

// ================= FONCTIONS PANIER & UTILS =================
function getQtyInCart(name) {
    const item = cart.find(i => i.name === name);
    return item ? item.qty : 0;
}

function updateQty(name, change) {
    const itemData = menuData.find(i => i.Nom === name);
    
    if(change > 0) {
        const dispo = (itemData.Dispo || 'OUI').trim().toUpperCase();
        if(dispo === 'NON') return; 
    }

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
    
    if(document.getElementById('search-input').value !== "") {
        filterMenu();
    }
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

// ================= NOUVEAU SYSTÈME DE PAIEMENT & ENVOI =================

// 1. Déclencheur : Ouvre la fenêtre de choix
function openPaymentModal() {
    // On vérifie d'abord si les infos sont remplies
    const data = getOrderData();
    if(!data) return; // Si manque nom/table, ça s'arrête ici

    // On cache le panier
    document.getElementById('cart-modal').style.display = 'none';
    
    // On crée le HTML du modal de paiement
    const paymentModal = document.createElement('div');
    paymentModal.id = 'payment-modal';
    paymentModal.className = 'modal';
    paymentModal.style.display = 'flex';
    paymentModal.innerHTML = `
        <div class="modal-content">
            <span class="close-btn" onclick="closePayment()">&times;</span>
            <h2>💳 Paiement</h2>
            <p>Total à payer : <strong>${data.total}</strong></p>
            <p style="font-size:0.9em; color:#666; margin-bottom:20px;">Choisissez votre mode de paiement :</p>
            
            <div class="payment-options">
                <div class="pay-btn mvola" onclick="showPaymentDetails('mvola', '${data.total}')">
                    <span><i class="fas fa-mobile-alt"></i> MVola</span>
                    <i class="fas fa-chevron-right"></i>
                </div>
                
                <div class="pay-btn orange" onclick="showPaymentDetails('orange', '${data.total}')">
                    <span><i class="fas fa-mobile-alt"></i> Orange Money</span>
                    <i class="fas fa-chevron-right"></i>
                </div>

                <div class="pay-btn airtel" onclick="showPaymentDetails('airtel', '${data.total}')">
                    <span><i class="fas fa-mobile-alt"></i> Airtel Money</span>
                    <i class="fas fa-chevron-right"></i>
                </div>

                <div class="pay-btn cash" onclick="finalizeOrder('CASH')">
                    <span><i class="fas fa-money-bill-wave"></i> Espèces / Comptoir</span>
                    <i class="fas fa-check"></i>
                </div>
            </div>

            <div id="payment-details" class="copy-zone"></div>
        </div>
    `;
    document.body.appendChild(paymentModal);
}

// 2. Affiche les détails (Numéro + Boutons)
function showPaymentDetails(operator, total) {
    const number = PAYMENT_NUMBERS[operator];
    const cleanNumber = number.replace(/\s/g, ''); 
    const div = document.getElementById('payment-details');
    
    let color = '#333';
    if(operator === 'mvola') color = '#ffcc00';
    if(operator === 'orange') color = '#ff7900';
    if(operator === 'airtel') color = '#e60000';

    div.style.display = 'block';
    div.style.borderLeft = `5px solid ${color}`;
    div.innerHTML = `
        <p style="margin:0; font-size:0.9em;">Envoyez <strong>${total}</strong> au :</p>
        <span class="big-number">${number}</span>
        
        <div class="action-row">
            <button class="btn-action btn-copy" onclick="copyToClipboard('${cleanNumber}')">
                <i class="fas fa-copy"></i> Copier
            </button>
            <a href="tel:${cleanNumber}" class="btn-action" style="background:${color}; text-decoration:none; display:flex; align-items:center; justify-content:center;">
                <i class="fas fa-phone"></i> Appeler
            </a>
        </div>

        <p style="font-size:0.8em; color:#666; margin-top:10px;">
            1. Copiez le numéro.<br>
            2. Envoyez l'argent via votre appli.<br>
            3. Revenez ici et validez.
        </p>

        <button class="btn-action btn-confirmed" onclick="finalizeOrder('${operator.toUpperCase()}')">
            ✅ J'AI ENVOYÉ L'ARGENT
        </button>
    `;
}

// 3. Utilitaire de copie
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast("Numéro copié !");
    }).catch(err => {
        // Fallback si la copie auto ne marche pas
        prompt("Copiez ce numéro :", text);
    });
}

// 4. Fermeture
function closePayment() {
    const m = document.getElementById('payment-modal');
    if(m) m.remove();
    document.getElementById('cart-modal').style.display = 'flex'; // Rouvre le panier
}

// 5. ENVOI FINAL (C'est ici que ça remplace sendOrderAppsScript)
function finalizeOrder(method) {
    const data = getOrderData();
    if(!data) return;

    // Mise à jour visuelle du bouton pour faire patienter
    const confirmBtn = document.querySelector('.btn-confirmed') || document.querySelector('.pay-btn.cash');
    if(confirmBtn) {
        confirmBtn.innerText = 'Validation en cours...';
        confirmBtn.style.opacity = '0.7';
        confirmBtn.disabled = true;
    }

    // On injecte la méthode de paiement dans la note
    // Ex: "[PAIEMENT: MVOLA] Sans oignons"
    data.note = `[PAIEMENT: ${method}] ` + (data.note || "");

    // Envoi à Google
    fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors', 
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(data)
    }).then(() => {
        // Ferme le modal de paiement
        const m = document.getElementById('payment-modal');
        if(m) m.remove();
        
        // Affiche succès
        showSuccessModal(data);
    }).catch(err => {
        console.warn("Erreur internet, passage SMS", err);
        // Ferme le modal de paiement
        const m = document.getElementById('payment-modal');
        if(m) m.remove();

        if(confirm("La connexion Internet est instable.\nEnvoyer la commande par SMS ?")) {
            sendViaSMSBackup(data);
            showSuccessModal(data, true); 
        } else {
            alert("Erreur d'envoi. Veuillez réessayer.");
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
    
    // On s'assure qu'on écrit dans le bon modal (le panier est toujours là mais caché)
    document.getElementById('cart-modal').style.display = 'flex';
    const modalContent = document.querySelector('#cart-modal .modal-content');
    
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
