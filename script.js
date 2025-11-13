/* Get references to DOM elements */
const categoryFilter = document.getElementById("categoryFilter");
const productsContainer = document.getElementById("productsContainer");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");

/* Cloudflare Worker endpoint for API requests */
const workerURL = "https://loreal-chatbot2.adamico4.workers.dev/";
const selectedProductsList = document.getElementById("selectedProductsList");
const generateRoutineBtn = document.getElementById("generateRoutine");
// new: Clear All selections button
const clearSelectionsBtn = document.getElementById("clearSelections");

/* Get modal references */
const productModal = document.getElementById("productModal");
const modalImage = document.getElementById("modalImage");
const modalTitle = document.getElementById("modalTitle");
const modalBrand = document.getElementById("modalBrand");
const modalDescription = document.getElementById("modalDescription");

/* Show initial placeholder until user selects a category */
productsContainer.innerHTML = `
  <div class="placeholder-message">
    Select a category to view products
  </div>
`;

/* Load product data from JSON file */
async function loadProducts() {
  const response = await fetch("products.json");
  const data = await response.json();
  return data.products;
}

/* keep selected products (store product objects) */
let selectedProducts = [];

/* Save selected products to localStorage */
function saveSelectedProducts() {
  try {
    localStorage.setItem("selectedProducts", JSON.stringify(selectedProducts));
  } catch (e) {
    console.error("Could not save selected products:", e);
  }
}

/* Load selected products from localStorage */
function loadSelectedProducts() {
  try {
    const raw = localStorage.getItem("selectedProducts");
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      selectedProducts = parsed;
    }
  } catch (e) {
    console.error("Could not load selected products:", e);
    selectedProducts = [];
  }
}

/* Create HTML for displaying product cards */
function displayProducts(products) {
  // render cards with data-index and a details button
  productsContainer.innerHTML = products
    .map(
      (product, idx) => `
    <div class="product-card" data-index="${idx}" tabindex="0">
      <img src="${product.image}" alt="${product.name}">
      <div class="product-info">
        <h3>${product.name}</h3>
        <p>${product.brand}</p>
        <button class="detail-btn" type="button" data-index="${idx}" aria-label="View details for ${product.name}">Details</button>
      </div>
    </div>
  `
    )
    .join("");

  // attach click and keyboard handlers after DOM insertion
  const cards = productsContainer.querySelectorAll(".product-card");
  cards.forEach((card) => {
    // click toggles selection (but not when clicking the details button)
    card.addEventListener("click", (e) => {
      // if a details button or its children was clicked, ignore here
      if (e.target.closest(".detail-btn")) return;
      const index = Number(card.getAttribute("data-index"));
      toggleSelection(index, products[index], card);
    });

    // support keyboard selection (Enter or Space) when focus is on the card itself
    card.addEventListener("keydown", (e) => {
      const activeIsDetail =
        document.activeElement &&
        document.activeElement.classList &&
        document.activeElement.classList.contains("detail-btn");
      if (activeIsDetail) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        const index = Number(card.getAttribute("data-index"));
        toggleSelection(index, products[index], card);
      }
    });
  });

  // attach detail buttons to open modal
  const detailButtons = productsContainer.querySelectorAll(".detail-btn");
  detailButtons.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation(); // prevent card selection toggle
      const index = Number(btn.getAttribute("data-index"));
      openProductModal(products[index]);
    });
  });

  // After rendering, mark any cards that match selectedProducts
  products.forEach((product, idx) => {
    const matchIndex = selectedProducts.findIndex(
      (p) => p.name === product.name && p.brand === product.brand
    );
    if (matchIndex !== -1) {
      const card = productsContainer.querySelector(
        `.product-card[data-index="${idx}"]`
      );
      if (card) {
        card.classList.add("selected");
        if (!card.querySelector(".selected-badge")) {
          const badge = document.createElement("span");
          badge.className = "selected-badge";
          badge.textContent = "Selected";
          card.appendChild(badge);
        }
      }
    }
  });
}

