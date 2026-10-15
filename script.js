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
const searchInput = document.querySelector("#product-search");
const sortSelect = document.querySelector("#product-sort");
const currency = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const config = window.STORE_SUPABASE_CONFIG;
const supabaseClient = config?.url && config?.publishableKey && window.supabase?.createClient
  ? window.supabase.createClient(config.url, config.publishableKey)
  : null;

let products = [];
let productById = new Map();
let cart = loadCart();
let activeFilter = "Tout";
let toastTimeout;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function loadCart() {
  try {
    const storedCart = JSON.parse(localStorage.getItem("maison-solaire-cart") || "{}");
    if (!storedCart || typeof storedCart !== "object" || Array.isArray(storedCart)) return {};
    return Object.fromEntries(
      Object.entries(storedCart)
        .filter(([id, quantity]) => /^[0-9a-f-]{36}$/i.test(id) && Number.isInteger(quantity) && quantity > 0)
        .map(([id, quantity]) => [id, Math.min(quantity, 20)]),
    );
  } catch (error) {
    console.error("Impossible de récupérer le panier enregistré.", error);
    return {};
  }
}

function saveCart() {
  try {
    localStorage.setItem("maison-solaire-cart", JSON.stringify(cart));
  } catch (error) {
    console.error("Impossible d'enregistrer le panier.", error);
    showToast("Le panier ne peut pas être enregistré sur cet appareil.");
  }
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(toastTimeout);
  toastTimeout = window.setTimeout(() => toast.classList.remove("is-visible"), 3200);
}

function renderProducts() {
  const query = searchInput.value.trim().toLocaleLowerCase("fr");
  const visibleProducts = products
    .filter((product) => product.active)
    .filter((product) => activeFilter === "Tout" || product.category === activeFilter)
    .filter((product) =>
      `${product.name} ${product.description} ${product.category}`.toLocaleLowerCase("fr").includes(query),
    )
    .sort((a, b) => {
      if (sortSelect.value === "price-asc") return Number(a.price) - Number(b.price);
      if (sortSelect.value === "price-desc") return Number(b.price) - Number(a.price);
      if (sortSelect.value === "name") return a.name.localeCompare(b.name, "fr");
      return products.indexOf(a) - products.indexOf(b);
    });

  productGrid.innerHTML = visibleProducts.map((product) => `
    <article class="product-card">
      <div class="product-image-wrap">
        <img class="product-image" src="${escapeHtml(product.image_url)}" alt="${escapeHtml(product.alt)}" loading="lazy">
        ${product.tag ? `<span class="product-tag">${escapeHtml(product.tag)}</span>` : ""}
        <button class="quick-add" type="button" data-add="${escapeHtml(product.id)}" aria-label="Ajouter ${escapeHtml(product.name)} au panier">+</button>
      </div>
      <div class="product-info">
        <div><h3>${escapeHtml(product.name)}</h3><p>${escapeHtml(product.description)}</p></div>
        <span class="product-price">${currency.format(Number(product.price))}</span>
      </div>
    </article>
  `).join("");

  document.querySelector(".product-total").textContent =
    `${visibleProducts.length} ${visibleProducts.length > 1 ? "objets" : "objet"}`;
  document.querySelector(".catalog-message").hidden = visibleProducts.length > 0;
  if (visibleProducts.length === 0) {
    document.querySelector(".catalog-message").textContent = products.length
      ? "Aucun produit ne correspond à ta recherche."
      : "Le catalogue est vide. Ajoute les produits depuis l’espace de gestion.";
  }
}

async function loadProducts() {
  const message = document.querySelector(".catalog-message");
  message.hidden = false;
  message.textContent = "Chargement du catalogue…";
  if (!supabaseClient) {
    message.textContent = "La boutique n’est pas configurée. Vérifie la connexion Supabase.";
    return;
  }

  const { data, error } = await supabaseClient
    .from("products")
    .select("id, name, description, category, price, tag, image_url, alt, active")
    .eq("active", true)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Impossible de charger le catalogue.", error);
    document.querySelector(".product-total").textContent = "";
    productGrid.innerHTML = "";
    message.hidden = false;
    message.textContent = "Le catalogue n’a pas pu être chargé. Vérifie la configuration de la base de données et réessaie.";
    return;
  }

  products = data || [];
  productById = new Map(products.map((product) => [product.id, product]));
  cart = Object.fromEntries(Object.entries(cart).filter(([id]) => productById.has(id)));
  saveCart();
  renderProducts();
  renderCart();
}

