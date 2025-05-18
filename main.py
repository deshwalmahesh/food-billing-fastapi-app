from fastapi import FastAPI, Request, Form, HTTPException, Query, Body, Path, Depends
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from datetime import datetime
from typing import Optional, List, Dict, Any
import uvicorn
import database as db
from pydantic import BaseModel
from sqlalchemy.orm import Session

app = FastAPI(title="Billing App")

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")

# Templates
templates = Jinja2Templates(directory="templates")

# Pydantic models
class ItemCreate(BaseModel):
    item_name: str
    price_per_quantity: float
    remaining_quantity: Optional[int] = None

class ItemUpdate(BaseModel):
    item_name: str
    price_per_quantity: float
    remaining_quantity: Optional[int] = None

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
    item_id: int = Form(...),
    quantity: int = Form(...),
    payment_status: str = Form(...),
    db_session: Session = Depends(db.get_db)
):
    item = db.get_item_by_id(item_id, db_session)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    if item["remaining_quantity"] is not None:
        if item["remaining_quantity"] < quantity:
            raise HTTPException(status_code=400, detail=f"Not enough stock. Only {item['remaining_quantity']} available.")
        
        # Update remaining quantity
        db.update_item_quantity(item_id, -quantity, db_session)
    
    # Create new order
    total_price = item["price_per_quantity"] * quantity
    order_id = db.create_order(
        item_id=item_id,
        item_name=item["item_name"],
        quantity=quantity,
        price=total_price,
        payment_status=payment_status,
        db=db_session
    )
    
    return RedirectResponse(url="/", status_code=303)

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
    
    # Handle sorting (since SQLite might not handle complex sorting well)
    if sort_by and sort_by in ["id", "item_name", "quantity", "price", "order_date", "payment_date"]:
        reverse = sort_order.lower() == "desc"
        if sort_by in ["quantity", "price", "id"]:
            orders = sorted(orders, key=lambda x: float(x[sort_by]) if x[sort_by] is not None else 0, reverse=reverse)
        else:
            orders = sorted(orders, key=lambda x: x[sort_by] if x[sort_by] is not None else "", reverse=reverse)
    
    return orders

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

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
