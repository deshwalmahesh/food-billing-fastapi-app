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
        
        // Create order cards
        orders.forEach(order => {
            const orderCard = document.createElement('div');
            orderCard.className = 'order-card';
            
            // Format dates
            const orderDate = order.order_date ? formatDate(order.order_date) : 'N/A';
            const paymentDate = order.payment_date ? formatDate(order.payment_date) : 'N/A';
            
            // Determine status class
            let statusClass = '';
            switch (order.payment_status) {
                case 'completed':
                    statusClass = 'completed';
                    break;
                case 'pending':
                    statusClass = 'pending';
                    break;
                case 'cancelled':
                    statusClass = 'cancelled';
                    break;
                default:
                    statusClass = '';
            }
            
            // Create card content
            orderCard.innerHTML = `
                <div class="order-header">
                    <h3>Order #${order.id}</h3>
                    <span class="date">Order: ${orderDate}</span>
                </div>
                <div class="order-details">
                    <p>Item: ${order.item_name}</p>
                    <p>Quantity: ${order.quantity}</p>
                    <p>Total: ₹${order.price}</p>
                    <p class="order-date">Order Date: ${orderDate}</p>
                    <p class="status ${statusClass}">Status: ${capitalizeFirstLetter(order.payment_status)}</p>
                    ${order.payment_status === 'completed' ? `<p class="payment-date">Paid on: ${paymentDate}</p>` : ''}
                </div>
            `;
            
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
    function formatDate(isoString) {
        if (!isoString) return 'N/A';
        
        const parts = isoString.split('T');
        if (parts.length < 2) return isoString;
        
        const datePart = parts[0];
        let timePart = parts[1];
        
        // Handle time part with potential milliseconds
        if (timePart.includes('.')) {
            timePart = timePart.split('.')[0];
        }
        
        return `${datePart} ${timePart}`;
    }
    
    // Helper function to capitalize first letter
    function capitalizeFirstLetter(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }
});
