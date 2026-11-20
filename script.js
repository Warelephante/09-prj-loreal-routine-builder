/* Get references to DOM elements */
const categoryFilter = document.getElementById("categoryFilter");
const productSearch = document.getElementById("productSearch");
const productsContainer = document.getElementById("productsContainer");
const selectedProductsList = document.getElementById("selectedProductsList");
const productModal = document.getElementById("productModal");
const productModalTitle = document.getElementById("productModalTitle");
const productModalBrand = document.getElementById("productModalBrand");
const productModalDescription = document.getElementById(
  "productModalDescription",
);
const closeProductModal = document.getElementById("closeProductModal");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const userInput = document.getElementById("userInput");
const sendButton = document.getElementById("sendBtn");
const generateRoutineButton = document.getElementById("generateRoutine");
const workerUrl = "https://wunda-bot.filippramsey.workers.dev/";
let selectedProducts = [];
let displayedProducts = [];
let isRequestPending = false;
let productsPromise;

/* Keep the full conversation so the Worker can answer follow-up questions */
const messages = [
  {
    role: "system",
    content:
      "You are a helpful L'Oréal beauty advisor. Create clear, practical routines using the selected product data provided by the user. Do not recommend products that were not selected. Never output the raw JSON; use it only as context and explain the routine in natural language. Please refrain from answering any non related L'Oréal questions.",
  },
];
const chatMessages = [];

/* Show initial placeholder until user selects a category */
productsContainer.innerHTML = `
  <div class="placeholder-message">
    Select a category to view products
  </div>
`;

