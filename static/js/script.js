// Global variables
let popupContainer;
let items = [];
let cartItems = [];

document.addEventListener('DOMContentLoaded', function() {
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
    
    // History modal elements
    const historyToggle = document.getElementById('history-toggle');
    const historyModal = document.getElementById('history-modal');
    const closeBtn = document.querySelector('.close');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebar = document.querySelector('.sidebar');
    
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
            showConfirmationPopup(
                'Cancel Order',
                'Are you sure you want to cancel this order? This action cannot be undone.',
                'red',
                () => {
                    form.submit();
                }
            );
        });
    });
    
    // Sidebar toggle
    if (sidebarToggle && sidebar) {
        sidebarToggle.addEventListener('click', function() {
            sidebar.classList.toggle('collapsed');
            document.querySelector('.main-container').classList.toggle('expanded');
        });
    }
    
    // Search input with debounce
    let debounceTimeout;
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            clearTimeout(debounceTimeout);
            const query = this.value.trim();
            
            if (query.length < 2) {
                searchResults.classList.remove('active');
                return;
            }
            
            debounceTimeout = setTimeout(() => {
                fetchSearchResults(query);
            }, 300);
        });
        
        document.addEventListener('click', function(e) {
            if (!searchInput.contains(e.target) && searchResults && !searchResults.contains(e.target)) {
                searchResults.classList.remove('active');
            }
        });
    }
    
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
        searchResults.innerHTML = '';
        
        if (items.length === 0) {
            searchResults.innerHTML = '<div class="search-item">No items found</div>';
            searchResults.classList.add('active');
            return;
        }
        
        items.forEach(item => {
            const div = document.createElement('div');
            div.className = 'search-item';
            div.innerHTML = `
                ${item.item_name} - ₹${item.price_per_quantity.toFixed(2)}
                ${item.remaining_quantity !== null ? `(${item.remaining_quantity} in stock)` : ''}
            `;
            
            div.addEventListener('click', function() {
                selectItemFromSearch(item);
            });
            
            searchResults.appendChild(div);
        });
        
        searchResults.classList.add('active');
    }
    
    // Function to select an item from search results
    function selectItemFromSearch(item) {
        // Set the item in the dropdown
        itemSelect.value = item.id;
        
        // Set default quantity to 1
        quantityInput.value = 1;
        
        // Update the order summary
        updateOrderSummary();
        
        // Hide search results
        searchResults.classList.remove('active');
        
        // Clear search input
        searchInput.value = '';
    }
    
    // Fetch all items on page load
    if (itemSelect) {
        fetch('/api/items')
            .then(response => response.json())
            .then(data => {
                items = data;
                console.log('Items loaded:', items.length);
                
                // Initialize the order summary if an item is selected
                if (itemSelect.value) {
                    updateOrderSummary();
                }
            })
            .catch(error => console.error('Error fetching items:', error));
    }
    
    // Add item to cart functionality
    function addToCart() {
        if (!itemSelect || !quantityInput) {
            console.error('Required DOM elements not found');
            return;
        }
        
        const selectedItemId = itemSelect.value;
        if (!selectedItemId) {
            showAlert('Please select an item first', 'red');
            return;
        }
        
        // Make sure items are loaded
        if (!items || items.length === 0) {
            showAlert('Loading items, please try again in a moment', 'red');
            return;
        }
        
        const quantity = parseInt(quantityInput.value) || 1;
        if (quantity <= 0) {
            showAlert('Quantity must be greater than 0', 'red');
            return;
        }
        
        const selectedOption = itemSelect.options[itemSelect.selectedIndex];
        if (!selectedOption || !selectedOption.dataset) {
            showAlert('Error getting item details', 'red');
            return;
        }
        
        const itemName = selectedOption.dataset.name;
        const unitPrice = parseFloat(selectedOption.dataset.price);
        const stock = parseInt(selectedOption.dataset.stock);
        
        if (!itemName || isNaN(unitPrice)) {
            showAlert('Invalid item data', 'red');
            return;
        }
        
        // Check if there's enough stock
        if (stock !== null && stock !== undefined && stock < quantity) {
            showAlert(`Not enough stock. Only ${stock} available.`, 'red');
            return;
        }
        
        // Check if item already exists in cart
        const existingItemIndex = cartItems.findIndex(item => item.itemId == selectedItemId);
        
        if (existingItemIndex !== -1) {
            // Update existing item quantity
            cartItems[existingItemIndex].quantity += quantity;
            cartItems[existingItemIndex].subtotal = cartItems[existingItemIndex].quantity * cartItems[existingItemIndex].unitPrice;
        } else {
            // Add new item to cart
            cartItems.push({
                itemId: selectedItemId,
                itemName: itemName,
                quantity: quantity,
                unitPrice: unitPrice,
                subtotal: unitPrice * quantity
            });
        }
        
        // Update cart display
        updateCartDisplay();
        
        // Show success message
        showAlert('Item added to cart', 'green');
        
        // Reset form
        quantityInput.value = 1;
        itemSelect.selectedIndex = 0;
        
        showAlert('Item added to cart', 'green');
    }

    // Update cart display
    function updateCartDisplay() {
        // Clear cart items list
        cartItemsList.innerHTML = '';
        
        if (cartItems.length === 0) {
            emptyCartMessage.style.display = 'block';
            summaryTotalPrice.textContent = '0.00';
            return;
        }
        
        emptyCartMessage.style.display = 'none';
        
        // Calculate total price
        let totalPrice = 0;
        
        // Add each item to the cart display
        cartItems.forEach((item, index) => {
            const cartItemElement = document.createElement('div');
            cartItemElement.className = 'cart-item';
            
            const cartItemInfo = document.createElement('div');
            cartItemInfo.className = 'cart-item-info';
            cartItemInfo.innerHTML = `
                <p><strong>${item.itemName}</strong></p>
                <p>${item.quantity} x ₹${item.unitPrice.toFixed(2)} = ₹${item.subtotal.toFixed(2)}</p>
            `;
            
            const cartItemActions = document.createElement('div');
            cartItemActions.className = 'cart-item-actions';
            
            const removeButton = document.createElement('button');
            removeButton.className = 'remove-item-btn';
            removeButton.textContent = 'Remove';
            removeButton.addEventListener('click', () => removeFromCart(index));
            
            cartItemActions.appendChild(removeButton);
            cartItemElement.appendChild(cartItemInfo);
            cartItemElement.appendChild(cartItemActions);
            
            cartItemsList.appendChild(cartItemElement);
            
            totalPrice += item.subtotal;
        });
        
        // Update total price
        summaryTotalPrice.textContent = totalPrice.toFixed(2);
    }

    // Remove item from cart
    function removeFromCart(index) {
        cartItems.splice(index, 1);
        updateCartDisplay();
        showAlert('Item removed from cart', 'gray');
    };

    // Update order summary functionality
    function updateOrderSummary() {
        if (!itemSelect || !quantityInput) return;
        
        const itemId = itemSelect.value;
        
        // If quantity is empty, set it to 1
        if (!quantityInput.value) {
            quantityInput.value = 1;
        }
        
        const quantity = parseInt(quantityInput.value) || 1;
        
        if (!itemId) {
            if (summaryTotalPrice) summaryTotalPrice.textContent = '0.00';
            return;
        }
        
        // Make sure items are loaded
        if (!items || items.length === 0) {
            console.log('Items not loaded yet');
            return;
        }
        
        // Find the selected item
        const selectedItem = items.find(item => item.id == itemId);
        if (!selectedItem) {
            console.log('Selected item not found:', itemId);
            return;
        }
        
        // Calculate total price
        const totalPrice = selectedItem.price_per_quantity * quantity;
        
        // Update the summary total price if the element exists
        if (summaryTotalPrice) {
            summaryTotalPrice.textContent = totalPrice.toFixed(2);
        }
    }
    
    // Submit order functionality
    function submitOrder() {
        if (cartItems.length === 0) {
            showAlert('Your cart is empty. Please add items to your order.', 'red');
            return;
        }
        
        createOrder('pending');
    }

    // Submit order with payment
    function submitOrderWithPayment() {
        if (cartItems.length === 0) {
            showAlert('Your cart is empty. Please add items to your order.', 'red');
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
    
    // Initialize the order summary on page load
    if (itemSelect && itemSelect.value) {
        updateOrderSummary();
    }
    
    // History modal functionality
    historyToggle.addEventListener('click', function() {
        historyModal.style.display = 'block';
    });
    
    closeBtn.addEventListener('click', function() {
        historyModal.style.display = 'none';
    });
    
    // Close modal when clicking outside of it
    window.addEventListener('click', function(event) {
        if (event.target === historyModal) {
            historyModal.style.display = 'none';
        }
    });
    
    // Keep sidebar expanded by default inside DOMContentLoaded
    if (sidebar) {
        sidebar.classList.remove('collapsed');
        document.querySelector('.main-container').classList.remove('expanded');
    }
    
    // Use the global showConfirmationPopup and showAlert functions
});

// Get sidebar element
const sidebar = document.querySelector('.sidebar');

// Keep sidebar expanded by default
if (sidebar) {
    sidebar.classList.remove('collapsed');
    document.querySelector('.main-container').classList.remove('expanded');
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
    popup.className = 'popup';

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

    const confirmButton = document.createElement('button');
    confirmButton.className = `btn-${color}`;
    confirmButton.textContent = 'Confirm';
    confirmButton.addEventListener('click', () => {
        popupContainer.removeChild(popup);
        if (onConfirm) onConfirm();
    });

    const cancelButton = document.createElement('button');
    cancelButton.className = 'btn-gray';
    cancelButton.textContent = 'Cancel';
    cancelButton.addEventListener('click', () => {
        popupContainer.removeChild(popup);
    });

    popupFooter.appendChild(confirmButton);
    popupFooter.appendChild(cancelButton);

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
