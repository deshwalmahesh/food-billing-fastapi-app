"""
Pydantic schemas for the Food Billing Application.
These schemas are used for data validation and serialization.
"""

from typing import List, Optional
from pydantic import BaseModel, Field
from datetime import datetime


class ItemBase(BaseModel):
    """Base schema for Item data"""
    item_name: str
    price_per_quantity: float
    remaining_quantity: Optional[int] = None


class ItemCreate(ItemBase):
    """Schema for creating a new Item"""
    pass


class ItemUpdate(ItemBase):
    """Schema for updating an existing Item"""
    pass


class OrderItemBase(BaseModel):
    """Base schema for OrderItem data"""
    item_id: int
    quantity: int


class OrderItemCreate(OrderItemBase):
    """Schema for creating a new OrderItem"""
    pass


class OrderItemUpdate(BaseModel):
    """Schema for updating an existing OrderItem"""
    quantity: int


class OrderItemResponse(BaseModel):
    """Response schema for OrderItem"""
    id: int
    order_id: int
    item_id: int
    item_name: str
    quantity: int
    unit_price: float
    subtotal: float

    model_config = {
        "from_attributes": True,
        "populate_by_name": True
    }


class OrderBase(BaseModel):
    """Base schema for Order data"""
    payment_status: str = "pending"


class OrderCreate(OrderBase):
    """Schema for creating a new Order"""
    items: List[OrderItemCreate]


class OrderResponse(BaseModel):
    """Response schema for Order"""
    id: int
    total_price: float
    payment_status: str
    order_date: str
    payment_date: Optional[str] = None
    items: List[OrderItemResponse] = []

    model_config = {
        "from_attributes": True,
        "populate_by_name": True,
        "arbitrary_types_allowed": True
    }


class ItemResponse(BaseModel):
    """Response schema for Item"""
    id: int
    item_name: str
    price_per_quantity: float
    remaining_quantity: Optional[int] = None

    model_config = {
        "from_attributes": True,
        "populate_by_name": True
    }
