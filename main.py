from fastapi import FastAPI, Request, Form, HTTPException, Query, Body, Path, Depends
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from datetime import datetime
from typing import Optional, List, Dict, Any
import uvicorn
import database as db
from sqlalchemy.orm import Session

# Import Pydantic schemas
from schemas import (
    ItemBase, ItemCreate, ItemUpdate, ItemResponse,
    OrderBase, OrderCreate, OrderResponse,
    OrderItemBase, OrderItemCreate, OrderItemUpdate, OrderItemResponse
)

app = FastAPI(title="Billing App")

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")

# Templates
templates = Jinja2Templates(directory="templates")
# Routes

# Routes
@app.get("/", response_class=HTMLResponse)
async def home(request: Request, search: str = "", db_session: Session = Depends(db.get_db)):
    # Always get all orders
    completed_orders = db.get_completed_orders(db_session)
    pending_orders = db.get_pending_orders(db_session)
    order_history = db.get_order_history(db_session)
    
    # If search query is provided, filter items
    if search:
        items = db.search_items(search, db_session)
    else:
        items = db.get_all_items(db_session)
    
    return templates.TemplateResponse(
        "index.html",
        {
            "request": request,
            "items": items,
            "completed_orders": completed_orders,
            "pending_orders": pending_orders,
            "order_history": order_history,
            "search_query": search
        }
    )

@app.get("/api/items", response_class=JSONResponse)
async def get_items(search: str = Query(None), db_session: Session = Depends(db.get_db)):
    if search:
        items = db.search_items(search, db_session)
    else:
        items = db.get_all_items(db_session)
    return items

@app.get("/api/orders", response_class=JSONResponse)
async def get_orders(db_session: Session = Depends(db.get_db)):
    orders = db.get_all_orders(db_session)
    return orders

@app.post("/api/create-order")
async def create_order(
    order: OrderCreate,
    db_session: Session = Depends(db.get_db)
):
    if not order.items:
        raise HTTPException(status_code=400, detail="Order must contain at least one item")
    
    # Prepare items for the order
    order_items = []
    
    for order_item in order.items:
        item = db.get_item_by_id(order_item.item_id, db_session)
        if not item:
            raise HTTPException(status_code=404, detail=f"Item with ID {order_item.item_id} not found")
        
        # Check inventory
        if item.remaining_quantity is not None:
            if item.remaining_quantity < order_item.quantity:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Not enough stock for {item.item_name}. Only {item.remaining_quantity} available."
                )
            
            # Update remaining quantity
            db.update_item_quantity(order_item.item_id, -order_item.quantity, db_session)
        
        # Add to order items list
        subtotal = item.price_per_quantity * order_item.quantity
        order_items.append({
            "item_id": order_item.item_id,
            "item_name": item.item_name,
            "quantity": order_item.quantity,
            "unit_price": item.price_per_quantity,
            "subtotal": subtotal
        })
    
    # Create new order
    order_id = db.create_order(
        items=order_items,
        payment_status=order.payment_status,
        db=db_session
    )
    
    return {"order_id": order_id, "success": True}

@app.post("/api/update-payment-status/{order_id}")
async def update_payment_status(order_id: int, db_session: Session = Depends(db.get_db)):
    order = db.get_order_by_id(order_id, db_session)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    db.update_payment_status(order_id, db=db_session)
    return RedirectResponse(url="/", status_code=303)

@app.post("/api/cancel-order/{order_id}")
async def cancel_order(order_id: int, db_session: Session = Depends(db.get_db)):
    order = db.get_order_by_id(order_id, db_session)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    success = db.cancel_order(order_id, db_session)
    if not success:
        raise HTTPException(status_code=400, detail="Failed to cancel order")
    
    return RedirectResponse(url="/", status_code=303)

@app.get("/api/search-items")
async def search_items(query: str = Query(...), db_session: Session = Depends(db.get_db)):
    items = db.search_items(query, db_session)
    return items

@app.get("/search-orders", response_class=HTMLResponse)
async def search_orders_page(request: Request):
    return templates.TemplateResponse(
        "search_orders.html",
        {
            "request": request
        }
    )

@app.get("/api/search-orders", response_class=JSONResponse)
async def search_orders(
    status: Optional[str] = Query(None),
    item_name: Optional[str] = Query(None),
    min_quantity: Optional[int] = Query(None),
    max_quantity: Optional[int] = Query(None),
    order_date_start: Optional[str] = Query(None),
    order_date_end: Optional[str] = Query(None),
    payment_date_start: Optional[str] = Query(None),
    payment_date_end: Optional[str] = Query(None),
    sort_by: Optional[str] = Query("order_date"),
    sort_order: Optional[str] = Query("desc"),
    db_session: Session = Depends(db.get_db)
):
    # Call the database search function
    orders = db.search_orders(
        status=status,
        item_name=item_name,
        min_quantity=min_quantity,
        max_quantity=max_quantity,
        order_date_start=order_date_start,
        order_date_end=order_date_end,
        payment_date_start=payment_date_start,
        payment_date_end=payment_date_end,
        db=db_session
    )
    
    # With Pydantic models, the items are already included in the order response
    # Convert to dict for consistency with the rest of the API
    enhanced_orders = [order.model_dump() for order in orders]
    
    # Handle sorting (since SQLite might not handle complex sorting well)
    if sort_by and sort_by in ["id", "item_name", "quantity", "price", "order_date", "payment_date", "total_price"]:
        reverse = sort_order.lower() == "desc"
        if sort_by in ["quantity", "price", "id", "total_price"]:
            enhanced_orders = sorted(enhanced_orders, key=lambda x: float(x.get(sort_by, 0)) if x.get(sort_by) is not None else 0, reverse=reverse)
        else:
            enhanced_orders = sorted(enhanced_orders, key=lambda x: x.get(sort_by, "") if x.get(sort_by) is not None else "", reverse=reverse)
    
    return enhanced_orders