function renderCart() {
  const entries = Object.entries(cart).filter(([id, quantity]) => productById.has(id) && quantity > 0);
  const itemCount = entries.reduce((total, [, quantity]) => total + quantity, 0);
  const subtotal = entries.reduce((total, [id, quantity]) => total + Number(productById.get(id).price) * quantity, 0);

  cartCount.textContent = String(itemCount);
  drawerCount.textContent = `(${itemCount})`;
  cartEmpty.hidden = itemCount > 0;
  cartSummary.hidden = itemCount === 0;
  document.querySelector(".checkout-form").hidden = true;
  document.querySelector(".checkout-button").hidden = itemCount === 0;

  cartItems.innerHTML = entries.map(([id, quantity]) => {
    const product = productById.get(id);
    return `
      <article class="cart-row">
        <img src="${escapeHtml(product.image_url)}" alt="${escapeHtml(product.alt)}">
        <div>
          <h3 class="cart-product-name">${escapeHtml(product.name)}</h3>
          <p class="cart-product-price">${currency.format(Number(product.price))}</p>
          <div class="quantity-control" aria-label="Quantité de ${escapeHtml(product.name)}">
            <button type="button" data-change="${escapeHtml(id)}" data-delta="-1" aria-label="Diminuer la quantité">−</button>
            <span>${quantity}</span>
            <button type="button" data-change="${escapeHtml(id)}" data-delta="1" aria-label="Augmenter la quantité">+</button>
          </div>
        </div>
        <button class="remove-item" type="button" data-remove="${escapeHtml(id)}" aria-label="Retirer ${escapeHtml(product.name)} du panier">Retirer</button>
      </article>
    `;
  }).join("");

  document.querySelector(".subtotal strong").textContent = currency.format(subtotal);
  const remainingForShipping = Math.max(0, 80 - subtotal);
  document.querySelector(".shipping-note").textContent = remainingForShipping === 0
    ? "Bonne nouvelle : la livraison est offerte pour cette commande."
    : `Plus que ${currency.format(remainingForShipping)} pour profiter de la livraison offerte.`;
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

function setAdminMessage(element, message, isError = false) {
  element.textContent = message;
  element.classList.toggle("is-error", isError);
}

function renderAdminProducts() {
  const container = document.querySelector(".admin-product-list");
  container.innerHTML = products.map((product) => `
    <article class="admin-product-row">
      <img src="${escapeHtml(product.image_url)}" alt="">
      <div class="admin-product-details">
        <strong>${escapeHtml(product.name)}</strong>
        <span>${currency.format(Number(product.price))} · ${escapeHtml(product.category)}</span>
        <span class="${product.active ? "stock-active" : "stock-inactive"}">${product.active ? "En ligne" : "Masqué"}</span>
      </div>
      <div class="admin-product-actions">
        <button type="button" data-edit-product="${escapeHtml(product.id)}">Modifier</button>
        <button type="button" data-toggle-product="${escapeHtml(product.id)}" data-active="${product.active}">
          ${product.active ? "Masquer" : "Publier"}
        </button>
      </div>
    </article>
  `).join("");
}

async function verifyAdmin(session) {
  if (!session) {
    document.querySelector(".admin-login").hidden = false;
    document.querySelector(".admin-dashboard").hidden = true;
    return false;
  }

  const { data, error } = await supabaseClient
    .from("store_admins")
    .select("user_id")
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (error || !data) {
    await supabaseClient.auth.signOut();
    document.querySelector(".admin-login").hidden = false;
    document.querySelector(".admin-dashboard").hidden = true;
    setAdminMessage(
      document.querySelector(".admin-message"),
      error ? "Impossible de vérifier les droits d’administration." : "Ce compte n’a pas les droits administrateur.",
      true,
    );
    if (error) console.error("Échec de la vérification de l’administrateur.", error);
    return false;
  }

  document.querySelector(".admin-login").hidden = true;
  document.querySelector(".admin-dashboard").hidden = false;
  document.querySelector(".admin-email").textContent = session.user.email || "";
  await Promise.all([loadAdminProducts(), loadOrders()]);
  return true;
}

async function loadAdminProducts() {
  const { data, error } = await supabaseClient
    .from("products")
    .select("id, name, description, category, price, tag, image_url, alt, active, created_at")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Impossible de charger la gestion des produits.", error);
    setAdminMessage(document.querySelector(".product-message"), "Impossible de charger les produits.", true);
    return;
  }

  products = data || [];
  productById = new Map(products.map((product) => [product.id, product]));
  renderProducts();
  renderCart();
  renderAdminProducts();
}