/* Toggle selection state and update UI */
function toggleSelection(index, product, cardElement) {
  // find product by name+brand to avoid index mismatches across filters
  const existingIndex = selectedProducts.findIndex(
    (p) => p.name === product.name && p.brand === product.brand
  );
  if (existingIndex === -1) {
    // add product object
    selectedProducts.push(product);
    cardElement.classList.add("selected");
    // add badge if not present
    if (!cardElement.querySelector(".selected-badge")) {
      const badge = document.createElement("span");
      badge.className = "selected-badge";
      badge.textContent = "Selected";
      cardElement.appendChild(badge);
    }
  } else {
    // remove
    selectedProducts.splice(existingIndex, 1);
    cardElement.classList.remove("selected");
    const badge = cardElement.querySelector(".selected-badge");
    if (badge) cardElement.removeChild(badge);
  }

  // persist selection
  saveSelectedProducts();
  renderSelectedProductsList();
}

/* Render the list of selected products in the sidebar area */
function renderSelectedProductsList() {
  if (selectedProducts.length === 0) {
    selectedProductsList.innerHTML = `<div class="placeholder-message">No products selected</div>`;
    // disable Clear All if present
    if (clearSelectionsBtn) clearSelectionsBtn.disabled = true;
    return;
  }

  // include a remove button for each selected item (data-name + data-brand used to identify)
  selectedProductsList.innerHTML = selectedProducts
    .map(
      (item) => `
      <div class="selected-item" data-name="${encodeURIComponent(
        item.name
      )}" data-brand="${encodeURIComponent(item.brand)}">
        <div>
          <strong>${item.name}</strong>
          <div style="font-size:13px;color:#666">${item.brand}</div>
        </div>
        <button class="remove-btn" type="button" aria-label="Remove ${
          item.name
        }" data-name="${encodeURIComponent(
        item.name
      )}" data-brand="${encodeURIComponent(item.brand)}">Remove</button>
      </div>
    `
    )
    .join("");

  // enable Clear All if present
  if (clearSelectionsBtn) clearSelectionsBtn.disabled = false;
}

/* New: allow removing items directly from the selected list via the remove button
   We use event delegation so we don't need to re-attach handlers on each render. */
selectedProductsList.addEventListener("click", (e) => {
  const btn = e.target.closest(".remove-btn");
  if (!btn) return;

  const name = decodeURIComponent(btn.getAttribute("data-name"));
  const brand = decodeURIComponent(btn.getAttribute("data-brand"));

  // remove from selectedProducts array by matching name+brand
  const existingIndex = selectedProducts.findIndex(
    (p) => p.name === name && p.brand === brand
  );
  if (existingIndex !== -1) {
    selectedProducts.splice(existingIndex, 1);
  }

  // persist selection
  saveSelectedProducts();

  // if the corresponding product card is currently rendered, clear its selected state
  // compare by name and brand within the currently displayed cards
  const cards = productsContainer.querySelectorAll(".product-card");
  cards.forEach((card) => {
    const idx = Number(card.getAttribute("data-index"));
    // try to get product info from the DOM (name and brand elements)
    const nameEl = card.querySelector(".product-info h3");
    const brandEl = card.querySelector(".product-info p");
    if (!nameEl || !brandEl) return;
    if (nameEl.textContent === name && brandEl.textContent === brand) {
      card.classList.remove("selected");
      const badge = card.querySelector(".selected-badge");
      if (badge) card.removeChild(badge);
    }
  });

  // re-render selected list
  renderSelectedProductsList();
});

/* Clear all selections handler */
function clearAllSelections() {
  // clear data
  selectedProducts = [];
  saveSelectedProducts();

  // remove selected state from any currently-rendered product cards
  const cards = productsContainer.querySelectorAll(".product-card.selected");
  cards.forEach((card) => {
    card.classList.remove("selected");
    const badge = card.querySelector(".selected-badge");
    if (badge) card.removeChild(badge);
  });

  // re-render sidebar list and update Clear All button state
  renderSelectedProductsList();
}

/* Wire Clear All button */
if (clearSelectionsBtn) {
  clearSelectionsBtn.addEventListener("click", () => {
    // simple confirm for beginners (optional)
    if (!confirm("Clear all saved selections?")) return;
    clearAllSelections();
  });
}

