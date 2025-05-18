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
        orders (relationship): Relationship to Order model
    """
    __tablename__ = "items"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    item_name = Column(String(100), nullable=False, unique=True, index=True)
    price_per_quantity = Column(Float, CheckConstraint('price_per_quantity > 0'), nullable=False)
    remaining_quantity = Column(Integer, CheckConstraint('remaining_quantity IS NULL OR remaining_quantity >= 0'), nullable=True)
    
    # Relationships
    orders = relationship("Order", back_populates="item", cascade="all, delete-orphan")
    
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


class Order(Base):
    """
    Order model representing customer orders.
    
    Attributes:
        id (int): Primary key, unique identifier for each order
        item_id (int): Foreign key reference to the Item model
        item_name (str): Name of the item (denormalized for convenience)
        quantity (int): Quantity of items ordered
        price (float): Total price of the order
        payment_status (str): Status of the order (pending, completed, cancelled)
        order_date (datetime): Date and time when the order was placed
        payment_date (datetime, optional): Date and time when payment was completed
        item (relationship): Relationship to Item model
    """
    __tablename__ = "orders"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    item_id = Column(Integer, ForeignKey("items.id", ondelete="CASCADE"), nullable=False)
    item_name = Column(String(100), nullable=False)
    quantity = Column(Integer, CheckConstraint('quantity > 0'), nullable=False)
    price = Column(Float, CheckConstraint('price >= 0'), nullable=False)
    payment_status = Column(String(20), CheckConstraint("payment_status IN ('pending', 'completed', 'cancelled')"), nullable=False)
    order_date = Column(String(50), nullable=False, default=lambda: datetime.now().isoformat())
    payment_date = Column(String(50), nullable=True)
    
    # Relationships
    item = relationship("Item", back_populates="orders")
    
    __table_args__ = (
        # Add any table-level constraints here if needed
    )
    
    def __repr__(self):
        return f"<Order(id={self.id}, item='{self.item_name}', status='{self.payment_status}')>"
    
    def to_dict(self):
        """Convert order to dictionary representation"""
        return {
            "id": self.id,
            "item_id": self.item_id,
            "item_name": self.item_name,
            "quantity": self.quantity,
            "price": self.price,
            "payment_status": self.payment_status,
            "order_date": self.order_date,
            "payment_date": self.payment_date
        }
