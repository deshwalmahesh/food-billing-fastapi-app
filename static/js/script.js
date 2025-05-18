document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const orderForm = document.getElementById('order-form');
    const itemSelect = document.getElementById('item-select');
    const searchInput = document.querySelector('.search-form input[name="search"]');
    const searchResults = document.getElementById('search-results');
    const quantityInput = document.getElementById('quantity');
    const priceDisplay = document.getElementById('price-display');
    const summaryItem = document.getElementById('summary-item');
    const summaryQuantity = document.getElementById('summary-quantity');
    const summaryPricePerUnit = document.getElementById('summary-price-per-unit');
    const summaryTotalPrice = document.getElementById('summary-total-price');
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
    let popupContainer = document.getElementById('popup-container');
    if (!popupContainer) {
        popupContainer = document.createElement('div');
        popupContainer.id = 'popup-container';
        document.body.appendChild(popupContainer);
    }
    
    // Event Listeners
    itemSelect.addEventListener('change', updateOrderSummary);
    quantityInput.addEventListener('input', updateOrderSummary);
    orderForm.addEventListener('submit', submitOrder);
    
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
    quantityInput.addEventListener('blur', function() {
        if (!this.value || parseInt(this.value) < 1) {
            this.value = 1;
            updateOrderSummary();
        }
    });
    
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
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', function() {
            sidebar.classList.toggle('collapsed');
            document.querySelector('.main-container').classList.toggle('expanded');
        });
    }
    
    // Search input with debounce
    let debounceTimeout;
    searchInput.addEventListener('input', function() {
        clearTimeout(debounceTimeout);
        const query = this.value.trim();
        
        if (query.length < 2) {
            searchResults.classList.remove('active');
            return;
        }
        
        debounceTimeout = setTimeout(() => {
            fetchSearchResults(query);
        }, 300); // 300ms debounce
    });
    
    // Hide search results when clicking outside
    document.addEventListener('click', function(e) {
        if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
            searchResults.classList.remove('active');
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
    
    // Item data
    let items = [];
    
    // Fetch all items on page load
    fetch('/api/items')
        .then(response => response.json())
        .then(data => {
            items = data;
            // Initialize order summary if an item is already selected
            if (itemSelect.value) {
                updateOrderSummary();
            }
        })
        .catch(error => console.error('Error fetching items:', error));
    
    // Update order summary functionality
    function updateOrderSummary() {
        const itemId = itemSelect.value;
        
        // If quantity is empty, set it to 1
        if (!quantityInput.value) {
            quantityInput.value = 1;
        }
        
        const quantity = quantityInput.value;
        
        if (!itemId) {
            return;
        }
        
        // Find the selected item
        const selectedItem = items.find(item => item.id == itemId);
        if (!selectedItem) {
            return;
        }
        
        // Update the order summary
        summaryItem.textContent = selectedItem.item_name;
        summaryQuantity.textContent = quantity;
        summaryPricePerUnit.textContent = selectedItem.price_per_quantity.toFixed(2);
        
        const totalPrice = selectedItem.price_per_quantity * quantity;
        summaryTotalPrice.textContent = totalPrice.toFixed(2);
    }
    
    // Submit order functionality
    function submitOrder(e) {
        e.preventDefault();
        
        const itemId = itemSelect.value;
        let quantity = quantityInput.value;
        
        if (!itemId) {
            showAlert('Please select an item', 'red');
            return;
        }
        
        // Set quantity to 1 if it's not valid
        if (!quantity || quantity < 1) {
            quantity = 1;
            quantityInput.value = 1;
        }
        
        // Get the button that was clicked
        const clickedButton = document.activeElement;
        const paymentStatus = clickedButton.value;
        const selectedItem = items.find(item => item.id == itemId);
        
        // Prepare confirmation message and color
        let title, message, color;
        if (paymentStatus === 'completed') {
            title = 'Order With Payment';
            message = `Are you sure you want to place an order for ${quantity} ${selectedItem.item_name}(s) with payment?`;
            color = 'green';
        } else {
            title = 'Order Without Payment';
            message = `Are you sure you want to place an order for ${quantity} ${selectedItem.item_name}(s) without payment?`;
            color = 'red';
        }
        
        // Show confirmation popup
        showConfirmationPopup(title, message, color, () => {
            // Create form data manually to ensure all fields are included
            const formData = new FormData();
            formData.append('item_id', itemId);
            formData.append('quantity', quantity);
            formData.append('payment_status', paymentStatus);
            
            fetch('/api/create-order', {
                method: 'POST',
                body: formData
            })
            .then(response => {
                if (!response.ok) {
                    if (response.status === 422) {
                        return response.json().then(err => { 
                            console.error('Validation error:', err);
                            throw new Error('Form validation error. Check that all required fields are provided.');
                        });
                    }
                    return response.json().then(err => { throw new Error(err.detail || 'Error creating order'); });
                }
                return response;
            })
            .then(() => {
                // Show success message before redirecting
                showAlert(`Order for ${quantity} ${selectedItem.item_name}(s) placed successfully!`, 'green');
                setTimeout(() => {
                    window.location.href = '/';
                }, 1500);
            })
            .catch(error => {
                showAlert(error.message, 'red');
                console.error('Error:', error);
            });
        });
    }
    
    // Initialize the order summary on page load
    if (itemSelect.value) {
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
    
    // Keep sidebar expanded by default
    if (sidebar) {
        sidebar.classList.remove('collapsed');
        document.querySelector('.main-container').classList.remove('expanded');
    }
    
    // Function to show confirmation popup
    function showConfirmationPopup(title, message, color, onConfirm) {
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
            if (popupContainer.contains(popup)) {
                popupContainer.removeChild(popup);
            }
        }, 3000);
    }
});

// Keep sidebar expanded by default
if (sidebar) {
    sidebar.classList.remove('collapsed');
    document.querySelector('.main-container').classList.remove('expanded');
}

// Initialize with collapsed sidebar on mobile
if (sidebar) {
    sidebar.classList.remove('collapsed');
    document.querySelector('.main-container').classList.remove('expanded');
}

// Function to show confirmation popup
function showConfirmationPopup(title, message, color, onConfirm) {
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
        if (popupContainer.contains(popup)) {
            popupContainer.removeChild(popup);
        }
    }, 3000);
}
