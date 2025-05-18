import sqlite3
import os
import json
from datetime import datetime

# Database file path
DB_FILE = "data/billing.db"

def init_db():
    """Initialize the database with tables if they don't exist"""
    # Create data directory if it doesn't exist
    os.makedirs(os.path.dirname(DB_FILE), exist_ok=True)
    
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    # Create items table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_name TEXT NOT NULL,
        price_per_quantity REAL NOT NULL,
        remaining_quantity INTEGER
    )
    ''')
    
    # Create orders table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_id INTEGER NOT NULL,
        item_name TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        price REAL NOT NULL,
        payment_status TEXT NOT NULL,
        order_date TEXT NOT NULL,
        payment_date TEXT,
        FOREIGN KEY (item_id) REFERENCES items (id)
    )
    ''')
    
    conn.commit()
    
    # Check if items table is empty, if so, import from JSON
    cursor.execute("SELECT COUNT(*) FROM items")
    if cursor.fetchone()[0] == 0:
        import_data_from_json()
    
    conn.close()

def import_data_from_json():
    """Import data from JSON files if they exist"""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    # Import items
    if os.path.exists("data/items.json"):
        with open("data/items.json", "r") as f:
            items = json.load(f)
            for item in items:
                remaining_qty = item.get("remaining_quantity")
                cursor.execute(
                    "INSERT INTO items (id, item_name, price_per_quantity, remaining_quantity) VALUES (?, ?, ?, ?)",
                    (item["id"], item["item_name"], item["price_per_quantity"], remaining_qty)
                )
    
    # Import orders
    if os.path.exists("data/orders.json"):
        with open("data/orders.json", "r") as f:
            orders = json.load(f)
            for order in orders:
                payment_date = None
                if order["payment_status"] == "completed":
                    # Set a default payment date for existing completed orders
                    payment_date = order["order_date"]
                
                cursor.execute(
                    "INSERT INTO orders (id, item_id, item_name, quantity, price, payment_status, order_date, payment_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    (order["id"], order["item_id"], order["item_name"], order["quantity"], 
                     order["price"], order["payment_status"], order["order_date"], payment_date)
                )
    
    conn.commit()
    conn.close()

# Item operations
def get_all_items():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM items ORDER BY item_name")
    items = [dict(row) for row in cursor.fetchall()]
    
    conn.close()
    return items

def add_item(item_name, price_per_quantity, remaining_quantity=None):
    """Add a new item to the database"""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    cursor.execute(
        "INSERT INTO items (item_name, price_per_quantity, remaining_quantity) VALUES (?, ?, ?)",
        (item_name, price_per_quantity, remaining_quantity)
    )
    
    item_id = cursor.lastrowid
    
    conn.commit()
    conn.close()
    
    return item_id

def update_item(item_id, item_name, price_per_quantity, remaining_quantity=None):
    """Update an existing item in the database"""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    cursor.execute(
        "UPDATE items SET item_name = ?, price_per_quantity = ?, remaining_quantity = ? WHERE id = ?",
        (item_name, price_per_quantity, remaining_quantity, item_id)
    )
    
    conn.commit()
    conn.close()
    
    return True

def delete_item(item_id):
    """Delete an item from the database"""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    # Check if item exists
    cursor.execute("SELECT id FROM items WHERE id = ?", (item_id,))
    if not cursor.fetchone():
        conn.close()
        return False
    
    # Check if item is used in any orders
    cursor.execute("SELECT id FROM orders WHERE item_id = ? LIMIT 1", (item_id,))
    if cursor.fetchone():
        conn.close()
        return False  # Cannot delete items with associated orders
    
    # Delete the item
    cursor.execute("DELETE FROM items WHERE id = ?", (item_id,))
    
    conn.commit()
    conn.close()
    
    return True

def restock_all_items(quantity=9999):
    """Restock all items to the specified quantity"""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    cursor.execute("UPDATE items SET remaining_quantity = ?", (quantity,))
    
    conn.commit()
    conn.close()
    
    return True

def get_item_by_id(item_id):
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM items WHERE id = ?", (item_id,))
    item = cursor.fetchone()
    
    conn.close()
    return dict(item) if item else None

def get_item_by_name(item_name):
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM items WHERE LOWER(item_name) = LOWER(?)", (item_name,))
    item = cursor.fetchone()
    
    conn.close()
    return dict(item) if item else None

def search_items(query):
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM items WHERE LOWER(item_name) LIKE LOWER(?) ORDER BY item_name", (f"%{query}%",))
    items = [dict(row) for row in cursor.fetchall()]
    
    conn.close()
    return items