async function loadOrders() {
  const container = document.querySelector(".admin-orders");
  container.textContent = "Chargement des commandes…";
  const { data, error } = await supabaseClient
    .from("orders")
    .select("id, customer_name, customer_email, customer_phone, delivery_address, subtotal, status, created_at, order_items(product_name, unit_price, quantity)")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Impossible de charger les commandes.", error);
    container.textContent = "Impossible de charger les commandes.";
    return;
  }

  if (!data.length) {
    container.textContent = "Aucune commande pour le moment.";
    return;
  }

  const statusLabels = {
    pending: "En attente de paiement",
    processing: "En préparation",
    shipped: "Expédiée",
    cancelled: "Annulée",
  };
  container.innerHTML = data.map((order) => {
    const orderId = escapeHtml(order.id);
    const items = (order.order_items || []).map((item) =>
      `${escapeHtml(item.product_name)} × ${item.quantity} — ${currency.format(Number(item.unit_price) * item.quantity)}`,
    ).join("<br>");
    const date = new Date(order.created_at).toLocaleString("fr-FR");
    return `
      <article class="order-card">
        <div class="order-card-heading">
          <strong>Commande ${orderId.slice(0, 8).toUpperCase()}</strong>
          <span>${escapeHtml(date)}</span>
          <strong>${currency.format(Number(order.subtotal))}</strong>
        </div>
        <div class="order-customer">
          <strong>${escapeHtml(order.customer_name)}</strong>
          <a href="mailto:${escapeHtml(order.customer_email)}">${escapeHtml(order.customer_email)}</a>
          <a href="tel:${escapeHtml(order.customer_phone)}">${escapeHtml(order.customer_phone)}</a>
          <span>${escapeHtml(order.delivery_address)}</span>
        </div>
        <p class="order-lines">${items}</p>
        <div class="order-status-control">
          <label>Statut
            <select data-order-status="${orderId}">
              ${Object.entries(statusLabels).map(([value, label]) =>
                `<option value="${value}" ${order.status === value ? "selected" : ""}>${label}</option>`,
              ).join("")}
            </select>
          </label>
          <button type="button" data-save-order="${orderId}">Mettre à jour</button>
        </div>
      </article>
    `;
  }).join("");
}

async function refreshCatalogAfterChange() {
  await loadAdminProducts();
  setAdminMessage(document.querySelector(".product-message"), "Catalogue mis à jour.");
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

searchInput.addEventListener("input", renderProducts);
sortSelect.addEventListener("change", renderProducts);

productGrid.addEventListener("click", (event) => {
  const addButton = event.target.closest("[data-add]");
  if (!addButton) return;

  const id = addButton.dataset.add;
  if (!productById.has(id)) {
    showToast("Ce produit n’est plus disponible.");
    loadProducts();
    return;
  }
  if ((cart[id] || 0) >= 20) {
    showToast("La quantité maximale par produit est de 20.");
    return;
  }

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
    if (cart[id] > 20) cart[id] = 20;
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
  document.querySelector(".checkout-form").hidden = false;
  document.querySelector(".cart-summary").hidden = true;
  document.querySelector(".checkout-form input[name='name']").focus();
});

document.querySelector(".back-to-cart").addEventListener("click", () => {
  document.querySelector(".checkout-form").hidden = true;
  document.querySelector(".cart-summary").hidden = false;
});

document.querySelector(".checkout-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const submit = form.querySelector(".checkout-submit");
  const message = form.querySelector(".checkout-message");
  const entries = Object.entries(cart).filter(([id, quantity]) => productById.has(id) && quantity > 0);
  if (!entries.length) {
    setAdminMessage(message, "Le panier est vide.", true);
    return;
  }
  if (!supabaseClient) {
    setAdminMessage(message, "Le service de commande n’est pas configuré.", true);
    return;
  }

  const formData = new FormData(form);
  const customer = {
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    address: formData.get("address"),
  };
  submit.disabled = true;
  message.textContent = "Enregistrement de la commande…";

  const { data, error } = await supabaseClient.rpc("create_store_order", {
    p_customer: customer,
    p_items: entries.map(([product_id, quantity]) => ({ product_id, quantity })),
  });

  submit.disabled = false;
  if (error) {
    console.error("Impossible d’enregistrer la commande.", error);
    setAdminMessage(message, error.message || "La commande n’a pas pu être enregistrée. Réessaie.", true);
    return;
  }

  cart = {};
  saveCart();
  renderCart();
  form.reset();
  closeCart();
  showToast(`Commande ${String(data).slice(0, 8).toUpperCase()} enregistrée. Nous te recontacterons pour le paiement.`);
  if (!document.querySelector(".admin-dashboard").hidden) await loadOrders();
});

