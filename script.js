const products = [
  {
    id: "vase-sable",
    name: "Vase Sable",
    description: "Grès fait main · 24 cm",
    category: "Déco",
    price: 42,
    tag: "FAIT À LA MAIN",
    image: "https://images.unsplash.com/photo-1578500494198-246f612d3b3d?auto=format&fit=crop&w=800&q=80",
    alt: "Vase en céramique artisanale aux tons naturels",
  },
  {
    id: "carafe-ambre",
    name: "Carafe Ambre",
    description: "Verre soufflé · 1 L",
    category: "Art de la table",
    price: 36,
    tag: "COUP DE CŒUR",
    image: "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?auto=format&fit=crop&w=800&q=80",
    alt: "Carafe en verre ambré sur une table",
  },
  {
    id: "coussin-lin",
    name: "Coussin Lino",
    description: "Lin lavé · 45 × 45 cm",
    category: "Textile",
    price: 49,
    tag: "LIN NATUREL",
    image: "https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?auto=format&fit=crop&w=800&q=80",
    alt: "Coussin en lin naturel dans un intérieur lumineux",
  },
  {
    id: "bol-terre",
    name: "Bol Terre",
    description: "Céramique · fabriqué au Portugal",
    category: "Art de la table",
    price: 24,
    tag: "",
    image: "https://images.unsplash.com/photo-1493106641515-6b5631de4bb9?auto=format&fit=crop&w=800&q=80",
    alt: "Bol en céramique aux couleurs terreuses",
  },
  {
    id: "lampe-nuage",
    name: "Lampe Nuage",
    description: "Papier & bois · 38 cm",
    category: "Déco",
    price: 89,
    tag: "PETITE SÉRIE",
    image: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=800&q=80",
    alt: "Lampe de table au design sculptural",
  },
  {
    id: "plaid-douceur",
    name: "Plaid Douceur",
    description: "Coton recyclé · 130 × 170 cm",
    category: "Textile",
    price: 76,
    tag: "",
    image: "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=800&q=80",
    alt: "Plaid doux posé sur un canapé",
  },
  {
    id: "assiette-aube",
    name: "Assiette Aube",
    description: "Grès émaillé · pièce unique",
    category: "Art de la table",
    price: 29,
    tag: "FAIT À LA MAIN",
    image: "https://images.unsplash.com/photo-1490312278390-ab64016e0aa9?auto=format&fit=crop&w=800&q=80",
    alt: "Assiette artisanale en grès émaillé",
  },
  {
    id: "bougeoir-olive",
    name: "Bougeoir Olive",
    description: "Céramique · fabriqué en France",
    category: "Déco",
    price: 32,
    tag: "",
    image: "https://images.unsplash.com/photo-1603006905003-be475563bc59?auto=format&fit=crop&w=800&q=80",
    alt: "Bougie et objet décoratif dans une ambiance chaleureuse",
  },
];

const productGrid = document.querySelector("#product-grid");
const filterButtons = document.querySelectorAll(".filter-button");
const cartDrawer = document.querySelector("#cart-drawer");
const overlay = document.querySelector(".overlay");
const cartItems = document.querySelector(".cart-items");
const cartCount = document.querySelector(".cart-count");
const drawerCount = document.querySelector(".drawer-count");
const cartEmpty = document.querySelector(".cart-empty");
const cartSummary = document.querySelector(".cart-summary");
const toast = document.querySelector(".toast");
const currency = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const productById = new Map(products.map((product) => [product.id, product]));
let activeFilter = "Tout";
let toastTimeout;

function loadCart() {
  try {
    const storedCart = JSON.parse(localStorage.getItem("maison-solaire-cart") || "{}");
    if (!storedCart || typeof storedCart !== "object" || Array.isArray(storedCart)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(storedCart)
        .filter(([id, quantity]) => productById.has(id) && Number.isInteger(quantity) && quantity > 0)
        .map(([id, quantity]) => [id, quantity]),
    );
  } catch (error) {
    console.error("Impossible de récupérer le panier enregistré.", error);
    return {};
  }
}

let cart = loadCart();

function saveCart() {
  try {
    localStorage.setItem("maison-solaire-cart", JSON.stringify(cart));
  } catch (error) {
    console.error("Impossible d'enregistrer le panier.", error);
    showToast("Le panier ne peut pas être enregistré sur cet appareil.");
  }
}

function renderProducts() {
  const visibleProducts = products.filter((product) =>
    activeFilter === "Tout" || product.category === activeFilter,
  );

  productGrid.innerHTML = visibleProducts.map((product) => `
    <article class="product-card">
      <div class="product-image-wrap">
        <img class="product-image" src="${product.image}" alt="${product.alt}" loading="lazy">
        ${product.tag ? `<span class="product-tag">${product.tag}</span>` : ""}
        <button class="quick-add" type="button" data-add="${product.id}" aria-label="Ajouter ${product.name} au panier">+</button>
      </div>
      <div class="product-info">
        <div><h3>${product.name}</h3><p>${product.description}</p></div>
        <span class="product-price">${currency.format(product.price)}</span>
      </div>
    </article>
  `).join("");

  document.querySelector(".product-total").textContent =
    `${visibleProducts.length} ${visibleProducts.length > 1 ? "objets" : "objet"}`;
}

