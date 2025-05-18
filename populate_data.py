import sqlite3
import os
from datetime import datetime, timedelta

# Database file path
DB_FILE = "data/billing.db"

# Indian food items to add
indian_food_items = [
    {"item_name": "Butter Chicken", "price_per_quantity": 250.00, "remaining_quantity": 20},
    {"item_name": "Paneer Tikka", "price_per_quantity": 180.00, "remaining_quantity": 15},
    {"item_name": "Biryani", "price_per_quantity": 220.00, "remaining_quantity": 25},
    {"item_name": "Masala Dosa", "price_per_quantity": 120.00, "remaining_quantity": 30},
    {"item_name": "Chole Bhature", "price_per_quantity": 150.00, "remaining_quantity": 18},
    {"item_name": "Samosa", "price_per_quantity": 30.00, "remaining_quantity": 50},
    {"item_name": "Pav Bhaji", "price_per_quantity": 140.00, "remaining_quantity": 22},
    {"item_name": "Gulab Jamun", "price_per_quantity": 60.00, "remaining_quantity": 40},
    {"item_name": "Tandoori Roti", "price_per_quantity": 20.00, "remaining_quantity": 100},
    {"item_name": "Naan", "price_per_quantity": 35.00, "remaining_quantity": 80},
    {"item_name": "Chicken Tikka", "price_per_quantity": 200.00, "remaining_quantity": 25},
    {"item_name": "Malai Kofta", "price_per_quantity": 160.00, "remaining_quantity": 20},
    {"item_name": "Aloo Paratha", "price_per_quantity": 40.00, "remaining_quantity": 40},
    {"item_name": "Rasgulla", "price_per_quantity": 50.00, "remaining_quantity": 45},
    {"item_name": "Mango Lassi", "price_per_quantity": 80.00, "remaining_quantity": 35}
]

# Sample orders to generate
def generate_sample_orders():
    """Generate sample orders based on the food items"""
    orders = []
    
    # Completed orders (older)
    orders.append({
        "item_id": 1, 
        "item_name": "Butter Chicken", 
        "quantity": 2, 
        "price": 500.00, 
        "payment_status": "completed", 
        "order_date": (datetime.now() - timedelta(days=5)).isoformat(), 
        "payment_date": (datetime.now() - timedelta(days=5)).isoformat()
    })
    
    orders.append({
        "item_id": 3, 
        "item_name": "Biryani", 
        "quantity": 3, 
        "price": 660.00, 
        "payment_status": "completed", 
        "order_date": (datetime.now() - timedelta(days=4)).isoformat(), 
        "payment_date": (datetime.now() - timedelta(days=4)).isoformat()
    })
    
    # Completed orders (recent)
    orders.append({
        "item_id": 5, 
        "item_name": "Chole Bhature", 
        "quantity": 2, 
        "price": 300.00, 
        "payment_status": "completed", 
        "order_date": (datetime.now() - timedelta(days=2)).isoformat(), 
        "payment_date": (datetime.now() - timedelta(days=2)).isoformat()
    })
    
    orders.append({
        "item_id": 8, 
        "item_name": "Gulab Jamun", 
        "quantity": 5, 
        "price": 300.00, 
        "payment_status": "completed", 
        "order_date": (datetime.now() - timedelta(days=1)).isoformat(), 
        "payment_date": (datetime.now() - timedelta(days=1)).isoformat()
    })
    
    # Pending orders (oldest first)
    orders.append({
        "item_id": 2, 
        "item_name": "Paneer Tikka", 
        "quantity": 2, 
        "price": 360.00, 
        "payment_status": "pending", 
        "order_date": (datetime.now() - timedelta(days=6)).isoformat(), 
        "payment_date": None
    })
    
    orders.append({
        "item_id": 4, 
        "item_name": "Masala Dosa", 
        "quantity": 3, 
        "price": 360.00, 
        "payment_status": "pending", 
        "order_date": (datetime.now() - timedelta(days=3)).isoformat(), 
        "payment_date": None
    })
    
    orders.append({
        "item_id": 6, 
        "item_name": "Samosa", 
        "quantity": 10, 
        "price": 300.00, 
        "payment_status": "pending", 
        "order_date": (datetime.now() - timedelta(days=2, hours=6)).isoformat(), 
        "payment_date": None
    })
    
    orders.append({
        "item_id": 7, 
        "item_name": "Pav Bhaji", 
        "quantity": 2, 
        "price": 280.00, 
        "payment_status": "pending", 
        "order_date": (datetime.now() - timedelta(hours=12)).isoformat(), 
        "payment_date": None
    })
    
    # Cancelled order
    orders.append({
        "item_id": 9, 
        "item_name": "Tandoori Roti", 
        "quantity": 8, 
        "price": 160.00, 
        "payment_status": "cancelled", 
        "order_date": (datetime.now() - timedelta(days=1, hours=6)).isoformat(), 
        "payment_date": None
    })
    
    # Add a few more orders with newer items
    orders.append({
        "item_id": 11, 
        "item_name": "Chicken Tikka", 
        "quantity": 2, 
        "price": 400.00, 
        "payment_status": "completed", 
        "order_date": (datetime.now() - timedelta(hours=6)).isoformat(), 
        "payment_date": (datetime.now() - timedelta(hours=6)).isoformat()
    })
    
    orders.append({
        "item_id": 12, 
        "item_name": "Malai Kofta", 
        "quantity": 1, 
        "price": 160.00, 
        "payment_status": "pending", 
        "order_date": (datetime.now() - timedelta(hours=3)).isoformat(), 
        "payment_date": None
    })
    
    return orders

def reset_items_table():
    """Reset the items table and add food items"""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    # Clear existing items
    cursor.execute("DELETE FROM items")
    
    # Reset the auto-increment counter
    cursor.execute("DELETE FROM sqlite_sequence WHERE name='items'")
    
    # Add new items
    for item in indian_food_items:
        cursor.execute(
            "INSERT INTO items (item_name, price_per_quantity, remaining_quantity) VALUES (?, ?, ?)",
            (item["item_name"], item["price_per_quantity"], item["remaining_quantity"])
        )
    
    conn.commit()
    conn.close()
    
    print("Reset items table and added food items")

def reset_orders_table():
    """Reset the orders table and add sample orders"""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    # Clear existing orders
    cursor.execute("DELETE FROM orders")
    
    # Reset the auto-increment counter
    cursor.execute("DELETE FROM sqlite_sequence WHERE name='orders'")
    
    # Generate sample orders
    sample_orders = generate_sample_orders()
    
    # Add new sample orders
    for order in sample_orders:
        cursor.execute(
            "INSERT INTO orders (item_id, item_name, quantity, price, payment_status, order_date, payment_date) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (order["item_id"], order["item_name"], order["quantity"], order["price"], 
             order["payment_status"], order["order_date"], order["payment_date"])
        )
    
    conn.commit()
    conn.close()
    
    print("Reset orders table and added sample orders")

def populate_all_data():
    """Reset and populate both items and orders tables"""
    # Ensure data directory exists
    os.makedirs(os.path.dirname(DB_FILE), exist_ok=True)
    
    reset_items_table()
    reset_orders_table()
    print("All data has been reset and repopulated")

if __name__ == "__main__":
    populate_all_data()
