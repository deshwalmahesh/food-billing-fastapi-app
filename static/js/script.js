// Global variables
let popupContainer;
let items = [];
let cartItems = [];

// Initialize cart items array if it doesn't exist
if (typeof cartItems === 'undefined') {
    cartItems = [];
}

document.addEventListener('DOMContentLoaded', function() {
    // Initialize cart display on page load
    updateCartDisplay();
    // DOM Elements
    const itemSelect = document.getElementById('item-select');
    const searchInput = document.querySelector('.search-form input[name="search"]');
    const searchResults = document.getElementById('search-results');
    const quantityInput = document.getElementById('quantity');
    const cartItemsList = document.getElementById('cart-items-list');
    const emptyCartMessage = document.getElementById('empty-cart-message');
    const summaryTotalPrice = document.getElementById('summary-total-price');
    const addToCartBtn = document.getElementById('add-to-cart-btn');
    const paymentForms = document.querySelectorAll('.payment-form');
    const submitOrderBtn = document.getElementById('submit-order-btn');
    const paymentDoneBtn = document.getElementById('payment-done-btn');
    
    // Add to Cart button event listener is added later
    
    // History modal elements
    const historyToggle = document.getElementById('history-toggle');
    const historyModal = document.getElementById('history-modal');
    const closeBtn = document.querySelector('.close');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebar = document.querySelector('.sidebar');
    
    // Modify order buttons
    const modifyButtons = document.querySelectorAll('.modify-order-btn');
    
    // Create popup container if it doesn't exist
    popupContainer = document.getElementById('popup-container');
    if (!popupContainer) {
        popupContainer = document.createElement('div');
        popupContainer.id = 'popup-container';
        document.body.appendChild(popupContainer);
    }
    
    // Initialize local cart items
    cartItems = [];
    
    // Event Listeners - only add if elements exist
    if (addToCartBtn) {
        addToCartBtn.addEventListener('click', addToCart);
    }
    
    if (submitOrderBtn) {
        submitOrderBtn.addEventListener('click', submitOrder);
    }
    
    if (paymentDoneBtn) {
        paymentDoneBtn.addEventListener('click', submitOrderWithPayment);
    }
    
    // Quantity buttons
    const decreaseBtn = document.querySelector('.quantity-btn.decrease');
    const increaseBtn = document.querySelector('.quantity-btn.increase');
    
    if (decreaseBtn) {
        decreaseBtn.addEventListener('click', function() {
            const currentValue = parseInt(quantityInput.value) || 1;
            if (currentValue > 1) {
                quantityInput.value = currentValue - 1;
                updateOrderSummary();
            }
        });
    }
    
    if (increaseBtn) {
        increaseBtn.addEventListener('click', function() {
            const currentValue = parseInt(quantityInput.value) || 1;
            quantityInput.value = currentValue + 1;
            updateOrderSummary();
        });
    }
    
    // Prevent manual deletion of quantity value
    if (quantityInput) {
        quantityInput.addEventListener('blur', function() {
            if (!this.value || parseInt(this.value) < 1) {
                this.value = 1;
                updateOrderSummary();
            }
        });
    }
    
    // Add event listeners to all payment forms
    paymentForms.forEach(form => {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            showConfirmationPopup(
                'Mark as Paid',
                'Are you sure you want to mark this order as paid?',
                'green',
                () => {
                    form.submit();
                }
            );
        });
    });
    
    // Add event listeners to all cancel forms
    const cancelForms = document.querySelectorAll('.cancel-form');
    cancelForms.forEach(form => {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            const orderId = form.getAttribute('data-order-id');
            cancelOrder(orderId);
        });
    });
    
    // Add event listeners to all modify buttons
    modifyButtons.forEach(button => {
        button.addEventListener('click', function() {
            const orderId = button.getAttribute('data-order-id');
            // Call the function from modify_order.js
            if (typeof showOrderModifyModal === 'function') {
                showOrderModifyModal(orderId);
            } else {
                console.error('showOrderModifyModal function not found');
            }
        });
    });
    
    // Sidebar toggle
    if (sidebarToggle && sidebar) {
        sidebarToggle.addEventListener('click', function() {
            sidebar.classList.toggle('collapsed');
            document.querySelector('.main-container').classList.toggle('expanded');
        });
    }
    
    // Search functionality
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            const query = this.value.trim();
            if (query.length >= 2) {
                fetchSearchResults(query);
            } else {
                searchResults.innerHTML = '';
                searchResults.classList.remove('active');
            }
        });
        
        // Hide search results when clicking outside
        document.addEventListener('click', function(e) {
            if (!searchInput.contains(e.target) && searchResults && !searchResults.contains(e.target)) {
                searchResults.classList.remove('active');
            }
        });
    }
    
    // History modal functionality
    if (historyToggle) {
        historyToggle.addEventListener('click', function() {
            if (historyModal) {
                historyModal.style.display = 'block';
            }
        });
    }
    
    // Close history modal when clicking the close button
    if (closeBtn) {
        closeBtn.addEventListener('click', function() {
            if (historyModal) {
                historyModal.style.display = 'none';
            }
        });
    }
    
    // Close history modal when clicking outside of it
    window.addEventListener('click', function(event) {
        if (event.target === historyModal) {
            historyModal.style.display = 'none';
        }
    });
    
    // Fetch all items on page load
    if (itemSelect) {
        fetch('/api/items')
            .then(response => response.json())
            .then(data => {
                items = data;
                console.log('Items loaded:', items.length);
                
                // Update order summary if an item is already selected
                if (itemSelect.value) {
                    updateOrderSummary();
                }
            })
            .catch(error => console.error('Error fetching items:', error));
    }
    
    // Initialize the order summary on page load
    if (itemSelect && itemSelect.value) {
        updateOrderSummary();
    }
});