/* Open modal and populate details */
function openProductModal(product) {
  // populate modal fields (product.description expected in products.json)
  modalImage.src = product.image || "";
  modalImage.alt = product.name || "Product image";
  modalTitle.textContent = product.name || "";
  modalBrand.textContent = product.brand || "";
  modalDescription.textContent =
    product.description || "No description available.";

  // show modal (set aria-hidden to false for accessibility)
  productModal.setAttribute("aria-hidden", "false");

  // focus close button for easy keyboard dismissal
  const closeBtn = productModal.querySelector("[data-modal-close]");
  if (closeBtn) closeBtn.focus();

  // attach one-time Esc handler
  document.addEventListener("keydown", escKeyClose);
}

/* Close modal */
function closeProductModal() {
  productModal.setAttribute("aria-hidden", "true");
  // remove Esc handler
  document.removeEventListener("keydown", escKeyClose);
}

/* Close when pressing Escape */
function escKeyClose(e) {
  if (e.key === "Escape") {
    closeProductModal();
  }
}

/* Close when clicking overlay or close buttons (delegated) */
productModal.addEventListener("click", (e) => {
  if (
    e.target.matches("[data-modal-close]") ||
    e.target.classList.contains("product-modal__overlay")
  ) {
    closeProductModal();
  }
});

/* Filter and display products when category changes */
categoryFilter.addEventListener("change", async (e) => {
  const selectedCategory = e.target.value;

  // show loading placeholder immediately so users get feedback
  productsContainer.innerHTML = `
    <div class="placeholder-message">Loading products…</div>
  `;

  try {
    const products = await loadProducts();

    /* filter() creates a new array containing only products 
       where the category matches what the user selected */
    const filteredProducts = products.filter(
      (product) => product.category === selectedCategory
    );

    // if nothing was found, show a friendly message
    if (!filteredProducts || filteredProducts.length === 0) {
      productsContainer.innerHTML = `
        <div class="placeholder-message">No products found for "${selectedCategory}".</div>
      `;
      return;
    }

    // Keep previous selections (persisted in localStorage) so they survive category changes
    displayProducts(filteredProducts);
  } catch (err) {
    console.error("Error loading products:", err);
    productsContainer.innerHTML = `
      <div class="placeholder-message">Failed to load products. Please try again.</div>
    `;
  }
});

/* Conversation memory: keep full chat history so assistant can use context.
   We start with a system message describing the assistant's role. */
const messages = [
  {
    role: "system",
    content:
      "You are a helpful beauty and skincare advisor for L'Oréal products. Help users build routines and answer questions about products.",
  },
];

/* Helper to safely append messages to the chat window.
   Uses textContent (no innerHTML) to avoid accidental HTML injection. */
function addMessage(role, text, { strongLabel } = {}) {
  const container = document.createElement("div");
  container.className = `message ${
    role === "user" ? "user-message" : "bot-message"
  }`;

  const label = document.createElement("strong");
  label.textContent = strongLabel || (role === "user" ? "You:" : "Assistant:");

  container.appendChild(label);
  container.appendChild(document.createTextNode(" " + text));

  chatWindow.appendChild(container);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

/* Chat form submission handler - uses OpenAI API */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  // Get the user's input from the form
  const userInputEl = document.getElementById("userInput");
  const userInput = userInputEl.value.trim();
  if (!userInput) return;

  // Clear the input field
  userInputEl.value = "";

  // Push user message into conversation memory
  messages.push({ role: "user", content: userInput });

  // Show user message in chat window (safe)
  addMessage("user", userInput);

  // Show loading indicator (separate element so we can remove it later)
  const loadingEl = document.createElement("div");
  loadingEl.className = "message bot-message loading";
  const loadingLabel = document.createElement("strong");
  loadingLabel.textContent = "Assistant:";
  loadingEl.appendChild(loadingLabel);
  loadingEl.appendChild(document.createTextNode(" Thinking..."));
  chatWindow.appendChild(loadingEl);
  chatWindow.scrollTop = chatWindow.scrollHeight;

  try {
    // Get API key from secrets.js
    const apiKey = window.OPENAI_API_KEY;

    if (!apiKey) {
      throw new Error("API key not found. Please check your secrets.js file.");
    }

    // Make request to OpenAI API using fetch, sending the full messages array
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: messages,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const assistantMessage = data.choices[0].message.content;

    // Remove loading message
    const loadingMsg = chatWindow.querySelector(".loading");
    if (loadingMsg) loadingMsg.remove();

    // Push assistant reply into conversation memory
    messages.push({ role: "assistant", content: assistantMessage });

    // Render assistant message safely
    addMessage("assistant", assistantMessage);
  } catch (error) {
    // Remove loading message
    const loadingMsg = chatWindow.querySelector(".loading");
    if (loadingMsg) loadingMsg.remove();

    addMessage(
      "assistant",
      "Sorry, I couldn't get a response. Please check your API key and try again.",
      { strongLabel: "Error:" }
    );
    console.error("OpenAI API error:", error);
  }
});

