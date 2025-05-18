import os
import json
from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session, joinedload
from sqlalchemy.pool import QueuePool
from dotenv import load_dotenv
from fastapi import Depends

# Import models from models.py
from models import Base, Item, Order, OrderItem

# Import Pydantic schemas
from schemas import ItemResponse, OrderResponse, OrderItemResponse

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
    return [ItemResponse.model_validate(item) for item in items]

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
    # Check if item exists in any order items
    order_item_count = db.query(OrderItem).filter(OrderItem.item_id == item_id).count()
    if order_item_count > 0:
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
    return ItemResponse.model_validate(item) if item else None

def get_item_by_name(item_name: str, db: Session = Depends(get_db)):
    item = db.query(Item).filter(Item.item_name == item_name).first()
    return ItemResponse.model_validate(item) if item else None

def search_items(query: str, db: Session = Depends(get_db)):
    items = db.query(Item).filter(Item.item_name.ilike(f"%{query}%")).all()
    return [ItemResponse.model_validate(item) for item in items]

def update_item_quantity(item_id: int, quantity_change: int, db: Session = Depends(get_db)):
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item or item.remaining_quantity is None:
        return False
    
    item.remaining_quantity += quantity_change
    db.commit()
    return True

# Order operations
def get_all_orders(db: Session = Depends(get_db)):
    orders = db.query(Order).options(joinedload(Order.order_items)).order_by(Order.order_date.desc()).all()
    
    # Explicitly create OrderResponse objects with items
    result = []
    for order in orders:
        items = [OrderItemResponse.model_validate(item) for item in order.order_items]
        order_dict = OrderResponse.model_validate(order)
        order_dict.items = items
        result.append(order_dict)
    
    return result

def get_order_history(db: Session = Depends(get_db)):
    """Get all orders for history view, sorted by newest first"""
    orders = db.query(Order).options(joinedload(Order.order_items)).order_by(Order.order_date.desc()).all()
    
    # Explicitly create OrderResponse objects with items
    result = []
    for order in orders:
        items = [OrderItemResponse.model_validate(item) for item in order.order_items]
        order_dict = OrderResponse.model_validate(order)
        order_dict.items = items
        result.append(order_dict)
    
    return result

def get_completed_orders(db: Session = Depends(get_db)):
    orders = db.query(Order).options(joinedload(Order.order_items)).filter(Order.payment_status == "completed").order_by(Order.payment_date.desc()).all()
    
    # Explicitly create OrderResponse objects with items
    result = []
    for order in orders:
        items = [OrderItemResponse.model_validate(item) for item in order.order_items]
        order_dict = OrderResponse.model_validate(order)
        order_dict.items = items
        result.append(order_dict)
    
    return result

def get_pending_orders(db: Session = Depends(get_db)):
    orders = db.query(Order).options(joinedload(Order.order_items)).filter(Order.payment_status == "pending").order_by(Order.order_date.asc()).all()
    
    # Explicitly create OrderResponse objects with items
    result = []
    for order in orders:
        items = [OrderItemResponse.model_validate(item) for item in order.order_items]
        order_dict = OrderResponse.model_validate(order)
        order_dict.items = items
        result.append(order_dict)
    
    return result

def get_order_by_id(order_id: int, db: Session = Depends(get_db)):
    order = db.query(Order).options(joinedload(Order.order_items)).filter(Order.id == order_id).first()
    
    if not order:
        return None
    
    # Explicitly create OrderResponse object with items
    items = [OrderItemResponse.model_validate(item) for item in order.order_items]
    order_dict = OrderResponse.model_validate(order)
    order_dict.items = items
    
    return order_dict

def create_order(items: List[Dict], payment_status: str, db: Session = Depends(get_db)):
    """Create a new order with multiple items"""
    order_date = datetime.now().isoformat()
    payment_date = order_date if payment_status == "completed" else None
    
    # Calculate total price from all items
    total_price = sum(item["subtotal"] for item in items)
    
    # Create the order
    order = Order(
        total_price=total_price,
        payment_status=payment_status,
        order_date=order_date,
        payment_date=payment_date
    )
    
    db.add(order)
    db.flush()  # Get the order ID without committing
    
    # Add order items
    for item_data in items:
        order_item = OrderItem(
            order_id=order.id,
            item_id=item_data["item_id"],
            item_name=item_data["item_name"],
            quantity=item_data["quantity"],
            unit_price=item_data["unit_price"],
            subtotal=item_data["subtotal"]
        )
        db.add(order_item)
    
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
    # Check if order exists
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        return False, "Order not found"
    
    # If order is already cancelled, do nothing
    if order.payment_status == "cancelled":
        return False, "Order is already cancelled"
    
    # Get all order items to restore inventory
    order_items = db.query(OrderItem).filter(OrderItem.order_id == order_id).all()
    
    # Restore inventory for each item
    for order_item in order_items:
        item = db.query(Item).filter(Item.id == order_item.item_id).first()
        if item and item.remaining_quantity is not None:
            item.remaining_quantity += order_item.quantity
    
    # Update order status and set payment_date to None if it was completed
    was_paid = order.payment_status == "completed"
    order.payment_status = "cancelled"
    
    # If the order was paid, we need to indicate a refund is needed
    refund_needed = was_paid
    
    # Clear payment date if it was set
    if was_paid:
        order.payment_date = None
    
    db.commit()
    
    return True, "Order cancelled successfully", refund_needed