// Function to fetch search results
function fetchSearchResults(query) {
    fetch(`/api/search-items?query=${encodeURIComponent(query)}`)
        .then(response => response.json())
        .then(data => {
            displaySearchResults(data);
        })
        .catch(error => console.error('Error fetching search results:', error));
}

// Function to display search results
function displaySearchResults(items) {
    const searchResults = document.getElementById('search-results');
    if (!searchResults) return;
    
    if (items.length === 0) {
        searchResults.innerHTML = '<p>No items found</p>';
    } else {
        searchResults.innerHTML = items.map(item => `
            <div class="search-result-item" data-id="${item.id}" data-name="${item.item_name}" data-price="${item.price_per_quantity}" data-stock="${item.remaining_quantity || 0}">
                <span class="item-name">${item.item_name}</span>
                <span class="item-price">₹${item.price_per_quantity.toFixed(2)}</span>
            </div>
        `).join('');
        
        // Add click event to search results
        const resultItems = searchResults.querySelectorAll('.search-result-item');
        resultItems.forEach(item => {
            item.addEventListener('click', function() {
                selectItemFromSearch(this.dataset);
            });
        });
    }
    
    searchResults.classList.add('active');
}

// Function to select an item from search results
function selectItemFromSearch(item) {
    const itemSelect = document.getElementById('item-select');
    if (!itemSelect) return;
    
    // Find the option with the matching item id
    const option = Array.from(itemSelect.options).find(opt => opt.value === item.id);
    
    if (option) {
        option.selected = true;
    } else {
        // If the option doesn't exist, create it
        const newOption = document.createElement('option');
        newOption.value = item.id;
        newOption.text = `${item.name} - ₹${parseFloat(item.price).toFixed(2)} (${item.stock} in stock)`;
        newOption.dataset.name = item.name;
        newOption.dataset.price = item.price;
        newOption.dataset.stock = item.stock;
        itemSelect.add(newOption);
        newOption.selected = true;
    }
    
    // Update order summary
    updateOrderSummary();
    
    // Hide search results
    const searchResults = document.getElementById('search-results');
    if (searchResults) {
        searchResults.classList.remove('active');
    }
}

