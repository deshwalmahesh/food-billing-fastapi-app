document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const addItemBtn = document.getElementById('add-item-btn');
    const restockAllBtn = document.getElementById('restock-all-btn');
    const itemModal = document.getElementById('item-modal');
    const deleteModal = document.getElementById('delete-modal');
    const historyModal = document.getElementById('history-modal');
    const historyToggle = document.getElementById('history-toggle');
    const itemForm = document.getElementById('item-form');
    const modalTitle = document.getElementById('modal-title');
    const closeButtons = document.querySelectorAll('.close');
    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
    const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    
    let currentItemId = null;

    // Toggle sidebar
    sidebarToggle.addEventListener('click', function() {
        document.querySelector('.sidebar').classList.toggle('collapsed');
        document.querySelector('.main-container').classList.toggle('expanded');
    });

    // Show history modal
    historyToggle.addEventListener('click', function() {
        historyModal.style.display = 'block';
    });

    // Show add item modal
    addItemBtn.addEventListener('click', function() {
        modalTitle.textContent = 'Add New Item';
        itemForm.reset();
        document.getElementById('item-id').value = '';
        itemModal.style.display = 'block';
    });

    // Restock all items
    restockAllBtn.addEventListener('click', function() {
        if (confirm('Are you sure you want to restock all items to 9999?')) {
            fetch('/api/restock-all', {
                method: 'POST'
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                alert('All items have been restocked to 9999!');
                window.location.reload();
            })
            .catch(error => {
                console.error('Error:', error);
                alert('Failed to restock items. Please try again.');
            });
        }
    });

    // Edit item button click handlers
    document.querySelectorAll('.edit-item-btn').forEach(button => {
        button.addEventListener('click', function() {
            const itemCard = this.closest('.item-card');
            const itemId = itemCard.dataset.id;
            
            fetch(`/api/items/${itemId}`)
                .then(response => response.json())
                .then(item => {
                    document.getElementById('item-id').value = item.id;
                    document.getElementById('item-name').value = item.item_name;
                    document.getElementById('item-price').value = item.price_per_quantity;
                    document.getElementById('item-quantity').value = item.remaining_quantity !== null ? item.remaining_quantity : '';
                    
                    modalTitle.textContent = 'Edit Item';
                    itemModal.style.display = 'block';
                })
                .catch(error => {
                    console.error('Error:', error);
                    alert('Failed to load item details. Please try again.');
                });
        });
    });

    // Delete item button click handlers
    document.querySelectorAll('.delete-item-btn').forEach(button => {
        button.addEventListener('click', function() {
            const itemCard = this.closest('.item-card');
            currentItemId = itemCard.dataset.id;
            deleteModal.style.display = 'block';
        });
    });

    // Confirm delete
    confirmDeleteBtn.addEventListener('click', function() {
        if (currentItemId) {
            fetch(`/api/items/${currentItemId}`, {
                method: 'DELETE'
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                deleteModal.style.display = 'none';
                window.location.reload();
            })
            .catch(error => {
                console.error('Error:', error);
                alert('Failed to delete item. Please try again.');
                deleteModal.style.display = 'none';
            });
        }
    });

    // Cancel delete
    cancelDeleteBtn.addEventListener('click', function() {
        deleteModal.style.display = 'none';
    });

    // Item form submission
    itemForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const formData = new FormData(itemForm);
        const itemId = formData.get('id');
        const method = itemId ? 'PUT' : 'POST';
        const url = itemId ? `/api/items/${itemId}` : '/api/items';
        
        // Convert form data to JSON
        const data = {};
        formData.forEach((value, key) => {
            if (key === 'remaining_quantity' && value === '') {
                data[key] = null;
            } else {
                data[key] = key === 'price_per_quantity' || key === 'remaining_quantity' ? 
                    parseFloat(value) : value;
            }
        });
        
        fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            itemModal.style.display = 'none';
            window.location.reload();
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Failed to save item. Please try again.');
        });
    });

    // Close modals when clicking the X or outside the modal
    closeButtons.forEach(button => {
        button.addEventListener('click', function() {
            this.closest('.modal').style.display = 'none';
        });
    });

    window.addEventListener('click', function(event) {
        if (event.target === itemModal) {
            itemModal.style.display = 'none';
        } else if (event.target === deleteModal) {
            deleteModal.style.display = 'none';
        } else if (event.target === historyModal) {
            historyModal.style.display = 'none';
        }
    });
});