def modify_order(order_id: int, items: List[Dict], db: Session = Depends(get_db)):
    """Modify an existing order"""
    # Check if order exists and is not completed or cancelled
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order or order.payment_status != "pending":
        return False, "Order not found or not in pending status"
    
    # Update order items
    for item_data in items:
        order_item = db.query(OrderItem).filter(
            OrderItem.order_id == order_id,
            OrderItem.item_id == item_data["item_id"]
        ).first()
        
        if order_item:
            # Update existing order item
            order_item.quantity = item_data["quantity"]
            order_item.subtotal = order_item.quantity * order_item.unit_price
        else:
            # Create new order item
            order_item = OrderItem(
                order_id=order_id,
                item_id=item_data["item_id"],
                item_name=item_data["item_name"],
                quantity=item_data["quantity"],
                unit_price=item_data["unit_price"],
                subtotal=item_data["subtotal"]
            )
            db.add(order_item)
    
    # Update order total price
    order.total_price = sum(item.subtotal for item in order.order_items)
    
    db.commit()
    return True, "Order modified successfully"

def search_orders(
    status: Optional[str] = None,
    item_name: Optional[str] = None,
    min_quantity: Optional[int] = None,
    max_quantity: Optional[int] = None,
    order_date_start: Optional[str] = None,
    order_date_end: Optional[str] = None,
    payment_date_start: Optional[str] = None,
    payment_date_end: Optional[str] = None,
    sort_by: Optional[str] = "order_date",
    sort_order: Optional[str] = "desc",
    db: Session = Depends(get_db)
):
    """Search orders with various filter criteria"""
    query = db.query(Order)
    
    # Add filters based on provided parameters
    if status:
        query = query.filter(Order.payment_status == status)
    
    # Item name filter requires joining with OrderItem
    if item_name:
        query = query.join(OrderItem).filter(OrderItem.item_name.ilike(f"%{item_name}%"))
    
    # For quantity filters, we need to handle multiple items per order differently
    if min_quantity or max_quantity:
        # Only join if not already joined above
        if not item_name:
            query = query.join(OrderItem)
        
        # For min_quantity, we want orders where ANY item meets the criteria
        if min_quantity:
            query = query.filter(OrderItem.quantity >= min_quantity)
        
        # For max_quantity, we want orders where ANY item meets the criteria
        if max_quantity:
            query = query.filter(OrderItem.quantity <= max_quantity)
    
    # Date filters
    if order_date_start:
        query = query.filter(Order.order_date >= order_date_start)
    
    if order_date_end:
        # Add 1 day to end date to include the entire day
        query = query.filter(Order.order_date <= order_date_end + 'T23:59:59' if order_date_end else None)
    
    if payment_date_start:
        query = query.filter(Order.payment_date >= payment_date_start)
    
    if payment_date_end:
        # Add 1 day to end date to include the entire day
        query = query.filter(Order.payment_date <= payment_date_end + 'T23:59:59' if payment_date_end else None)
    
    # Sorting
    if sort_by and sort_order:
        if sort_by == "order_date":
            if sort_order.lower() == "asc":
                query = query.order_by(Order.order_date.asc())
            else:
                query = query.order_by(Order.order_date.desc())
        elif sort_by == "payment_date":
            if sort_order.lower() == "asc":
                query = query.order_by(Order.payment_date.asc())
            else:
                query = query.order_by(Order.payment_date.desc())
        elif sort_by == "total_price":
            if sort_order.lower() == "asc":
                query = query.order_by(Order.total_price.asc())
            else:
                query = query.order_by(Order.total_price.desc())
        else:
            # Default sort by order_date descending
            query = query.order_by(Order.order_date.desc())
    else:
        # Default sort by order_date descending
        query = query.order_by(Order.order_date.desc())
    
    # Use distinct to avoid duplicate orders due to joins
    query = query.distinct()
    
    # Add eager loading for order_items
    query = query.options(joinedload(Order.order_items))
    
    orders = query.all()
    
    # Explicitly create OrderResponse objects with items
    result = []
    for order in orders:
        items = [OrderItemResponse.model_validate(item) for item in order.order_items]
        order_dict = OrderResponse.model_validate(order)
        order_dict.items = items
        result.append(order_dict)
    
    return result

