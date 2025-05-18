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
            const orderId = form.getAttribute('data-order-id');
            showConfirmationPopup(
                'Cancel Order',
                'Are you sure you want to cancel this order? This action cannot be undone.',
                'red',
                () => {
                    cancelOrder(orderId);
                }
            );
        });
    });
    
    // Add event listeners to all modify buttons
    const modifyButtons = document.querySelectorAll('.modify-order-btn');
    modifyButtons.forEach(button => {
        button.addEventListener('click', function() {
            const orderId = button.getAttribute('data-order-id');
            showOrderModifyModal(orderId);
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
    if (historyToggle) {
        historyToggle.addEventListener('click', function() {
            // If we're not on the home page, we need to fetch the order history
            if (!historyModal || window.location.pathname !== '/') {
                fetchOrderHistory();
            } else {
                historyModal.style.display = 'block';
            }
        });
    }
    
    if (closeBtn) {
        closeBtn.addEventListener('click', function() {
            historyModal.style.display = 'none';
        });
    }
    
    // Close modal when clicking outside of it
    window.addEventListener('click', function(event) {
        const modal = document.getElementById('history-modal');
        if (event.target === modal) {
            modal.style.display = 'none';
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

// Function to cancel an order via API
function cancelOrder(orderId) {
    fetch(`/api/cancel-order/${orderId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to cancel order');
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            let message = 'Order cancelled successfully.';
            if (data.refund_needed) {
                message += ' A refund is needed for this order.';
            }
            showAlert(message, 'green');
            // Reload the page after a short delay
            setTimeout(() => {
                window.location.reload();
            }, 2000);
        } else {
            showAlert(data.message || 'Failed to cancel order', 'red');
        }
    })
    .catch(error => {
        console.error('Error cancelling order:', error);
        showAlert('Error cancelling order. Please try again.', 'red');
    });
}

// Function to show order modification modal
function showOrderModifyModal(orderId) {
    // First fetch the current order items
    fetch(`/api/orders/${orderId}/items`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to fetch order items');
            }
            return response.json();
        })
        .then(orderItems => {
            // Create modal for modifying order
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.id = 'modify-order-modal';
            
            // Create modal content
            const modalContent = document.createElement('div');
            modalContent.className = 'modal-content';
            
            // Create modal header
            const modalHeader = document.createElement('div');
            modalHeader.className = 'modal-header';
            modalHeader.innerHTML = `<h2>Modify Order #${orderId}</h2><span class="close">&times;</span>`;
            
            // Create modal body
            const modalBody = document.createElement('div');
            modalBody.className = 'modal-body';
            
            // Create form for order items
            const form = document.createElement('form');
            form.id = 'modify-order-form';
            form.innerHTML = `
                <div class="order-items-container">
                    <h3>Current Order Items</h3>
                    <div id="modify-items-list"></div>
                    <button type="button" id="add-item-to-order" class="btn-green">Add Item</button>
                </div>
                <div class="form-actions">
                    <button type="submit" class="btn-green">Save Changes</button>
                    <button type="button" class="btn-gray cancel-modal">Cancel</button>
                </div>
            `;
            
            modalBody.appendChild(form);
            modalContent.appendChild(modalHeader);
            modalContent.appendChild(modalBody);
            modal.appendChild(modalContent);
            
            // Add modal to the document
            document.body.appendChild(modal);
            
            // Populate the items list
            const itemsList = document.getElementById('modify-items-list');
            orderItems.forEach(item => {
                const itemRow = document.createElement('div');
                itemRow.className = 'modify-item-row';
                itemRow.dataset.itemId = item.item_id;
                itemRow.innerHTML = `
                    <div class="item-info">
                        <span class="item-name">${item.item_name}</span>
                        <span class="item-price">₹${item.unit_price.toFixed(2)}</span>
                    </div>
                    <div class="item-quantity">
                        <button type="button" class="quantity-btn decrease">-</button>
                        <input type="number" class="quantity-input" value="${item.quantity}" min="1" required>
                        <button type="button" class="quantity-btn increase">+</button>
                    </div>
                    <button type="button" class="remove-item-btn">×</button>
                `;
                itemsList.appendChild(itemRow);
                
                // Add event listeners for quantity buttons
                const decreaseBtn = itemRow.querySelector('.quantity-btn.decrease');
                const increaseBtn = itemRow.querySelector('.quantity-btn.increase');
                const quantityInput = itemRow.querySelector('.quantity-input');
                const removeBtn = itemRow.querySelector('.remove-item-btn');
                
                decreaseBtn.addEventListener('click', function() {
                    const currentValue = parseInt(quantityInput.value) || 1;
                    if (currentValue > 1) {
                        quantityInput.value = currentValue - 1;
                    }
                });
                
                increaseBtn.addEventListener('click', function() {
                    const currentValue = parseInt(quantityInput.value) || 1;
                    quantityInput.value = currentValue + 1;
                });
                
                removeBtn.addEventListener('click', function() {
                    itemRow.remove();
                });
            });
            
            // Show the modal
            modal.style.display = 'block';
            
            // Add event listener to close the modal
            const closeBtn = modal.querySelector('.close');
            const cancelBtn = modal.querySelector('.cancel-modal');
            
            closeBtn.addEventListener('click', function() {
                document.body.removeChild(modal);
            });
            
            cancelBtn.addEventListener('click', function() {
                document.body.removeChild(modal);
            });
            
            // Add event listener for the add item button
            const addItemBtn = document.getElementById('add-item-to-order');
            addItemBtn.addEventListener('click', function() {
                // Show a dropdown of available items
                showAddItemDropdown(orderId, modal);
            });
            
            // Add event listener for the form submission
            form.addEventListener('submit', function(e) {
                e.preventDefault();
                modifyOrder(orderId, modal);
            });
        })
        .catch(error => {
            console.error('Error fetching order items:', error);
            showAlert('Error fetching order items. Please try again.', 'red');
        });
}

// Function to show add item dropdown
function showAddItemDropdown(orderId, modal) {
    // Fetch all available items
    fetch('/api/items')
        .then(response => response.json())
        .then(items => {
            // Create dropdown container
            const dropdown = document.createElement('div');
            dropdown.className = 'add-item-dropdown';
            dropdown.innerHTML = `
                <div class="dropdown-header">
                    <h3>Add Item to Order</h3>
                    <span class="close">&times;</span>
                </div>
                <div class="dropdown-body">
                    <div class="search-container">
                        <input type="text" id="item-search" placeholder="Search items...">
                    </div>
                    <div class="items-list scrollable"></div>
                </div>
            `;
            
            // Add dropdown to modal body
            const modalBody = modal.querySelector('.modal-body');
            modalBody.appendChild(dropdown);
            
            // Populate items list
            const itemsList = dropdown.querySelector('.items-list');
            items.forEach(item => {
                const itemElement = document.createElement('div');
                itemElement.className = 'dropdown-item';
                itemElement.innerHTML = `
                    <div class="item-info">
                        <span class="item-name">${item.item_name}</span>
                        <span class="item-price">₹${item.price_per_quantity.toFixed(2)}</span>
                    </div>
                    <button type="button" class="add-btn">Add</button>
                `;
                itemsList.appendChild(itemElement);
                
                // Add event listener to add button
                const addBtn = itemElement.querySelector('.add-btn');
                addBtn.addEventListener('click', function() {
                    addItemToModifyForm(item, orderId);
                    modalBody.removeChild(dropdown);
                });
            });
            
            // Add event listener to search input
            const searchInput = dropdown.querySelector('#item-search');
            searchInput.addEventListener('input', function() {
                const searchValue = this.value.toLowerCase();
                const itemElements = itemsList.querySelectorAll('.dropdown-item');
                
                itemElements.forEach(element => {
                    const itemName = element.querySelector('.item-name').textContent.toLowerCase();
                    if (itemName.includes(searchValue)) {
                        element.style.display = 'flex';
                    } else {
                        element.style.display = 'none';
                    }
                });
            });
            
            // Add event listener to close button
            const closeBtn = dropdown.querySelector('.close');
            closeBtn.addEventListener('click', function() {
                modalBody.removeChild(dropdown);
            });
        })
        .catch(error => {
            console.error('Error fetching items:', error);
            showAlert('Error fetching items. Please try again.', 'red');
        });
}

// Function to add an item to the modify form
function addItemToModifyForm(item, orderId) {
    const itemsList = document.getElementById('modify-items-list');
    
    // Check if item already exists in the list
    const existingItem = itemsList.querySelector(`[data-item-id="${item.id}"]`);
    if (existingItem) {
        // Increase quantity if item already exists
        const quantityInput = existingItem.querySelector('.quantity-input');
        const currentValue = parseInt(quantityInput.value) || 1;
        quantityInput.value = currentValue + 1;
        return;
    }
    
    // Create new item row
    const itemRow = document.createElement('div');
    itemRow.className = 'modify-item-row';
    itemRow.dataset.itemId = item.id;
    itemRow.innerHTML = `
        <div class="item-info">
            <span class="item-name">${item.item_name}</span>
            <span class="item-price">₹${item.price_per_quantity.toFixed(2)}</span>
        </div>
        <div class="item-quantity">
            <button type="button" class="quantity-btn decrease">-</button>
            <input type="number" class="quantity-input" value="1" min="1" required>
            <button type="button" class="quantity-btn increase">+</button>
        </div>
        <button type="button" class="remove-item-btn">×</button>
    `;
    itemsList.appendChild(itemRow);
    
    // Add event listeners for quantity buttons
    const decreaseBtn = itemRow.querySelector('.quantity-btn.decrease');
    const increaseBtn = itemRow.querySelector('.quantity-btn.increase');
    const quantityInput = itemRow.querySelector('.quantity-input');
    const removeBtn = itemRow.querySelector('.remove-item-btn');
    
    decreaseBtn.addEventListener('click', function() {
        const currentValue = parseInt(quantityInput.value) || 1;
        if (currentValue > 1) {
            quantityInput.value = currentValue - 1;
        }
    });
    
    increaseBtn.addEventListener('click', function() {
        const currentValue = parseInt(quantityInput.value) || 1;
        quantityInput.value = currentValue + 1;
    });
    
    removeBtn.addEventListener('click', function() {
        itemRow.remove();
    });
}

// Function to fetch order history and display it in a modal
function fetchOrderHistory() {
    // Create modal if it doesn't exist
    let historyModal = document.getElementById('history-modal');
    if (!historyModal) {
        historyModal = document.createElement('div');
        historyModal.id = 'history-modal';
        historyModal.className = 'modal';
        
        // Create modal content
        historyModal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Order History</h2>
                    <span class="close">&times;</span>
                </div>
                <div class="modal-body">
                    <div id="history-content" class="orders-list scrollable">
                        <p class="loading">Loading order history...</p>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(historyModal);
        
        // Add event listener to close button
        const closeBtn = historyModal.querySelector('.close');
        closeBtn.addEventListener('click', function() {
            historyModal.style.display = 'none';
        });
    }
    
    // Show the modal
    historyModal.style.display = 'block';
    
    // Get the history content container
    const historyContent = document.getElementById('history-content');
    historyContent.innerHTML = '<p class="loading">Loading order history...</p>';
    
    // Fetch order history from API
    fetch('/api/orders')
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to fetch order history');
            }
            return response.json();
        })
        .then(orders => {
            // Sort orders by date (newest first)
            orders.sort((a, b) => {
                return new Date(b.order_date) - new Date(a.order_date);
            });
            
            // Display orders
            if (orders.length === 0) {
                historyContent.innerHTML = '<p class="no-orders">No order history yet.</p>';
                return;
            }
            
            // Create HTML for orders
            let ordersHTML = '';
            orders.forEach(order => {
                const orderDate = formatDate(order.order_date);
                const paymentDate = order.payment_date ? formatDate(order.payment_date) : 'N/A';
                
                // Determine status class
                let statusClass = '';
                if (order.payment_status === 'completed') {
                    statusClass = 'completed';
                } else if (order.payment_status === 'pending') {
                    statusClass = 'pending';
                } else if (order.payment_status === 'cancelled') {
                    statusClass = 'cancelled';
                }
                
                // Create order items HTML
                let itemsHTML = '';
                if (order.items && order.items.length > 0) {
                    order.items.forEach(item => {
                        itemsHTML += `
                            <li>
                                ${item.item_name} - ${item.quantity} x ₹${item.unit_price.toFixed(2)} = ₹${item.subtotal.toFixed(2)}
                            </li>
                        `;
                    });
                } else {
                    itemsHTML = '<li>No item details available</li>';
                }
                
                // Create order card HTML
                ordersHTML += `
                    <div class="order-card">
                        <div class="order-header">
                            <h3>Order #${order.id}</h3>
                            <span class="date">Order: ${orderDate}</span>
                        </div>
                        <div class="order-details">
                            <p>Total: ₹${order.total_price.toFixed(2)}</p>
                            <p class="order-date-display">Order Date: ${orderDate}</p>
                            <p class="status ${statusClass}">Payment: ${capitalizeFirstLetter(order.payment_status)}</p>
                            ${order.payment_status === 'completed' ? `<p class="payment-date-display">Paid on: ${paymentDate}</p>` : ''}
                            
                            <div class="order-items-details">
                                <h4>Order Items:</h4>
                                <ul class="order-items-list">
                                    ${itemsHTML}
                                </ul>
                            </div>
                        </div>
                    </div>
                `;
            });
            
            historyContent.innerHTML = ordersHTML;
        })
        .catch(error => {
            console.error('Error fetching order history:', error);
            historyContent.innerHTML = '<p class="error">Error loading order history. Please try again.</p>';
        });
}

// Function to modify an order via API
function modifyOrder(orderId, modal) {
    // Collect all items from the form
    const itemRows = document.querySelectorAll('.modify-item-row');
    const items = [];
    
    itemRows.forEach(row => {
        const itemId = parseInt(row.dataset.itemId);
        const quantity = parseInt(row.querySelector('.quantity-input').value) || 1;
        
        items.push({
            item_id: itemId,
            quantity: quantity
        });
    });
    
    // If no items, show error
    if (items.length === 0) {
        showAlert('Order must contain at least one item', 'red');
        return;
    }
    
    // Send request to modify order
    fetch(`/api/modify-order/${orderId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(items)
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(data => {
                throw new Error(data.detail || 'Failed to modify order');
            });
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            showAlert(data.message || 'Order modified successfully', 'green');
            // Remove the modal
            document.body.removeChild(modal);
            // Reload the page after a short delay
            setTimeout(() => {
                window.location.reload();
            }, 2000);
        } else {
            showAlert(data.message || 'Failed to modify order', 'red');
        }
    })
    .catch(error => {
        console.error('Error modifying order:', error);
        showAlert(error.message || 'Error modifying order. Please try again.', 'red');
    });
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
