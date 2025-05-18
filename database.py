import os
import json
from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import QueuePool
from dotenv import load_dotenv
from fastapi import Depends

# Import models from models.py
from models import Base, Item, Order

# Load environment variables
load_dotenv()

# Get database URL from environment or use default
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///data/billing.db")

# Create SQLAlchemy engine with connection pooling
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
    poolclass=QueuePool,
    pool_size=5,
    max_overflow=10,
    pool_timeout=30,
    pool_recycle=1800,
)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Database dependency
def get_db():
    """Dependency for getting database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Initialize database
def init_db():
    """Initialize the database with tables if they don't exist"""
    # Create data directory if it doesn't exist
    if DATABASE_URL.startswith("sqlite"):
        db_file = DATABASE_URL.replace("sqlite:///", "")
        os.makedirs(os.path.dirname(db_file), exist_ok=True)
    
    # Create tables
    Base.metadata.create_all(bind=engine)
    

# Item operations
def get_all_items(db: Session = Depends(get_db)):
    items = db.query(Item).order_by(Item.item_name).all()
    return [item.to_dict() for item in items]

def add_item(item_name: str, price_per_quantity: float, remaining_quantity: Optional[int] = None, db: Session = Depends(get_db)):
    """Add a new item to the database"""
    item = Item(
        item_name=item_name,
        price_per_quantity=price_per_quantity,
        remaining_quantity=remaining_quantity
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item.id

def update_item(item_id: int, item_name: str, price_per_quantity: float, remaining_quantity: Optional[int] = None, db: Session = Depends(get_db)):
    """Update an existing item in the database"""
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        return False
    
    item.item_name = item_name
    item.price_per_quantity = price_per_quantity
    item.remaining_quantity = remaining_quantity
    
    db.commit()
    return True

def delete_item(item_id: int, db: Session = Depends(get_db)):
    """Delete an item from the database"""
    # Check if item exists in any orders
    order_count = db.query(Order).filter(Order.item_id == item_id).count()
    if order_count > 0:
        return False
    
    # Delete the item
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        return False
    
    db.delete(item)
    db.commit()
    return True

def restock_all_items(quantity: int = 9999, db: Session = Depends(get_db)):
    """Restock all items to the specified quantity"""
    db.query(Item).update({"remaining_quantity": quantity})
    db.commit()
    return True

def get_item_by_id(item_id: int, db: Session = Depends(get_db)):
    item = db.query(Item).filter(Item.id == item_id).first()
    return item.to_dict() if item else None

def get_item_by_name(item_name: str, db: Session = Depends(get_db)):
    item = db.query(Item).filter(Item.item_name == item_name).first()
    return item.to_dict() if item else None

def search_items(query: str, db: Session = Depends(get_db)):
    items = db.query(Item).filter(Item.item_name.ilike(f"%{query}%")).all()
    return [item.to_dict() for item in items]

def update_item_quantity(item_id: int, quantity_change: int, db: Session = Depends(get_db)):
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item or item.remaining_quantity is None:
        return False
    
    item.remaining_quantity += quantity_change
    db.commit()
    return True

# Order operations
def get_all_orders(db: Session = Depends(get_db)):
    orders = db.query(Order).all()
    return [order.to_dict() for order in orders]

def get_order_history(db: Session = Depends(get_db)):
    """Get all orders for history view, sorted by newest first"""
    return get_all_orders(db)

def get_completed_orders(db: Session = Depends(get_db)):
    orders = db.query(Order).filter(Order.payment_status == "completed").order_by(Order.order_date.desc()).all()
    return [order.to_dict() for order in orders]

def get_pending_orders(db: Session = Depends(get_db)):
    orders = db.query(Order).filter(Order.payment_status == "pending").order_by(Order.order_date.asc()).all()
    return [order.to_dict() for order in orders]

def get_order_by_id(order_id: int, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    return order.to_dict() if order else None

def create_order(item_id: int, item_name: str, quantity: int, price: float, payment_status: str, db: Session = Depends(get_db)):
    order_date = datetime.now().isoformat()
    payment_date = order_date if payment_status == "completed" else None
    
    order = Order(
        item_id=item_id,
        item_name=item_name,
        quantity=quantity,
        price=price,
        payment_status=payment_status,
        order_date=order_date,
        payment_date=payment_date
    )
    
    db.add(order)
    db.commit()
    db.refresh(order)
    return order.id

def update_payment_status(order_id: int, status: str = "completed", db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        return False
    
    payment_date = datetime.now().isoformat() if status == "completed" else None
    order.payment_status = status
    order.payment_date = payment_date
    
    db.commit()
    return True

def cancel_order(order_id: int, db: Session = Depends(get_db)):
    """Cancel an order and restore inventory if needed"""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        return False
    
    # Get the item to check if it has remaining_quantity tracking
    item = db.query(Item).filter(Item.id == order.item_id).first()
    
    # If the item tracks quantity, restore it
    if item and item.remaining_quantity is not None:
        # Add the quantity back to inventory
        item.remaining_quantity += order.quantity
    
    # Mark the order as cancelled
    order.payment_status = "cancelled"
    
    db.commit()
    return True

def search_orders(
    status: Optional[str] = None,
    item_name: Optional[str] = None,
    min_quantity: Optional[int] = None,
    max_quantity: Optional[int] = None,
    order_date_start: Optional[str] = None,
    order_date_end: Optional[str] = None,
    payment_date_start: Optional[str] = None,
    payment_date_end: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Search orders with various filter criteria"""
    query = db.query(Order)
    
    # Add filters based on provided parameters
    if status:
        query = query.filter(Order.payment_status == status)
    
    if item_name:
        query = query.filter(Order.item_name.ilike(f"%{item_name}%"))
    
    if min_quantity is not None:
        query = query.filter(Order.quantity >= min_quantity)
    
    if max_quantity is not None:
        query = query.filter(Order.quantity <= max_quantity)
    
    if order_date_start:
        query = query.filter(Order.order_date >= order_date_start)
    
    if order_date_end:
        query = query.filter(Order.order_date <= order_date_end)
    
    if payment_date_start:
        query = query.filter(Order.payment_date >= payment_date_start)
    
    if payment_date_end:
        query = query.filter(Order.payment_date <= payment_date_end)
    
    # Add default sorting
    query = query.order_by(Order.order_date.desc())
    
    orders = query.all()
    return [order.to_dict() for order in orders]

# Initialize the database when this module is imported
init_db()