document.querySelector("#admin-login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const message = document.querySelector(".admin-message");
  if (!supabaseClient) {
    setAdminMessage(message, "La connexion Supabase n’est pas configurée.", true);
    return;
  }

  const submit = form.querySelector("button[type='submit']");
  submit.disabled = true;
  setAdminMessage(message, "Connexion en cours…");
  const { error } = await supabaseClient.auth.signInWithPassword({
    email: form.elements.email.value,
    password: form.elements.password.value,
  });
  submit.disabled = false;
  if (error) {
    console.error("Échec de connexion à l’espace de gestion.", error);
    setAdminMessage(message, "Connexion impossible. Vérifie l’e-mail et le mot de passe.", true);
  }
});

document.querySelector(".admin-logout").addEventListener("click", async () => {
  const { error } = await supabaseClient.auth.signOut();
  if (error) {
    console.error("Impossible de fermer la session admin.", error);
    setAdminMessage(document.querySelector(".admin-message"), "La déconnexion a échoué.", true);
  }
});

document.querySelector("#product-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const values = Object.fromEntries(formData.entries());
  const payload = {
    name: values.name.trim(),
    description: values.description.trim(),
    category: values.category,
    price: Number(values.price),
    image_url: values.image_url.trim(),
    alt: values.alt.trim(),
    tag: values.tag.trim(),
  };
  if (!/^https:\/\//i.test(payload.image_url)) {
    setAdminMessage(document.querySelector(".product-message"), "L’image doit utiliser une URL HTTPS.", true);
    return;
  }

  const { error } = await supabaseClient
    .from("products")
    .upsert(values.id ? { ...payload, id: values.id } : payload);
  if (error) {
    console.error("Impossible d’enregistrer le produit.", error);
    setAdminMessage(document.querySelector(".product-message"), "Le produit n’a pas pu être enregistré. Vérifie les champs et réessaie.", true);
    return;
  }

  form.reset();
  form.elements.id.value = "";
  document.querySelector(".cancel-edit").hidden = true;
  await refreshCatalogAfterChange();
});

document.querySelector(".cancel-edit").addEventListener("click", () => {
  document.querySelector("#product-form").reset();
  document.querySelector("#product-form").elements.id.value = "";
  document.querySelector(".cancel-edit").hidden = true;
});

document.querySelector(".admin-product-list").addEventListener("click", async (event) => {
  const editButton = event.target.closest("[data-edit-product]");
  const toggleButton = event.target.closest("[data-toggle-product]");
  if (editButton) {
    const product = productById.get(editButton.dataset.editProduct);
    if (!product) return;
    const form = document.querySelector("#product-form");
    Object.entries(product).forEach(([key, value]) => {
      if (form.elements[key]) form.elements[key].value = value ?? "";
    });
    document.querySelector(".cancel-edit").hidden = false;
    form.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  if (toggleButton) {
    const { error } = await supabaseClient
      .from("products")
      .update({ active: toggleButton.dataset.active !== "true" })
      .eq("id", toggleButton.dataset.toggleProduct);
    if (error) {
      console.error("Impossible de modifier la visibilité du produit.", error);
      setAdminMessage(document.querySelector(".product-message"), "La visibilité du produit n’a pas pu être modifiée.", true);
      return;
    }
    await refreshCatalogAfterChange();
  }
});

document.querySelector(".admin-orders").addEventListener("click", async (event) => {
  const saveButton = event.target.closest("[data-save-order]");
  if (!saveButton) return;
  const orderId = saveButton.dataset.saveOrder;
  const statusSelect = document.querySelector(`[data-order-status="${orderId}"]`);
  const { error } = await supabaseClient
    .from("orders")
    .update({ status: statusSelect.value })
    .eq("id", orderId);
  if (error) {
    console.error("Impossible de mettre à jour le statut de la commande.", error);
    showToast("Le statut de la commande n’a pas pu être modifié.");
    return;
  }
  showToast("Statut de commande mis à jour.");
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

function showAdminFromHash() {
  const section = document.querySelector(".admin-section");
  section.classList.toggle("is-visible", window.location.hash === "#admin");
}

window.addEventListener("hashchange", showAdminFromHash);
showAdminFromHash();
document.querySelector("#year").textContent = new Date().getFullYear();
renderCart();

if (supabaseClient) {
  supabaseClient.auth.onAuthStateChange((_event, session) => {
    window.setTimeout(() => verifyAdmin(session), 0);
  });
  loadProducts();
  supabaseClient.auth.getSession().then(({ data, error }) => {
    if (error) {
      console.error("Impossible de récupérer la session d’administration.", error);
      return;
    }
    verifyAdmin(data.session);
  });
} else {
  document.querySelector(".catalog-message").hidden = false;
  document.querySelector(".catalog-message").textContent = "La connexion à la base de données n’est pas configurée.";
}
