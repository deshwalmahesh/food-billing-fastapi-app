"""
Database models for the Food Billing Application.
This file contains SQLAlchemy ORM model definitions with proper relationships and constraints.
"""

from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, CheckConstraint
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime

Base = declarative_base()

class Item(Base):
    """
    Item model representing food items available for purchase.
    
    Attributes:
        id (int): Primary key, unique identifier for each item
        item_name (str): Name of the food item
        price_per_quantity (float): Price per unit of the item
        remaining_quantity (int, optional): Current inventory quantity
        order_items (relationship): Relationship to OrderItem model
    """
    __tablename__ = "items"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    item_name = Column(String(100), nullable=False, unique=True, index=True)
    price_per_quantity = Column(Float, CheckConstraint('price_per_quantity > 0'), nullable=False)
    remaining_quantity = Column(Integer, CheckConstraint('remaining_quantity IS NULL OR remaining_quantity >= 0'), nullable=True)
    
    # Relationships
    order_items = relationship("OrderItem", back_populates="item", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Item(id={self.id}, name='{self.item_name}', price={self.price_per_quantity})>"
    
    def to_dict(self):
        """Convert item to dictionary representation"""
        return {
            "id": self.id,
            "item_name": self.item_name,
            "price_per_quantity": self.price_per_quantity,
            "remaining_quantity": self.remaining_quantity
        }


class OrderItem(Base):
    """
    OrderItem model representing individual items within an order.
    
    Attributes:
        id (int): Primary key, unique identifier for each order item
        order_id (int): Foreign key reference to the Order model
        item_id (int): Foreign key reference to the Item model
        item_name (str): Name of the item (denormalized for convenience)
        quantity (int): Quantity of items ordered
        unit_price (float): Price per unit at the time of order
        subtotal (float): Total price for this item (quantity * unit_price)
        order (relationship): Relationship to Order model
        item (relationship): Relationship to Item model
    """
    __tablename__ = "order_items"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False)
    item_id = Column(Integer, ForeignKey("items.id", ondelete="CASCADE"), nullable=False)
    item_name = Column(String(100), nullable=False)
    quantity = Column(Integer, CheckConstraint('quantity > 0'), nullable=False)
    unit_price = Column(Float, CheckConstraint('unit_price > 0'), nullable=False)
    subtotal = Column(Float, CheckConstraint('subtotal >= 0'), nullable=False)
    
    # Relationships
    order = relationship("Order", back_populates="order_items")
    item = relationship("Item", back_populates="order_items")
    
    def __repr__(self):
        return f"<OrderItem(id={self.id}, order_id={self.order_id}, item='{self.item_name}', quantity={self.quantity})>"
    
    def to_dict(self):
        """Convert order item to dictionary representation"""
        return {
            "id": self.id,
            "order_id": self.order_id,
            "item_id": self.item_id,
            "item_name": self.item_name,
            "quantity": self.quantity,
            "unit_price": self.unit_price,
            "subtotal": self.subtotal
        }

class Order(Base):
    """
    Order model representing customer orders.
    
    Attributes:
        id (int): Primary key, unique identifier for each order
        total_price (float): Total price of the order
        payment_status (str): Status of the order (pending, completed, cancelled)
        order_date (datetime): Date and time when the order was placed
        payment_date (datetime, optional): Date and time when payment was completed
        order_items (relationship): Relationship to OrderItem model
    """
    __tablename__ = "orders"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    total_price = Column(Float, CheckConstraint('total_price >= 0'), nullable=False)
    payment_status = Column(String(20), CheckConstraint("payment_status IN ('pending', 'completed', 'cancelled')"), nullable=False)
    order_date = Column(String(50), nullable=False, default=lambda: datetime.now().isoformat())
    payment_date = Column(String(50), nullable=True)
    
    # Relationships
    order_items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
    
    __table_args__ = (
        # Add any table-level constraints here if needed
    )
    
    def __repr__(self):
        return f"<Order(id={self.id}, total_price={self.total_price}, status='{self.payment_status}')>"
    
    def to_dict(self):
        """Convert order to dictionary representation"""
        items_data = []
        for item in self.order_items:
            item_dict = item.to_dict()
            # Ensure all required fields are present
            if 'item_name' not in item_dict:
                item_dict['item_name'] = 'Unknown Item'
            if 'quantity' not in item_dict:
                item_dict['quantity'] = 1
            if 'unit_price' not in item_dict:
                item_dict['unit_price'] = 0
            if 'subtotal' not in item_dict:
                item_dict['subtotal'] = item_dict['unit_price'] * item_dict['quantity']
            items_data.append(item_dict)
            
        return {
            "id": self.id,
            "total_price": self.total_price,
            "payment_status": self.payment_status,
            "order_date": self.order_date,
            "payment_date": self.payment_date,
            "items": items_data
        }
