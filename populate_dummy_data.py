#!/usr/bin/env python3
"""
Script to populate the database with dummy data for testing purposes.
This script will clear existing data and add fresh test data to all tables.
"""

import os
import sys
from datetime import datetime, timedelta
import random
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

# Add the project root to the path so we can import the database module
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import database components
from models import Base, Item, Order
from database import engine, SessionLocal

def clear_database():
    """Drop all tables and recreate them"""
    print("Clearing existing database...")
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    print("Database schema recreated successfully.")

def populate_items():
    """Populate the items table with dummy data"""
    print("Populating items table...")
    
    items = [
        {"item_name": "Burger", "price_per_quantity": 5.99, "remaining_quantity": 50},
        {"item_name": "Pizza", "price_per_quantity": 8.99, "remaining_quantity": 30},
        {"item_name": "Fries", "price_per_quantity": 2.99, "remaining_quantity": 100},
        {"item_name": "Soda", "price_per_quantity": 1.99, "remaining_quantity": 200},
        {"item_name": "Salad", "price_per_quantity": 4.99, "remaining_quantity": 40},
        {"item_name": "Ice Cream", "price_per_quantity": 3.99, "remaining_quantity": 60},
        {"item_name": "Coffee", "price_per_quantity": 2.49, "remaining_quantity": 150},
        {"item_name": "Sandwich", "price_per_quantity": 6.49, "remaining_quantity": 45},
        {"item_name": "Chicken Wings", "price_per_quantity": 7.99, "remaining_quantity": 35},
        {"item_name": "Pasta", "price_per_quantity": 9.99, "remaining_quantity": 25},
    ]
    
    db = SessionLocal()
    try:
        for item_data in items:
            item = Item(**item_data)
            db.add(item)
        db.commit()
        print(f"Added {len(items)} items to the database.")
    except SQLAlchemyError as e:
        db.rollback()
        print(f"Error populating items: {e}")
    finally:
        db.close()

def populate_orders():
    """Populate the orders table with dummy data"""
    print("Populating orders table...")
    
    # Get all items from the database to reference in orders
    db = SessionLocal()
    try:
        items = db.query(Item).all()
        
        # Generate orders over the past 30 days
        today = datetime.now()
        
        # Create a mix of pending, completed, and cancelled orders
        orders_to_create = []
        
        # Generate 50 random orders
        for i in range(50):
            # Random item
            item = random.choice(items)
            
            # Random quantity between 1 and 5
            quantity = random.randint(1, 5)
            
            # Calculate price
            price = round(item.price_per_quantity * quantity, 2)
            
            # Random date within the last 30 days
            days_ago = random.randint(0, 30)
            order_date = (today - timedelta(days=days_ago)).isoformat()
            
            # Random payment status
            status_options = ["pending", "completed", "cancelled"]
            weights = [0.3, 0.6, 0.1]  # 30% pending, 60% completed, 10% cancelled
            payment_status = random.choices(status_options, weights=weights, k=1)[0]
            
            # Payment date for completed orders
            payment_date = None
            if payment_status == "completed":
                # Payment happened between 0 and 2 days after order
                payment_delay = random.randint(0, 2)
                payment_date = (today - timedelta(days=days_ago-payment_delay)).isoformat()
            
            order = Order(
                item_id=item.id,
                item_name=item.item_name,
                quantity=quantity,
                price=price,
                payment_status=payment_status,
                order_date=order_date,
                payment_date=payment_date
            )
            orders_to_create.append(order)
        
        # Add all orders to the database
        for order in orders_to_create:
            db.add(order)
        
        db.commit()
        print(f"Added {len(orders_to_create)} orders to the database.")
    except SQLAlchemyError as e:
        db.rollback()
        print(f"Error populating orders: {e}")
    finally:
        db.close()

def display_schema_info():
    """Display information about the database schema"""
    print("\nDatabase Schema Information:")
    print("============================")
    
    # Item table
    print("\nTable: items")
    print("  - id: Integer, Primary Key, Auto-increment")
    print("  - item_name: String, Not Null")
    print("  - price_per_quantity: Float, Not Null")
    print("  - remaining_quantity: Integer, Nullable")
    
    # Order table
    print("\nTable: orders")
    print("  - id: Integer, Primary Key, Auto-increment")
    print("  - item_id: Integer, Foreign Key (items.id), Not Null")
    print("  - item_name: String, Not Null")
    print("  - quantity: Integer, Not Null")
    print("  - price: Float, Not Null")
    print("  - payment_status: String, Not Null")
    print("  - order_date: String, Not Null")
    print("  - payment_date: String, Nullable")
    
    print("\nRelationships:")
    print("  - Order.item_id -> Item.id (Many-to-One)")

def main():
    """Main function to run the script"""
    print("Starting database population script...")
    
    # Display schema information
    display_schema_info()
    
    # Ask for confirmation before proceeding
    confirm = input("\nWARNING: This will clear all existing data. Continue? (y/n): ")
    if confirm.lower() != 'y':
        print("Operation cancelled.")
        return
    
    # Clear and recreate the database
    clear_database()
    
    # Populate tables
    populate_items()
    populate_orders()
    
    print("\nDatabase population completed successfully!")

if __name__ == "__main__":
    main()