/* initialize selected products area */
loadSelectedProducts();
renderSelectedProductsList();

/* Generate Routine button handler */
if (generateRoutineBtn) {
  generateRoutineBtn.addEventListener("click", async () => {
    console.log("Generate button clicked!");
    console.log("Selected products:", selectedProducts.length);

    // Check if user has selected any products
    if (selectedProducts.length === 0) {
      console.log("No products selected - showing notice");
      chatWindow.innerHTML += `
      <div class="message bot-message error">
        <strong>Notice:</strong> Please select at least one product before generating a routine.
      </div>
    `;
      chatWindow.scrollTop = chatWindow.scrollHeight;
      return;
    }

    // Build a list of selected products with their details
    const productsList = selectedProducts
      .map((p) => {
        return `- ${p.name} (${p.brand}) - ${p.category}: ${
          p.description || "No description"
        }`;
      })
      .join("\n");

    // Show user request in chat window and add to messages[]
    const routineRequestText =
      "Please create a skincare/beauty routine using my selected products.";
    addMessage("user", routineRequestText);
    messages.push({
      role: "user",
      content: `User selected products:\n\n${productsList}\n\n${routineRequestText}`,
    });

    // Show loading indicator
    const loadingEl = document.createElement("div");
    loadingEl.className = "message bot-message loading";
    const loadingLabel = document.createElement("strong");
    loadingLabel.textContent = "Assistant:";
    loadingEl.appendChild(loadingLabel);
    loadingEl.appendChild(
      document.createTextNode(" Creating your personalized routine...")
    );
    chatWindow.appendChild(loadingEl);
    chatWindow.scrollTop = chatWindow.scrollHeight;

    try {
      // Get API key from secrets.js
      const apiKey = window.OPENAI_API_KEY;

      if (!apiKey) {
        throw new Error(
          "API key not found. Please check your secrets.js file."
        );
      }

      // Make request to OpenAI API using fetch with the full messages[]
      const response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-4o",
            messages: messages,
            max_tokens: 800,
          }),
        }
      );

      // Check if the response is ok (status 200-299)
      if (!response.ok) {
        const errorData = await response.json();
        console.error("API error response:", errorData);
        throw new Error(
          `API error: ${response.status} - ${
            errorData.error?.message || "Unknown error"
          }`
        );
      }

      const data = await response.json();
      const routineMessage = data.choices[0].message.content;

      // Remove loading message
      const loadingMsg = chatWindow.querySelector(".loading");
      if (loadingMsg) loadingMsg.remove();

      // Push assistant reply into conversation memory
      messages.push({ role: "assistant", content: routineMessage });

      // Show generated routine in chat window (safe)
      addMessage("assistant", routineMessage, {
        strongLabel: "Your Personalized Routine:",
      });
    } catch (error) {
      // Remove loading message
      const loadingMsg = chatWindow.querySelector(".loading");
      if (loadingMsg) loadingMsg.remove();

      addMessage(
        "assistant",
        "Sorry, I couldn't generate a routine. Please check your API key and try again.",
        { strongLabel: "Error:" }
      );
      console.error("OpenAI API error:", error);
    }
  });
} else {
  console.error("Generate button not found in DOM!");
}