/* Load product data from JSON file */
async function loadProducts() {
  if (!productsPromise) {
    productsPromise = fetch("products.json")
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Could not load products. HTTP ${response.status}.`);
        }

        return response.json();
      })
      .then((data) => data.products);
  }

  return productsPromise;
}

/* Create HTML for displaying product cards */
function displayProducts(products) {
  displayedProducts = products;
  if (products.length === 0) {
    productsContainer.innerHTML = `
      <div class="placeholder-message">
        No products match your search.
      </div>
    `;
    return;
  }

  productsContainer.innerHTML = products
    .map((product) => {
      const isSelected = selectedProducts.some(
        (selectedProduct) => selectedProduct.id === product.id,
      );

      return `
    <div class="product-card${isSelected ? " selected" : ""}" data-product-id="${product.id}">
      <img src="${product.image}" alt="${product.name}">
      <div class="product-info">
        <h3>
          <button class="product-details-btn" type="button">${product.name}</button>
        </h3>
        <p>${product.brand}</p>
        <button class="add-product-btn" data-product-id="${product.id}" type="button">
          Add to selected
        </button>
      </div>
    </div>
  `;
    })
    .join("");

  productsContainer.querySelectorAll(".product-card").forEach((card) => {
    const productId = Number(card.dataset.productId);
    const product = products.find((item) => item.id === productId);

    card.addEventListener("click", (event) => {
      if (event.target.closest(".add-product-btn")) {
        return;
      }

      showProductDetails(product);
    });
  });

  productsContainer.querySelectorAll(".add-product-btn").forEach((button) => {
    const productId = Number(button.dataset.productId);
    const isSelected = selectedProducts.some(
      (product) => product.id === productId,
    );

    if (isSelected) {
      button.textContent = "Added";
      button.disabled = true;
    }

    button.addEventListener("click", () => {
      const product = products.find((item) => item.id === productId);

      if (product && !selectedProducts.some((item) => item.id === productId)) {
        selectedProducts.push(product);
        displaySelectedProducts();
        displayProducts(displayedProducts);
      }
    });
  });
}

/* Show a product's description in the modal */
function showProductDetails(product) {
  if (!product) {
    return;
  }

  productModalTitle.textContent = product.name;
  productModalBrand.textContent = product.brand;
  productModalDescription.textContent = product.description;
  productModal.showModal();
}

/* Show selected products and let users remove them */
function displaySelectedProducts() {
  if (selectedProducts.length === 0) {
    selectedProductsList.innerHTML = "<p>No products selected yet.</p>";
    return;
  }

  selectedProductsList.innerHTML = selectedProducts
    .map(
      (product) => `
    <div class="selected-product" data-product-id="${product.id}">
      <div>
        <h3>
          <button class="product-details-btn" type="button">${product.name}</button>
        </h3>
        <p>${product.brand}</p>
      </div>
      <button class="remove-product-btn" data-product-id="${product.id}" type="button">
        Remove
      </button>
    </div>
  `,
    )
    .join("");

  selectedProductsList.querySelectorAll(".selected-product").forEach((item) => {
    const productId = Number(item.dataset.productId);
    const product = selectedProducts.find(
      (selectedItem) => selectedItem.id === productId,
    );

    item.addEventListener("click", (event) => {
      if (event.target.closest(".remove-product-btn")) {
        return;
      }

      showProductDetails(product);
    });
  });

  selectedProductsList
    .querySelectorAll(".remove-product-btn")
    .forEach((button) => {
      button.addEventListener("click", () => {
        const productId = Number(button.dataset.productId);
        selectedProducts = selectedProducts.filter(
          (product) => product.id !== productId,
        );
        displaySelectedProducts();
        displayProducts(displayedProducts);
      });
    });
}

closeProductModal.addEventListener("click", () => {
  productModal.close();
});

/* Display the conversation safely as text */
function displayMessages() {
  chatWindow.innerHTML = "";

  chatMessages.forEach((message) => {
    const messageElement = document.createElement("p");
    messageElement.className = `chat-message ${message.role}`;
    messageElement.textContent = `${message.role === "user" ? "You" : "Advisor"}: ${
      message.content
    }`;
    chatWindow.appendChild(messageElement);
  });

  chatWindow.scrollTop = chatWindow.scrollHeight;
}

/* Show loading and error messages in the chat */
function showChatStatus(text, isError = false) {
  const previousStatus = chatWindow.querySelector(".chat-status");

  if (previousStatus) {
    previousStatus.remove();
  }

  const statusElement = document.createElement("p");
  statusElement.className = isError ? "chat-status error" : "chat-status";
  statusElement.textContent = text;
  chatWindow.appendChild(statusElement);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

/* Send the conversation to the class Cloudflare Worker */
async function sendMessageToWorker(
  userMessage,
  loadingMessage,
  displayedUserMessage = userMessage,
) {
  if (isRequestPending) {
    return false;
  }

  isRequestPending = true;
  generateRoutineButton.disabled = true;
  sendButton.disabled = true;
  showChatStatus(loadingMessage);

  try {
    const requestMessages = messages.concat({
      role: "user",
      content: userMessage,
    });
    const response = await fetch(workerUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: requestMessages }),
    });

    if (!response.ok) {
      throw new Error(`The Worker returned HTTP ${response.status}.`);
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content;

    if (typeof reply !== "string" || reply.trim() === "") {
      throw new Error("The Worker response did not include a reply.");
    }

    messages.push(
      { role: "user", content: userMessage },
      { role: "assistant", content: reply },
    );
    chatMessages.push(
      { role: "user", content: displayedUserMessage },
      { role: "assistant", content: reply },
    );
    displayMessages();
    return true;
  } catch (error) {
    showChatStatus(
      `Could not get a response from the Cloudflare Worker. ${error.message}`,
      true,
    );
    return false;
  } finally {
    isRequestPending = false;
    generateRoutineButton.disabled = false;
    sendButton.disabled = false;
  }
}

/* Generate a routine using the complete JSON data for selected products */
generateRoutineButton.addEventListener("click", async () => {
  if (selectedProducts.length === 0) {
    showChatStatus(
      "Select at least one product before generating a routine.",
      true,
    );
    return;
  }

  const productData = JSON.stringify(selectedProducts, null, 2);
  const userMessage = `Create a personalized routine using only these selected products. Explain the order and how to use each product.\n\nSelected product data:\n${productData}`;

  await sendMessageToWorker(
    userMessage,
    "Generating your routine...",
    "Generate a routine using my selected products.",
  );
});

/* Apply the search text and category together before displaying products */
async function filterProducts() {
  const products = await loadProducts();
  const searchTerm = productSearch.value.trim().toLowerCase();
  const selectedCategory = categoryFilter.value;

  const filteredProducts = products.filter((product) => {
    const matchesCategory =
      selectedCategory === "all" ||
      selectedCategory === "" ||
      product.category === selectedCategory;
    const searchableText = [
      product.name,
      product.brand,
      product.category,
      product.description,
    ]
      .join(" ")
      .toLowerCase();
    const matchesSearch = searchableText.includes(searchTerm);

    return matchesCategory && matchesSearch;
  });

  displayProducts(filteredProducts);
}

productSearch.addEventListener("input", filterProducts);
categoryFilter.addEventListener("change", filterProducts);

displaySelectedProducts();

/* Send follow-up questions with the full conversation history */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const userMessage = userInput.value.trim();

  if (userMessage === "") {
    return;
  }

  const wasSent = await sendMessageToWorker(
    userMessage,
    "Getting your response...",
  );

  if (wasSent) {
    userInput.value = "";
  }
});