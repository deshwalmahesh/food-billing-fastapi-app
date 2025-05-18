// Functions for order modification and payment calculation

// Add event listeners when the DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Add event listeners to all modify buttons
    const modifyButtons = document.querySelectorAll('.modify-order-btn');
    modifyButtons.forEach(button => {
        button.addEventListener('click', function() {
            const orderId = button.getAttribute('data-order-id');
            showOrderModifyModal(orderId);
        });
    });
});

// Function to show order modification modal
function showOrderModifyModal(orderId) {
    // Create modal container
    const modal = document.createElement('div');
    modal.className = 'modify-order-modal';
    document.body.appendChild(modal);
    
    // Fetch order details
    fetch(`/api/orders/${orderId}/items`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to fetch order items');
            }
            return response.json();
        })
        .then(orderItems => {
            // Get original total price
            const originalTotal = orderItems.reduce((sum, item) => sum + item.subtotal, 0);
            
            // Create modal content
            modal.innerHTML = `
                <div class="modify-order-content">
                    <div class="modify-order-header">
                        <h2>Modify Order #${orderId}</h2>
                        <span class="modify-close">&times;</span>
                    </div>
                    <div class="modify-order-body">
                        <div class="modify-items-list">
                            ${orderItems.length > 0 ? 
                                orderItems.map(item => `
                                    <div class="modify-item-row" data-item-id="${item.item_id}" data-original-quantity="${item.quantity}" data-unit-price="${item.unit_price}">
                                        <div class="modify-item-info">
                                            <span class="modify-item-name">${item.item_name}</span>
                                            <span class="modify-item-price">₹${item.unit_price.toFixed(2)}</span>
                                        </div>
                                        <div class="modify-item-actions">
                                            <div class="modify-quantity-input-container">
                                                <button type="button" class="quantity-btn decrease">-</button>
                                                <input type="number" class="quantity-input" min="1" value="${item.quantity}">
                                                <button type="button" class="quantity-btn increase">+</button>
                                            </div>
                                            <button type="button" class="remove-item-btn" data-item-id="${item.item_id}">Remove</button>
                                        </div>
                                    </div>
                                `).join('') : 
                                '<p>No items in this order</p>'
                            }
                        </div>
                        <button type="button" class="add-item-btn">+ Add Item</button>
                        <div class="modify-order-summary">
                            <h3>Order Summary</h3>
                            <p class="total">Total Price: ₹<span class="modify-total-price">0.00</span></p>
                            <div class="payment-calculation">
                                <p>Original Total: ₹<span class="original-total">${originalTotal.toFixed(2)}</span></p>
                                <p>New Total: ₹<span class="new-total">0.00</span></p>
                                <p class="payment-difference"></p>
                            </div>
                        </div>
                        <div class="modify-order-buttons">
                            <button type="button" class="save-changes-btn">Save Changes</button>
                            <button type="button" class="cancel-changes-btn">Cancel</button>
                        </div>
                    </div>
                </div>
            `;
            
            // Add event listeners for quantity buttons
            const decreaseButtons = modal.querySelectorAll('.quantity-btn.decrease');
            const increaseButtons = modal.querySelectorAll('.quantity-btn.increase');
            const quantityInputs = modal.querySelectorAll('.quantity-input');
            const removeButtons = modal.querySelectorAll('.remove-item-btn');
            
            decreaseButtons.forEach(button => {
                button.addEventListener('click', function() {
                    const input = this.parentNode.querySelector('.quantity-input');
                    const currentValue = parseInt(input.value) || 1;
                    if (currentValue > 1) {
                        input.value = currentValue - 1;
                        updateModifyTotal(modal);
                    }
                });
            });
            
            increaseButtons.forEach(button => {
                button.addEventListener('click', function() {
                    const input = this.parentNode.querySelector('.quantity-input');
                    const currentValue = parseInt(input.value) || 1;
                    input.value = currentValue + 1;
                    updateModifyTotal(modal);
                });
            });
            
            quantityInputs.forEach(input => {
                input.addEventListener('change', function() {
                    if (parseInt(this.value) < 1) {
                        this.value = 1;
                    }
                    updateModifyTotal(modal);
                });
            });
            
            removeButtons.forEach(button => {
                button.addEventListener('click', function() {
                    const row = this.closest('.modify-item-row');
                    if (row) {
                        // Check if this is the last item
                        const itemRows = modal.querySelectorAll('.modify-item-row');
                        if (itemRows.length <= 1) {
                            // Don't allow removing the last item, just set quantity to 1
                            const quantityInput = row.querySelector('.quantity-input');
                            if (quantityInput) {
                                quantityInput.value = 1;
                                showAlert('Cannot remove the last item from an order', 'red');
                            }
                        } else {
                            // Safe to remove this item
                            row.remove();
                        }
                        updateModifyTotal(modal);
                    }
                });
            });
            
            // Initial calculation of totals
            updateModifyTotal(modal);
            
            // Add event listener to close the modal
            const closeBtn = modal.querySelector('.modify-close');
            const cancelBtn = modal.querySelector('.cancel-changes-btn');
            
            closeBtn.addEventListener('click', function() {
                document.body.removeChild(modal);
            });
            
            cancelBtn.addEventListener('click', function() {
                document.body.removeChild(modal);
            });
            
            // Add event listener for the add item button
            const addItemBtn = modal.querySelector('.add-item-btn');
            addItemBtn.addEventListener('click', function() {
                // Show a dropdown of available items
                showAddItemDropdown(orderId, modal);
            });
            
            // Add event listener for the save changes button
            const saveChangesBtn = modal.querySelector('.save-changes-btn');
            saveChangesBtn.addEventListener('click', function() {
                modifyOrder(orderId, modal);
            });
        })
        .catch(error => {
            console.error('Error fetching order items:', error);
            modal.innerHTML = `<div class="error-message">Error: ${error.message}</div>`;
        });
}