// Add item to cart functionality
function addToCart() {
    const itemSelect = document.getElementById('item-select');
    const quantityInput = document.getElementById('quantity');
    
    if (!itemSelect || !itemSelect.value) {
        showAlert('Please select an item', 'red');
        return;
    }
    
    const selectedOption = itemSelect.options[itemSelect.selectedIndex];
    const itemId = itemSelect.value;
    const itemName = selectedOption.dataset.name || selectedOption.textContent.split(' - ')[0];
    
    // Extract price correctly from the option
    let itemPrice;
    if (selectedOption.dataset.price) {
        itemPrice = parseFloat(selectedOption.dataset.price);
    } else {
        const priceMatch = selectedOption.textContent.match(/₹([\d.]+)/);
        if (priceMatch && priceMatch[1]) {
            itemPrice = parseFloat(priceMatch[1]);
        } else {
            itemPrice = 0;
        }
    }
    
    const quantity = parseInt(quantityInput.value) || 1;
    
    // Check if there's enough stock
    const stock = parseInt(selectedOption.dataset.stock) || 0;
    if (stock !== 0 && quantity > stock) {
        showAlert(`Not enough stock. Only ${stock} available.`, 'red');
        return;
    }
    
    // Check if item already exists in cart
    const existingItemIndex = cartItems.findIndex(item => item.itemId === itemId);
    
    if (existingItemIndex !== -1) {
        // Update quantity if item exists
        cartItems[existingItemIndex].quantity += quantity;
        cartItems[existingItemIndex].subtotal = cartItems[existingItemIndex].quantity * cartItems[existingItemIndex].price;
    } else {
        // Add new item to cart
        cartItems.push({
            itemId,
            name: itemName,
            price: itemPrice,
            quantity,
            subtotal: itemPrice * quantity
        });
    }
    
    console.log('Cart items:', cartItems); // Debug log
    
    // Update cart display immediately
    updateCartDisplay();
    
    // Also update the order summary
    updateOrderSummary();
    
    // Show success message
    showAlert(`${quantity} x ${itemName} added to cart`, 'green');
    
    // Reset quantity
    quantityInput.value = 1;
}

// Update cart display
function updateCartDisplay() {
    console.log('Updating cart display with items:', cartItems);
    
    const cartItemsList = document.getElementById('cart-items-list');
    const emptyCartMessage = document.getElementById('empty-cart-message');
    const summaryTotalPrice = document.getElementById('summary-total-price');
    const orderSummary = document.getElementById('order-summary');
    
    if (!cartItemsList || !emptyCartMessage || !summaryTotalPrice) {
        console.error('Cart elements not found in DOM');
        return;
    }
    
    // Clear existing items first to prevent flickering
    cartItemsList.innerHTML = '';
    
    if (cartItems.length === 0) {
        // Show empty cart message
        emptyCartMessage.style.display = 'block';
        summaryTotalPrice.textContent = '0.00';
        
        // Hide order summary
        if (orderSummary) {
            orderSummary.style.display = 'none';
        }
        
        return;
    }
    
    // We have items, so hide the empty message
    emptyCartMessage.style.display = 'none';
    
    // Show order summary
    if (orderSummary) {
        orderSummary.style.display = 'block';
    }
    
    // Add each item manually
    cartItems.forEach((item, index) => {
        const cartItemDiv = document.createElement('div');
        cartItemDiv.className = 'cart-item';
        
        cartItemDiv.innerHTML = `
            <div class="cart-item-info">
                <span class="item-name">${item.name}</span>
                <span class="item-price">₹${item.price.toFixed(2)} x ${item.quantity} = ₹${item.subtotal.toFixed(2)}</span>
            </div>
            <div class="cart-item-actions">
                <button type="button" class="remove-item-btn">Remove</button>
            </div>
        `;
        
        // Add remove button event listener
        const removeBtn = cartItemDiv.querySelector('.remove-item-btn');
        removeBtn.addEventListener('click', function() {
            removeFromCart(index);
        });
        
        cartItemsList.appendChild(cartItemDiv);
    });
    
    // Update total price
    const totalPrice = cartItems.reduce((sum, item) => sum + item.subtotal, 0);
    summaryTotalPrice.textContent = totalPrice.toFixed(2);
}