def update_item_quantity(item_id, quantity_change):
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    cursor.execute(
        "UPDATE items SET remaining_quantity = remaining_quantity + ? WHERE id = ? AND remaining_quantity IS NOT NULL",
        (quantity_change, item_id)
    )
    
    conn.commit()
    conn.close()

# Order operations
def get_all_orders():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM orders ORDER BY order_date DESC")
    orders = [dict(row) for row in cursor.fetchall()]
    
    conn.close()
    return orders

def get_order_history():
    """Get all orders for history view, sorted by newest first"""
    return get_all_orders()

def get_completed_orders():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM orders WHERE payment_status = 'completed' ORDER BY payment_date DESC")
    orders = [dict(row) for row in cursor.fetchall()]
    
    conn.close()
    return orders

def get_pending_orders():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Sort by oldest first (ASC)
    cursor.execute("SELECT * FROM orders WHERE payment_status = 'pending' ORDER BY order_date ASC")
    orders = [dict(row) for row in cursor.fetchall()]
    
    conn.close()
    return orders

def get_order_by_id(order_id):
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM orders WHERE id = ?", (order_id,))
    order = cursor.fetchone()
    
    conn.close()
    return dict(order) if order else None

def create_order(item_id, item_name, quantity, price, payment_status):
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    order_date = datetime.now().isoformat()
    payment_date = order_date if payment_status == "completed" else None
    
    cursor.execute(
        "INSERT INTO orders (item_id, item_name, quantity, price, payment_status, order_date, payment_date) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (item_id, item_name, quantity, price, payment_status, order_date, payment_date)
    )
    
    order_id = cursor.lastrowid
    
    conn.commit()
    conn.close()
    
    return order_id

def update_payment_status(order_id, status="completed"):
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    payment_date = datetime.now().isoformat() if status == "completed" else None
    
    cursor.execute(
        "UPDATE orders SET payment_status = ?, payment_date = ? WHERE id = ?",
        (status, payment_date, order_id)
    )
    
    conn.commit()
    conn.close()
    
def cancel_order(order_id):
    """Cancel an order and restore inventory if needed"""
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Get the order details first
    cursor.execute("SELECT * FROM orders WHERE id = ?", (order_id,))
    order = cursor.fetchone()
    
    if not order:
        conn.close()
        return False
    
    # Get the item to check if it has remaining_quantity tracking
    cursor.execute("SELECT * FROM items WHERE id = ?", (order["item_id"],))
    item = cursor.fetchone()
    
    # If the item tracks quantity, restore it
    if item and item["remaining_quantity"] is not None:
        # Add the quantity back to inventory
        cursor.execute(
            "UPDATE items SET remaining_quantity = remaining_quantity + ? WHERE id = ?",
            (order["quantity"], order["item_id"])
        )
    
    # Mark the order as cancelled
    cursor.execute(
        "UPDATE orders SET payment_status = 'cancelled' WHERE id = ?",
        (order_id,)
    )
    
    conn.commit()
    conn.close()
    return True

def search_orders(status=None, item_name=None, min_quantity=None, max_quantity=None, 
                  order_date_start=None, order_date_end=None, 
                  payment_date_start=None, payment_date_end=None):
    """Search orders with various filter criteria"""
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Start with base query
    query = "SELECT * FROM orders WHERE 1=1"
    params = []
    
    # Add filters based on provided parameters
    if status:
        query += " AND payment_status = ?"
        params.append(status)
    
    if item_name:
        query += " AND LOWER(item_name) LIKE LOWER(?)"
        params.append(f"%{item_name}%")
    
    if min_quantity is not None:
        query += " AND quantity >= ?"
        params.append(min_quantity)
    
    if max_quantity is not None:
        query += " AND quantity <= ?"
        params.append(max_quantity)
    
    if order_date_start:
        query += " AND order_date >= ?"
        params.append(order_date_start)
    
    if order_date_end:
        query += " AND order_date <= ?"
        params.append(order_date_end)
    
    if payment_date_start:
        query += " AND payment_date >= ?"
        params.append(payment_date_start)
    
    if payment_date_end:
        query += " AND payment_date <= ?"
        params.append(payment_date_end)
    
    # Add default sorting
    query += " ORDER BY order_date DESC"
    
    cursor.execute(query, params)
    orders = [dict(row) for row in cursor.fetchall()]
    
    conn.close()
    return orders

# Initialize the database when this module is imported
init_db()