# Order item operations
def add_item_to_order(order_id: int, item_id: int, quantity: int, db: Session = Depends(get_db)):
    """Add a new item to an existing order"""
    # Check if order exists and is not completed or cancelled
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order or order.payment_status != "pending":
        return False, "Order not found or not in pending status"
    
    # Check if item exists
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        return False, "Item not found"
    
    # Check if there's enough inventory
    if item.remaining_quantity is not None and item.remaining_quantity < quantity:
        return False, f"Not enough stock. Only {item.remaining_quantity} available."
    
    # Check if item already exists in this order
    existing_order_item = db.query(OrderItem).filter(
        OrderItem.order_id == order_id,
        OrderItem.item_id == item_id
    ).first()
    
    if existing_order_item:
        # Update existing order item
        old_quantity = existing_order_item.quantity
        existing_order_item.quantity += quantity
        existing_order_item.subtotal = existing_order_item.quantity * existing_order_item.unit_price
        
        # Update order total price
        order.total_price += quantity * item.price_per_quantity
        
        # Update inventory if tracked
        if item.remaining_quantity is not None:
            item.remaining_quantity -= quantity
    else:
        # Create new order item
        subtotal = quantity * item.price_per_quantity
        order_item = OrderItem(
            order_id=order_id,
            item_id=item_id,
            item_name=item.item_name,
            quantity=quantity,
            unit_price=item.price_per_quantity,
            subtotal=subtotal
        )
        db.add(order_item)
        
        # Update order total price
        order.total_price += subtotal
        
        # Update inventory if tracked
        if item.remaining_quantity is not None:
            item.remaining_quantity -= quantity
    
    db.commit()
    return True, "Item added to order"

def remove_item_from_order(order_id: int, order_item_id: int, db: Session = Depends(get_db)):
    """Remove an item from an existing order"""
    # Check if order exists and is not completed or cancelled
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order or order.payment_status != "pending":
        return False, "Order not found or not in pending status"
    
    # Check if order item exists and belongs to this order
    order_item = db.query(OrderItem).filter(
        OrderItem.id == order_item_id,
        OrderItem.order_id == order_id
    ).first()
    
    if not order_item:
        return False, "Order item not found"
    
    # Update order total price
    order.total_price -= order_item.subtotal
    
    # Restore inventory if tracked
    item = db.query(Item).filter(Item.id == order_item.item_id).first()
    if item and item.remaining_quantity is not None:
        item.remaining_quantity += order_item.quantity
    
    # Remove the order item
    db.delete(order_item)
    
    # If this was the last item, cancel the order
    remaining_items = db.query(OrderItem).filter(OrderItem.order_id == order_id).count()
    if remaining_items == 0:
        db.delete(order)
    
    db.commit()
    return True, "Item removed from order"

def update_order_item_quantity(order_id: int, order_item_id: int, new_quantity: int, db: Session = Depends(get_db)):
    """Update the quantity of an item in an order"""
    # Check if order exists and is not completed or cancelled
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order or order.payment_status != "pending":
        return False, "Order not found or not in pending status"
    
    # Check if order item exists and belongs to this order
    order_item = db.query(OrderItem).filter(
        OrderItem.id == order_item_id,
        OrderItem.order_id == order_id
    ).first()
    
    if not order_item:
        return False, "Order item not found"
    
    # If new quantity is 0 or less, remove the item
    if new_quantity <= 0:
        return remove_item_from_order(order_id, order_item_id, db)
    
    # Calculate quantity difference
    quantity_diff = new_quantity - order_item.quantity
    
    # Check if there's enough inventory for an increase
    if quantity_diff > 0:
        item = db.query(Item).filter(Item.id == order_item.item_id).first()
        if item.remaining_quantity is not None and item.remaining_quantity < quantity_diff:
            return False, f"Not enough stock. Only {item.remaining_quantity} additional units available."
        
        # Update inventory if tracked
        if item.remaining_quantity is not None:
            item.remaining_quantity -= quantity_diff
    elif quantity_diff < 0:
        # Restore inventory for a decrease
        item = db.query(Item).filter(Item.id == order_item.item_id).first()
        if item and item.remaining_quantity is not None:
            item.remaining_quantity -= quantity_diff  # Negative diff, so subtract it (which adds)
    
    # Update order total price
    old_subtotal = order_item.subtotal
    order_item.quantity = new_quantity
    order_item.subtotal = new_quantity * order_item.unit_price
    order.total_price = order.total_price - old_subtotal + order_item.subtotal
    
    db.commit()
    return True, "Order item quantity updated"

def get_order_items(order_id: int, db: Session = Depends(get_db)):
    """Get all items in an order"""
    order_items = db.query(OrderItem).filter(OrderItem.order_id == order_id).all()
    return [OrderItemResponse.model_validate(item) for item in order_items]

# Initialize the database when this module is imported
init_db()
