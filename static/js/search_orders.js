document.addEventListener('DOMContentLoaded', function() {
    // Get form and results elements
    const searchForm = document.getElementById('search-orders-form');
    const searchResults = document.getElementById('search-results');
    const resultsCount = document.getElementById('results-count');
    const resetButton = document.getElementById('reset-search');
    const filterToggle = document.getElementById('filter-toggle');
    const searchFilters = document.getElementById('search-filters');
    const quickSearchAllBtn = document.getElementById('quick-search-all');
    
    // Initialize filter state
    let filtersVisible = true;
    
    // Set initial state of filters panel
    if (searchFilters) {
        searchFilters.style.maxHeight = searchFilters.scrollHeight + 'px';
        searchFilters.style.opacity = '1';
    }
    
    // Add event listeners
    if (searchForm) {
        searchForm.addEventListener('submit', handleSearch);
    }
    
    if (resetButton) {
        resetButton.addEventListener('click', resetForm);
    }
    
    if (filterToggle) {
        filterToggle.addEventListener('click', toggleFilters);
    }
    
    if (quickSearchAllBtn) {
        quickSearchAllBtn.addEventListener('click', showAllOrders);
    }

    // Function to handle search form submission
    function handleSearch(e) {
        e.preventDefault();
        
        // Show loading indicator
        searchResults.innerHTML = '<p class="loading">Searching orders...</p>';
        
        // Get form data
        const formData = new FormData(searchForm);
        
        // Convert to URL parameters
        const params = new URLSearchParams();
        for (const [key, value] of formData.entries()) {
            if (value) { // Only add non-empty values
                params.append(key, value);
            }
        }
        
        // Make API request
        fetch(`/api/search-orders?${params.toString()}`)
            .then(response => response.json())
            .then(orders => {
                displayResults(orders);
            })
            .catch(error => {
                console.error('Error searching orders:', error);
                searchResults.innerHTML = '<p class="no-results">Error searching orders. Please try again.</p>';
            });
    }
    
    // Function to display search results
    function displayResults(orders) {
        // Update results count
        resultsCount.textContent = `${orders.length} order(s) found`;
        
        // Clear previous results
        searchResults.innerHTML = '';
        
        if (orders.length === 0) {
            searchResults.innerHTML = '<p class="no-results">No orders found matching your criteria.</p>';
            return;
        }
        
        // Get the template
        const template = document.getElementById('order-card-template');
        
        // Create order cards
        orders.forEach(order => {
            let orderCard;
            
            // Try to use the template if it exists and has content property
            if (template && template.content) {
                try {
                    orderCard = template.content.cloneNode(true).querySelector('.order-card');
                } catch (e) {
                    console.error('Error cloning template:', e);
                    // Will fall back to manual creation below
                }
            }
            
            // If template doesn't exist or cloning failed, create card manually
            if (!orderCard) {
                orderCard = document.createElement('div');
                orderCard.className = 'order-card';
                orderCard.innerHTML = `
                    <div class="order-header">
                        <h3>Order #<span class="order-id"></span></h3>
                        <span class="date">Order: <span class="order-date"></span></span>
                    </div>
                    <div class="order-details">
                        <p>Total: ₹<span class="order-total"></span></p>
                        <p class="order-date-display">Order Date: <span class="order-date-full"></span></p>
                        <p class="status">Payment: <span class="payment-status"></span></p>
                        <p class="payment-date-display">Paid on: <span class="payment-date"></span></p>
                        
                        <div class="order-items-details">
                            <h4>Order Items:</h4>
                            <ul class="order-items-list"></ul>
                        </div>
                    </div>
                `;
            }
            
            // Ensure order has all required properties
            order = {
                id: order.id || 'N/A',
                total_price: order.total_price || '0.00',
                payment_status: order.payment_status || 'pending',
                order_date: order.order_date || null,
                payment_date: order.payment_date || null,
                items: Array.isArray(order.items) ? order.items : []
            };
            
            // Format dates
            const orderDateShort = order.order_date ? formatDate(order.order_date, true) : 'N/A';
            const orderDateFull = order.order_date ? formatDate(order.order_date) : 'N/A';
            const paymentDate = order.payment_date ? formatDate(order.payment_date) : 'N/A';
            
            // Set order details
            orderCard.querySelector('.order-id').textContent = order.id;
            orderCard.querySelector('.order-date').textContent = orderDateShort;
            orderCard.querySelector('.order-total').textContent = order.total_price;
            orderCard.querySelector('.order-date-full').textContent = orderDateFull;
            
            // Set payment status
            const statusElement = orderCard.querySelector('.payment-status');
            statusElement.textContent = capitalizeFirstLetter(order.payment_status);
            statusElement.parentElement.classList.add(order.payment_status);
            
            // Handle payment date
            const paymentDateElement = orderCard.querySelector('.payment-date-display');
            if (order.payment_status === 'completed') {
                paymentDateElement.style.display = 'block';
                orderCard.querySelector('.payment-date').textContent = paymentDate;
            } else {
                paymentDateElement.style.display = 'none';
            }
            
            // Add order items if they exist
            const orderItemsList = orderCard.querySelector('.order-items-list');
            if (order.items && Array.isArray(order.items) && order.items.length > 0) {
                order.items.forEach(item => {
                    // Ensure item has all required properties
                    const itemName = item.item_name || 'Unknown Item';
                    const quantity = item.quantity || 1;
                    const unitPrice = item.unit_price || 0;
                    const subtotal = item.subtotal || (quantity * unitPrice);
                    
                    const listItem = document.createElement('li');
                    listItem.textContent = `${itemName} - ${quantity} x ₹${unitPrice.toFixed(2)} = ₹${subtotal.toFixed(2)}`;
                    orderItemsList.appendChild(listItem);
                });
            } else {
                // Fallback for old data format or missing items
                if (order.item_name) {
                    const quantity = order.quantity || 1;
                    const price = order.price || 0;
                    const unitPrice = quantity > 0 ? (price / quantity) : 0;
                    
                    const listItem = document.createElement('li');
                    listItem.textContent = `${order.item_name} - ${quantity} x ₹${unitPrice.toFixed(2)} = ₹${price.toFixed(2)}`;
                    orderItemsList.appendChild(listItem);
                } else {
                    // No items data available
                    const listItem = document.createElement('li');
                    listItem.textContent = 'No item details available';
                    orderItemsList.appendChild(listItem);
                }
            }
            
            searchResults.appendChild(orderCard);
        });
    }
    
    // Function to reset the form
    function resetForm() {
        searchForm.reset();
        searchResults.innerHTML = `
            <div class="search-prompt">
                <div class="search-icon">🔍</div>
                <p>Use the filters above to search for orders</p>
                <button id="quick-search-all" class="quick-search-btn">Show All Orders</button>
            </div>
        `;
        resultsCount.textContent = '';
        
        // Re-attach event listener to the new button
        const newQuickSearchBtn = document.getElementById('quick-search-all');
        if (newQuickSearchBtn) {
            newQuickSearchBtn.addEventListener('click', showAllOrders);
        }
    }
    
    // Function to toggle filters visibility
    function toggleFilters() {
        filtersVisible = !filtersVisible;
        
        if (filtersVisible) {
            searchFilters.style.maxHeight = searchFilters.scrollHeight + 'px';
            searchFilters.style.opacity = '1';
            searchFilters.style.overflow = 'visible';
            filterToggle.querySelector('.toggle-icon').classList.remove('collapsed');
        } else {
            searchFilters.style.maxHeight = '0';
            searchFilters.style.opacity = '0';
            searchFilters.style.overflow = 'hidden';
            filterToggle.querySelector('.toggle-icon').classList.add('collapsed');
        }
    }
    
    // Function to show all orders
    function showAllOrders() {
        // Show loading indicator
        searchResults.innerHTML = '<p class="loading">Loading all orders...</p>';
        
        // Reset form fields
        searchForm.reset();
        
        // Make API request without any parameters
        fetch('/api/search-orders')
            .then(response => response.json())
            .then(orders => {
                displayResults(orders);
            })
            .catch(error => {
                console.error('Error fetching orders:', error);
                searchResults.innerHTML = '<p class="no-results">Error loading orders. Please try again.</p>';
            });
    }
    
    // Helper function to format date from ISO string
    function formatDate(isoString, shortFormat = false) {
        if (!isoString) return 'N/A';
        
        const parts = isoString.split('T');
        if (parts.length < 2) return isoString;
        
        const datePart = parts[0];
        let timePart = parts[1];
        
        // Handle time part with potential milliseconds
        if (timePart.includes('.')) {
            timePart = timePart.split('.')[0];
        }
        
        if (shortFormat) {
            // Return just the date for short format
            const date = new Date(isoString);
            return date.toLocaleDateString();
        }
        
        return `${datePart} ${timePart}`;
    }
    
    // Helper function to capitalize first letter
    function capitalizeFirstLetter(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }
});