// Remove item from cart
function removeFromCart(index) {
    if (index >= 0 && index < cartItems.length) {
        cartItems.splice(index, 1);
        updateCartDisplay();
    }
}

// Update order summary functionality
function updateOrderSummary() {
    const itemSelect = document.getElementById('item-select');
    const quantityInput = document.getElementById('quantity');
    const summaryTotalPrice = document.getElementById('summary-total-price');
    
    if (!itemSelect || !itemSelect.value || !quantityInput || !summaryTotalPrice) return;
    
    const selectedOption = itemSelect.options[itemSelect.selectedIndex];
    let itemPrice = 0;
    
    // Try to get price from dataset first
    if (selectedOption.dataset.price) {
        itemPrice = parseFloat(selectedOption.dataset.price);
    } else {
        // Extract price from option text
        const priceMatch = selectedOption.textContent.match(/₹([\d.]+)/);
        if (priceMatch && priceMatch[1]) {
            itemPrice = parseFloat(priceMatch[1]);
        }
    }
    
    const quantity = parseInt(quantityInput.value) || 1;
    const currentItemTotal = itemPrice * quantity;
    
    // Calculate cart total (if any items exist)
    let cartTotal = 0;
    if (cartItems.length > 0) {
        cartTotal = cartItems.reduce((sum, item) => sum + item.subtotal, 0);
    }
    
    // Display the appropriate total
    if (cartItems.length === 0) {
        // If cart is empty, show the current item's price
        summaryTotalPrice.textContent = currentItemTotal.toFixed(2);
    } else {
        // If cart has items, show the cart total
        summaryTotalPrice.textContent = cartTotal.toFixed(2);
    }
    
    console.log('Current item total:', currentItemTotal);
    console.log('Cart total:', cartTotal);
}

// Submit order functionality
function submitOrder() {
    if (cartItems.length === 0) {
        showAlert('Cart is empty. Please add items to cart.', 'red');
        return;
    }
    
    createOrder('pending');
}

// Submit order with payment
function submitOrderWithPayment() {
    if (cartItems.length === 0) {
        showAlert('Cart is empty. Please add items to cart.', 'red');
        return;
    }
    
    createOrder('completed');
}

// Create order with API
function createOrder(paymentStatus) {
    // Prepare order data
    const orderData = {
        items: cartItems.map(item => ({
            item_id: parseInt(item.itemId),
            quantity: item.quantity
        })),
        payment_status: paymentStatus
    };
    
    // Show confirmation popup
    const title = paymentStatus === 'completed' ? 'Confirm Order with Payment' : 'Confirm Order';
    const message = `Are you sure you want to place an order with ${cartItems.length} item(s)?`;
    const color = paymentStatus === 'completed' ? 'green' : 'red';
    
    showConfirmationPopup(title, message, color, () => {
        // Submit order
        fetch('/api/create-order', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(orderData)
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(data => {
                    throw new Error(data.detail || 'Failed to create order');
                });
            }
            return response.json();
        })
        .then(data => {
            // Show success message
            const successMessage = paymentStatus === 'completed' 
                ? 'Order placed successfully with payment!' 
                : 'Order placed successfully without payment!';
            
            showAlert(successMessage, color);
            
            // Reset cart
            cartItems = [];
            updateCartDisplay();
            
            // Reload page after a short delay
            setTimeout(() => {
                window.location.reload();
            }, 1500);
        })
        .catch(error => {
            console.error('Error creating order:', error);
            showAlert(error.message, 'red');
        });
    });
}