# Inventory Management Routes
@app.get("/inventory", response_class=HTMLResponse)
async def inventory_page(request: Request, db_session: Session = Depends(db.get_db)):
    items = db.get_all_items(db_session)
    order_history = db.get_order_history(db_session)
    
    return templates.TemplateResponse(
        "inventory.html",
        {
            "request": request,
            "items": items,
            "order_history": order_history
        }
    )

@app.get("/api/items/{item_id}", response_class=JSONResponse)
async def get_item(item_id: int, db_session: Session = Depends(db.get_db)):
    item = db.get_item_by_id(item_id, db_session)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item

@app.post("/api/items", response_class=JSONResponse)
async def create_item(item: ItemCreate, db_session: Session = Depends(db.get_db)):
    try:
        item_id = db.add_item(
            item_name=item.item_name,
            price_per_quantity=item.price_per_quantity,
            remaining_quantity=item.remaining_quantity,
            db=db_session
        )
        return {"id": item_id, "success": True}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.put("/api/items/{item_id}", response_class=JSONResponse)
async def update_item(item_id: int, item: ItemUpdate, db_session: Session = Depends(db.get_db)):
    existing_item = db.get_item_by_id(item_id, db_session)
    if not existing_item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    try:
        success = db.update_item(
            item_id=item_id,
            item_name=item.item_name,
            price_per_quantity=item.price_per_quantity,
            remaining_quantity=item.remaining_quantity,
            db=db_session
        )
        return {"success": success}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/api/items/{item_id}", response_class=JSONResponse)
async def delete_item(item_id: int, db_session: Session = Depends(db.get_db)):
    existing_item = db.get_item_by_id(item_id, db_session)
    if not existing_item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    success = db.delete_item(item_id, db_session)
    if not success:
        raise HTTPException(status_code=400, detail="Cannot delete item with existing orders")
    
    return {"success": True}

@app.post("/api/restock-all", response_class=JSONResponse)
async def restock_all(db_session: Session = Depends(db.get_db)):
    success = db.restock_all_items(quantity=9999, db=db_session)
    return {"success": success}

@app.post("/api/orders/{order_id}/items")
async def add_item_to_order(
    order_id: int,
    order_item: OrderItemCreate,
    db_session: Session = Depends(db.get_db)
):
    success, message = db.add_item_to_order(
        order_id=order_id,
        item_id=order_item.item_id,
        quantity=order_item.quantity,
        db=db_session
    )
    
    if not success:
        raise HTTPException(status_code=400, detail=message)
    
    return {"success": True, "message": message}

@app.delete("/api/orders/{order_id}/items/{order_item_id}")
async def remove_item_from_order(
    order_id: int,
    order_item_id: int,
    db_session: Session = Depends(db.get_db)
):
    success, message = db.remove_item_from_order(
        order_id=order_id,
        order_item_id=order_item_id,
        db=db_session
    )
    
    if not success:
        raise HTTPException(status_code=400, detail=message)
    
    return {"success": True, "message": message}

@app.put("/api/orders/{order_id}/items/{order_item_id}")
async def update_order_item(
    order_id: int,
    order_item_id: int,
    order_item: OrderItemUpdate,
    db_session: Session = Depends(db.get_db)
):
    success, message = db.update_order_item_quantity(
        order_id=order_id,
        order_item_id=order_item_id,
        new_quantity=order_item.quantity,
        db=db_session
    )
    
    if not success:
        raise HTTPException(status_code=400, detail=message)
    
    return {"success": True, "message": message}

@app.get("/api/orders/{order_id}/items")
async def get_order_items(
    order_id: int,
    db_session: Session = Depends(db.get_db)
):
    # Check if order exists
    order = db.get_order_by_id(order_id, db_session)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    order_items = db.get_order_items(order_id, db_session)
    return order_items

@app.post("/api/create-order-form")
async def create_order_form(
    item_id: int = Form(...),
    quantity: int = Form(...),
    payment_status: str = Form(...),
    db_session: Session = Depends(db.get_db)
):
    # Create an order with a single item (for backward compatibility with the form)
    order = OrderCreate(
        items=[OrderItemCreate(item_id=item_id, quantity=quantity)],
        payment_status=payment_status
    )
    
    result = await create_order(order, db_session)
    return RedirectResponse(url="/", status_code=303)

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