// Function to update the total in the modify form
function updateModifyTotal(modal) {
    const itemRows = modal.querySelectorAll('.modify-item-row');
    let total = 0;
    
    itemRows.forEach(row => {
        const quantity = parseInt(row.querySelector('.quantity-input').value) || 0;
        const price = parseFloat(row.querySelector('.modify-item-price').textContent.replace('₹', '')) || 0;
        total += quantity * price;
    });
    
    const totalElement = modal.querySelector('.modify-total-price');
    if (totalElement) {
        totalElement.textContent = total.toFixed(2);
    }
    
    // Calculate payment difference
    const originalTotal = parseFloat(modal.querySelector('.original-total').textContent) || 0;
    const newTotal = total;
    const difference = newTotal - originalTotal;
    
    const newTotalElement = modal.querySelector('.new-total');
    if (newTotalElement) {
        newTotalElement.textContent = newTotal.toFixed(2);
    }
    
    const paymentDifferenceElement = modal.querySelector('.payment-difference');
    if (paymentDifferenceElement) {
        if (difference > 0) {
            paymentDifferenceElement.textContent = `Customer needs to pay: ₹${difference.toFixed(2)}`;
            paymentDifferenceElement.className = 'payment-difference customer-pays';
        } else if (difference < 0) {
            paymentDifferenceElement.textContent = `Refund to customer: ₹${Math.abs(difference).toFixed(2)}`;
            paymentDifferenceElement.className = 'payment-difference refund-customer';
        } else {
            paymentDifferenceElement.textContent = 'No payment adjustment needed';
            paymentDifferenceElement.className = 'payment-difference no-change';
        }
    }
}

// Function to show add item dropdown
function showAddItemDropdown(orderId, modal) {
    // Fetch all available items
    fetch('/api/items')
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to fetch items');
            }
            return response.json();
        })
        .then(items => {
            // Create dropdown container
            const dropdown = document.createElement('div');
            dropdown.className = 'add-item-dropdown';
            dropdown.innerHTML = `
                <div class="dropdown-header">
                    <h3>Add Item</h3>
                    <span class="close-dropdown">&times;</span>
                </div>
                <div class="dropdown-items-list"></div>
            `;
            
            // Add dropdown to modal body
            const modalBody = modal.querySelector('.modify-order-body');
            modalBody.appendChild(dropdown);
            
            // Populate items list
            const itemsList = dropdown.querySelector('.dropdown-items-list');
            
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
                    addItemToModifyForm(item, orderId, modal);
                    modalBody.removeChild(dropdown);
                });
            });
            
            // Add event listener to close dropdown
            const closeBtn = dropdown.querySelector('.close-dropdown');
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
function addItemToModifyForm(item, orderId, modal) {
    const itemsList = modal.querySelector('.modify-items-list');
    
    // Check if item already exists in the list
    const existingItem = itemsList.querySelector(`[data-item-id="${item.id}"]`);
    if (existingItem) {
        const quantityInput = existingItem.querySelector('.quantity-input');
        const currentValue = parseInt(quantityInput.value) || 1;
        quantityInput.value = currentValue + 1;
        updateModifyTotal(modal);
        return;
    }
    
    // Create new item row
    const itemRow = document.createElement('div');
    itemRow.className = 'modify-item-row';
    itemRow.dataset.itemId = item.id;
    itemRow.dataset.originalQuantity = 0;
    itemRow.dataset.unitPrice = item.price_per_quantity;
    itemRow.innerHTML = `
        <div class="modify-item-info">
            <span class="modify-item-name">${item.item_name}</span>
            <span class="modify-item-price">₹${item.price_per_quantity.toFixed(2)}</span>
        </div>
        <div class="modify-item-actions">
            <div class="modify-quantity-input-container">
                <button type="button" class="quantity-btn decrease">-</button>
                <input type="number" class="quantity-input" min="1" value="1">
                <button type="button" class="quantity-btn increase">+</button>
            </div>
            <button type="button" class="remove-item-btn" data-item-id="${item.id}">Remove</button>
        </div>
    `;
    itemsList.appendChild(itemRow);
    
    // Add event listeners
    const decreaseBtn = itemRow.querySelector('.quantity-btn.decrease');
    const increaseBtn = itemRow.querySelector('.quantity-btn.increase');
    const quantityInput = itemRow.querySelector('.quantity-input');
    const removeBtn = itemRow.querySelector('.remove-item-btn');
    
    decreaseBtn.addEventListener('click', function() {
        const currentValue = parseInt(quantityInput.value) || 1;
        if (currentValue > 1) {
            quantityInput.value = currentValue - 1;
            updateModifyTotal(modal);
        }
    });
    
    increaseBtn.addEventListener('click', function() {
        const currentValue = parseInt(quantityInput.value) || 1;
        quantityInput.value = currentValue + 1;
        updateModifyTotal(modal);
    });
    
    quantityInput.addEventListener('change', function() {
        if (parseInt(this.value) < 1) {
            this.value = 1;
        }
        updateModifyTotal(modal);
    });
    
    removeBtn.addEventListener('click', function() {
        itemRow.remove();
        updateModifyTotal(modal);
    });
    
    // Update totals
    updateModifyTotal(modal);
}

// Function to modify an order via API
function modifyOrder(orderId, modal) {
    // Collect all items from the form
    const itemRows = modal.querySelectorAll('.modify-item-row');
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
            let message = data.message || 'Order modified successfully';
            
            // Add payment information to the message if available
            if (data.payment_message) {
                message += `. ${data.payment_message}`;
            }
            
            showAlert(message, 'green');
            
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