// Function to cancel an order via API
function cancelOrder(orderId) {
    // Show confirmation popup
    showConfirmationPopup(
        'Cancel Order',
        'Are you sure you want to cancel this order? This action cannot be undone.',
        'red',
        () => {
            // Proceed with cancellation
            fetch(`/api/cancel-order/${orderId}`, {
                method: 'POST'
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to cancel order: ' + response.status);
                }
                return response.json();
            })
            .then(data => {
                console.log('Cancel order response:', data);
                showAlert('Order cancelled successfully', 'green');
                // Reload the page after a short delay
                setTimeout(() => {
                    window.location.reload();
                }, 2000);
            })
            .catch(error => {
                console.error('Error cancelling order:', error);
                showAlert('Error cancelling order. Please try again.', 'red');
            });
        }
    );
}

// Function to show confirmation popup
function showConfirmationPopup(title, message, color, onConfirm) {
    // Get the popup container if it doesn't exist yet
    if (!popupContainer) {
        popupContainer = document.getElementById('popup-container');
        if (!popupContainer) {
            popupContainer = document.createElement('div');
            popupContainer.id = 'popup-container';
            document.body.appendChild(popupContainer);
        }
    }
    
    const popup = document.createElement('div');
    popup.className = 'popup confirmation';
    
    const popupContent = document.createElement('div');
    popupContent.className = `popup-content ${color}`;
    
    const popupHeader = document.createElement('div');
    popupHeader.className = 'popup-header';
    popupHeader.innerHTML = `<h3>${title}</h3>`;
    
    const popupBody = document.createElement('div');
    popupBody.className = 'popup-body';
    popupBody.innerHTML = `<p>${message}</p>`;
    
    const popupFooter = document.createElement('div');
    popupFooter.className = 'popup-footer';
    
    const confirmBtn = document.createElement('button');
    confirmBtn.className = `confirm-btn ${color}`;
    confirmBtn.textContent = 'Confirm';
    confirmBtn.addEventListener('click', function() {
        popupContainer.removeChild(popup);
        if (typeof onConfirm === 'function') {
            onConfirm();
        }
    });
    
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'cancel-btn';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', function() {
        popupContainer.removeChild(popup);
    });
    
    popupFooter.appendChild(confirmBtn);
    popupFooter.appendChild(cancelBtn);
    
    popupContent.appendChild(popupHeader);
    popupContent.appendChild(popupBody);
    popupContent.appendChild(popupFooter);
    
    popup.appendChild(popupContent);
    
    popupContainer.appendChild(popup);
}

// Function to show alert popup
function showAlert(message, color) {
    // Get the popup container if it doesn't exist yet
    if (!popupContainer) {
        popupContainer = document.getElementById('popup-container');
        if (!popupContainer) {
            popupContainer = document.createElement('div');
            popupContainer.id = 'popup-container';
            document.body.appendChild(popupContainer);
        }
    }
    
    const popup = document.createElement('div');
    popup.className = 'popup alert';

    const popupContent = document.createElement('div');
    popupContent.className = `popup-content ${color}`;

    const popupBody = document.createElement('div');
    popupBody.className = 'popup-body';
    popupBody.innerHTML = `<p>${message}</p>`;

    popupContent.appendChild(popupBody);
    popup.appendChild(popupContent);

    popupContainer.appendChild(popup);

    // Auto-dismiss after 3 seconds
    setTimeout(() => {
        if (popupContainer && popupContainer.contains(popup)) {
            popupContainer.removeChild(popup);
        }
    }, 3000);
}

// Keep sidebar expanded by default
const sidebar = document.querySelector('.sidebar');
if (sidebar) {
    sidebar.classList.remove('collapsed');
    document.querySelector('.main-container').classList.remove('expanded');
}