function renderCart() {
  const entries = Object.entries(cart).filter(([id, quantity]) => productById.has(id) && quantity > 0);
  const itemCount = entries.reduce((total, [, quantity]) => total + quantity, 0);
  const subtotal = entries.reduce((total, [id, quantity]) => total + productById.get(id).price * quantity, 0);

  cartCount.textContent = String(itemCount);
  drawerCount.textContent = `(${itemCount})`;
  cartEmpty.hidden = itemCount > 0;
  cartSummary.hidden = itemCount === 0;

  cartItems.innerHTML = entries.map(([id, quantity]) => {
    const product = productById.get(id);
    return `
      <article class="cart-row">
        <img src="${product.image}" alt="${product.alt}">
        <div>
          <h3 class="cart-product-name">${product.name}</h3>
          <p class="cart-product-price">${currency.format(product.price)}</p>
          <div class="quantity-control" aria-label="Quantité de ${product.name}">
            <button type="button" data-change="${id}" data-delta="-1" aria-label="Diminuer la quantité">−</button>
            <span>${quantity}</span>
            <button type="button" data-change="${id}" data-delta="1" aria-label="Augmenter la quantité">+</button>
          </div>
        </div>
        <button class="remove-item" type="button" data-remove="${id}" aria-label="Retirer ${product.name} du panier">Retirer</button>
      </article>
    `;
  }).join("");

  document.querySelector(".subtotal strong").textContent = currency.format(subtotal);
  const remainingForShipping = Math.max(0, 80 - subtotal);
  document.querySelector(".shipping-note").textContent = remainingForShipping === 0
    ? "Bonne nouvelle : la livraison est offerte pour cette commande."
    : `Plus que ${currency.format(remainingForShipping)} pour profiter de la livraison offerte.`;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(toastTimeout);
  toastTimeout = window.setTimeout(() => toast.classList.remove("is-visible"), 2600);
}

function openCart() {
  cartDrawer.classList.add("is-open");
  cartDrawer.setAttribute("aria-hidden", "false");
  overlay.classList.add("is-visible");
  document.body.classList.add("drawer-open");
  cartDrawer.querySelector(".drawer-close").focus();
}

function closeCart() {
  cartDrawer.classList.remove("is-open");
  cartDrawer.setAttribute("aria-hidden", "true");
  overlay.classList.remove("is-visible");
  document.body.classList.remove("drawer-open");
  document.querySelector(".cart-trigger").focus();
}

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    filterButtons.forEach((filterButton) => {
      const isActive = filterButton === button;
      filterButton.classList.toggle("is-active", isActive);
      filterButton.setAttribute("aria-pressed", String(isActive));
    });
    renderProducts();
  });
});

productGrid.addEventListener("click", (event) => {
  const addButton = event.target.closest("[data-add]");
  if (!addButton) return;

  const id = addButton.dataset.add;
  cart[id] = (cart[id] || 0) + 1;
  saveCart();
  renderCart();
  showToast(`${productById.get(id).name} ajouté au panier`);
});

cartItems.addEventListener("click", (event) => {
  const changeButton = event.target.closest("[data-change]");
  const removeButton = event.target.closest("[data-remove]");

  if (changeButton) {
    const id = changeButton.dataset.change;
    cart[id] = (cart[id] || 0) + Number(changeButton.dataset.delta);
    if (cart[id] <= 0) delete cart[id];
  } else if (removeButton) {
    delete cart[removeButton.dataset.remove];
  } else {
    return;
  }

  saveCart();
  renderCart();
});

document.querySelector(".cart-trigger").addEventListener("click", openCart);
document.querySelector(".drawer-close").addEventListener("click", closeCart);
document.querySelector(".continue-shopping").addEventListener("click", closeCart);
overlay.addEventListener("click", closeCart);
document.querySelector(".checkout-button").addEventListener("click", () => {
  showToast("Le paiement en ligne n'est pas encore configuré sur cette boutique.");
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && cartDrawer.classList.contains("is-open")) closeCart();
});

const menuToggle = document.querySelector(".menu-toggle");
const navigation = document.querySelector("#navigation");
menuToggle.addEventListener("click", () => {
  const isOpen = menuToggle.getAttribute("aria-expanded") === "true";
  menuToggle.setAttribute("aria-expanded", String(!isOpen));
  menuToggle.setAttribute("aria-label", isOpen ? "Ouvrir le menu" : "Fermer le menu");
  navigation.classList.toggle("is-open", !isOpen);
});
navigation.addEventListener("click", (event) => {
  if (event.target.closest("a")) {
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-label", "Ouvrir le menu");
    navigation.classList.remove("is-open");
  }
});

document.querySelector("#year").textContent = new Date().getFullYear();
renderProducts();
renderCart();
