"""
main.py – FastAPI application entry-point for NeuraBills.
All REST routes are defined here.
"""

import os
import shutil
from datetime import timedelta
from typing import List, Optional

from fastapi import (
    Depends, FastAPI, File, HTTPException, Query,
    UploadFile, status
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

import crud
import models
import schemas
from auth import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    create_access_token,
    get_current_business,
    get_current_user,
    verify_password,
)
from database import Base, engine, get_db

# ── App Initialisation ────────────────────────────────────────────────────────

app = FastAPI(
    title="NeuraBills API",
    description="GST-compliant billing & invoicing SaaS backend",
    version="1.0.0",
)

# CORS – allow the frontend (served on port 3000) to talk to this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create DB tables on startup
Base.metadata.create_all(bind=engine)

# Serve uploaded logos
os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")


# ── Auth Endpoints ────────────────────────────────────────────────────────────

@app.post("/api/auth/register", response_model=schemas.Token, status_code=status.HTTP_201_CREATED, tags=["Auth"])
def register(data: schemas.UserRegister, db: Session = Depends(get_db)):
    """Register a new user and create their business profile."""
    try:
        user = crud.create_user_with_business(db, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    business = db.query(models.Business).filter(models.Business.owner_id == user.id).first()
    token = create_access_token(
        {"sub": str(user.id)},
        timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return schemas.Token(access_token=token, user_id=user.id, business_id=business.id, full_name=user.full_name)


@app.post("/api/auth/login", response_model=schemas.Token, tags=["Auth"])
def login(data: schemas.UserLogin, db: Session = Depends(get_db)):
    """Authenticate user and return a JWT token."""
    user = crud.get_user_by_email(db, data.email)
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    business = db.query(models.Business).filter(models.Business.owner_id == user.id).first()
    token = create_access_token({"sub": str(user.id)})
    return schemas.Token(access_token=token, user_id=user.id, business_id=business.id if business else 0, full_name=user.full_name)


@app.get("/api/auth/me", response_model=schemas.UserOut, tags=["Auth"])
def me(current_user: models.User = Depends(get_current_user)):
    return current_user


# ── Business Endpoints ────────────────────────────────────────────────────────

@app.get("/api/business/profile", response_model=schemas.BusinessOut, tags=["Business"])
def get_business_profile(business: models.Business = Depends(get_current_business)):
    return business


@app.put("/api/business/profile", response_model=schemas.BusinessOut, tags=["Business"])
def update_business_profile(
    data: schemas.BusinessUpdate,
    business: models.Business = Depends(get_current_business),
    db: Session = Depends(get_db),
):
    return crud.update_business(db, business, data)


@app.post("/api/business/logo", tags=["Business"])
def upload_logo(
    file: UploadFile = File(...),
    business: models.Business = Depends(get_current_business),
    db: Session = Depends(get_db),
):
    """Upload a business logo (PNG/JPG). Returns the URL."""
    if file.content_type not in ("image/png", "image/jpeg", "image/jpg"):
        raise HTTPException(status_code=400, detail="Only PNG/JPG images allowed")
    filename = f"logo_{business.id}.png"
    path = f"uploads/{filename}"
    with open(path, "wb") as f:
        shutil.copyfileobj(file.file, f)
    business.logo_url = f"/uploads/{filename}"
    db.commit()
    return {"logo_url": business.logo_url}


# ── Customer Endpoints ────────────────────────────────────────────────────────

@app.get("/api/customers", response_model=List[schemas.CustomerOut], tags=["Customers"])
def list_customers(
    search: Optional[str] = Query(None),
    business: models.Business = Depends(get_current_business),
    db: Session = Depends(get_db),
):
    return crud.get_customers(db, business.id, search)


@app.post("/api/customers", response_model=schemas.CustomerOut, status_code=201, tags=["Customers"])
def create_customer(
    data: schemas.CustomerCreate,
    business: models.Business = Depends(get_current_business),
    db: Session = Depends(get_db),
):
    return crud.create_customer(db, business.id, data)


@app.get("/api/customers/{customer_id}", response_model=schemas.CustomerOut, tags=["Customers"])
def get_customer(
    customer_id: int,
    business: models.Business = Depends(get_current_business),
    db: Session = Depends(get_db),
):
    c = crud.get_customer(db, business.id, customer_id)
    if not c:
        raise HTTPException(404, "Customer not found")
    return c


@app.put("/api/customers/{customer_id}", response_model=schemas.CustomerOut, tags=["Customers"])
def update_customer(
    customer_id: int,
    data: schemas.CustomerUpdate,
    business: models.Business = Depends(get_current_business),
    db: Session = Depends(get_db),
):
    c = crud.get_customer(db, business.id, customer_id)
    if not c:
        raise HTTPException(404, "Customer not found")
    return crud.update_customer(db, c, data)


@app.delete("/api/customers/{customer_id}", status_code=204, tags=["Customers"])
def delete_customer(
    customer_id: int,
    business: models.Business = Depends(get_current_business),
    db: Session = Depends(get_db),
):
    c = crud.get_customer(db, business.id, customer_id)
    if not c:
        raise HTTPException(404, "Customer not found")
    crud.delete_customer(db, c)


# ── Product Endpoints ─────────────────────────────────────────────────────────

@app.get("/api/products", response_model=List[schemas.ProductOut], tags=["Products"])
def list_products(
    search: Optional[str] = Query(None),
    business: models.Business = Depends(get_current_business),
    db: Session = Depends(get_db),
):
    return crud.get_products(db, business.id, search)


@app.post("/api/products", response_model=schemas.ProductOut, status_code=201, tags=["Products"])
def create_product(
    data: schemas.ProductCreate,
    business: models.Business = Depends(get_current_business),
    db: Session = Depends(get_db),
):
    return crud.create_product(db, business.id, data)


@app.get("/api/products/{product_id}", response_model=schemas.ProductOut, tags=["Products"])
def get_product(
    product_id: int,
    business: models.Business = Depends(get_current_business),
    db: Session = Depends(get_db),
):
    p = crud.get_product(db, business.id, product_id)
    if not p:
        raise HTTPException(404, "Product not found")
    return p


@app.put("/api/products/{product_id}", response_model=schemas.ProductOut, tags=["Products"])
def update_product(
    product_id: int,
    data: schemas.ProductUpdate,
    business: models.Business = Depends(get_current_business),
    db: Session = Depends(get_db),
):
    p = crud.get_product(db, business.id, product_id)
    if not p:
        raise HTTPException(404, "Product not found")
    return crud.update_product(db, p, data)


@app.delete("/api/products/{product_id}", status_code=204, tags=["Products"])
def delete_product(
    product_id: int,
    business: models.Business = Depends(get_current_business),
    db: Session = Depends(get_db),
):
    p = crud.get_product(db, business.id, product_id)
    if not p:
        raise HTTPException(404, "Product not found")
    crud.delete_product(db, p)


# ── Invoice Endpoints ─────────────────────────────────────────────────────────

@app.post("/api/invoices", response_model=schemas.InvoiceOut, status_code=201, tags=["Invoices"])
def create_invoice(
    data: schemas.InvoiceCreate,
    business: models.Business = Depends(get_current_business),
    db: Session = Depends(get_db),
):
    # Validate customer belongs to business
    customer = crud.get_customer(db, business.id, data.customer_id)
    if not customer:
        raise HTTPException(400, "Customer not found in your business")
    invoice = crud.create_invoice(db, business, data)
    return _invoice_to_out(invoice)


@app.get("/api/invoices", response_model=List[schemas.InvoiceOut], tags=["Invoices"])
def list_invoices(
    status: Optional[str] = Query(None),
    customer_id: Optional[int] = Query(None),
    business: models.Business = Depends(get_current_business),
    db: Session = Depends(get_db),
):
    invoices = crud.get_invoices(db, business.id, status, customer_id)
    return [_invoice_to_out(i) for i in invoices]


@app.get("/api/invoices/{invoice_id}", response_model=schemas.InvoiceOut, tags=["Invoices"])
def get_invoice(
    invoice_id: int,
    business: models.Business = Depends(get_current_business),
    db: Session = Depends(get_db),
):
    inv = crud.get_invoice(db, business.id, invoice_id)
    if not inv:
        raise HTTPException(404, "Invoice not found")
    return _invoice_to_out(inv)


@app.put("/api/invoices/{invoice_id}/status", response_model=schemas.InvoiceOut, tags=["Invoices"])
def update_invoice_status(
    invoice_id: int,
    data: schemas.InvoiceStatusUpdate,
    business: models.Business = Depends(get_current_business),
    db: Session = Depends(get_db),
):
    inv = crud.get_invoice(db, business.id, invoice_id)
    if not inv:
        raise HTTPException(404, "Invoice not found")
    inv = crud.update_invoice_status(db, inv, data.status)
    return _invoice_to_out(inv)


def _invoice_to_out(inv: models.Invoice) -> schemas.InvoiceOut:
    """Helper to build InvoiceOut with computed outstanding field."""
    return schemas.InvoiceOut(
        id=inv.id,
        invoice_number=inv.invoice_number,
        customer_id=inv.customer_id,
        customer_name=inv.customer.name if inv.customer else None,
        invoice_date=inv.invoice_date,
        due_date=inv.due_date,
        supply_type=inv.supply_type.value if hasattr(inv.supply_type, "value") else inv.supply_type,
        status=inv.status.value if hasattr(inv.status, "value") else inv.status,
        notes=inv.notes,
        subtotal=inv.subtotal,
        total_cgst=inv.total_cgst,
        total_sgst=inv.total_sgst,
        total_igst=inv.total_igst,
        grand_total=inv.grand_total,
        amount_paid=inv.amount_paid,
        outstanding=round(inv.grand_total - inv.amount_paid, 2),
        items=[schemas.InvoiceItemOut.model_validate(item) for item in inv.items],
    )


# ── Payment Endpoints ─────────────────────────────────────────────────────────

@app.post("/api/payments", response_model=schemas.PaymentOut, status_code=201, tags=["Payments"])
def record_payment(
    data: schemas.PaymentCreate,
    business: models.Business = Depends(get_current_business),
    db: Session = Depends(get_db),
):
    try:
        return crud.create_payment(db, business.id, data)
    except ValueError as e:
        raise HTTPException(400, str(e))


@app.get("/api/payments", response_model=List[schemas.PaymentOut], tags=["Payments"])
def list_payments(
    invoice_id: Optional[int] = Query(None),
    business: models.Business = Depends(get_current_business),
    db: Session = Depends(get_db),
):
    return crud.get_payments(db, business.id, invoice_id)


# ── Reports Endpoints ─────────────────────────────────────────────────────────

@app.get("/api/reports/sales", response_model=schemas.SalesSummary, tags=["Reports"])
def sales_report(
    business: models.Business = Depends(get_current_business),
    db: Session = Depends(get_db),
):
    return crud.sales_summary(db, business.id)


@app.get("/api/reports/gst", response_model=schemas.GSTSummary, tags=["Reports"])
def gst_report(
    month: Optional[int] = Query(None, ge=1, le=12),
    year: Optional[int] = Query(None, ge=2000),
    business: models.Business = Depends(get_current_business),
    db: Session = Depends(get_db),
):
    return crud.gst_summary(db, business.id, month, year)


@app.get("/api/reports/customers", response_model=List[schemas.CustomerReport], tags=["Reports"])
def customer_report(
    business: models.Business = Depends(get_current_business),
    db: Session = Depends(get_db),
):
    return crud.customer_report(db, business.id)


@app.get("/api/reports/aging", response_model=List[schemas.AgingBucket], tags=["Reports"])
def aging_report(
    business: models.Business = Depends(get_current_business),
    db: Session = Depends(get_db),
):
    return crud.invoice_aging(db, business.id)


# ── Health Check ──────────────────────────────────────────────────────────────

@app.get("/api/health", tags=["System"])
def health():
    return {"status": "ok", "service": "NeuraBills API v1.0"}
