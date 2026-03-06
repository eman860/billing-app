"""
crud.py – CRUD operations for all NeuraBills models.
GST calculation logic lives here.
"""

from datetime import datetime
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func

import models
import schemas
from auth import hash_password


# ── GST Calculation Helper ────────────────────────────────────────────────────

def calculate_gst_for_item(
    unit_price: float,
    quantity: float,
    tax_rate: float,
    supply_type: str,  # "intrastate" | "interstate"
) -> dict:
    """
    Compute GST amounts for a single invoice line item.

    Intrastate supply: CGST = SGST = tax_rate / 2  (both applied)
    Interstate supply: IGST = tax_rate              (CGST & SGST = 0)
    """
    taxable_amount = round(unit_price * quantity, 2)

    if supply_type == "intrastate":
        half_rate = round(tax_rate / 2, 2)
        cgst_rate = half_rate
        sgst_rate = half_rate
        igst_rate = 0.0
        cgst_amount = round(taxable_amount * cgst_rate / 100, 2)
        sgst_amount = round(taxable_amount * sgst_rate / 100, 2)
        igst_amount = 0.0
    else:  # interstate
        cgst_rate = 0.0
        sgst_rate = 0.0
        igst_rate = tax_rate
        cgst_amount = 0.0
        sgst_amount = 0.0
        igst_amount = round(taxable_amount * igst_rate / 100, 2)

    total_tax = cgst_amount + sgst_amount + igst_amount
    total_amount = round(taxable_amount + total_tax, 2)

    return {
        "taxable_amount": taxable_amount,
        "cgst_rate": cgst_rate,
        "sgst_rate": sgst_rate,
        "igst_rate": igst_rate,
        "cgst_amount": cgst_amount,
        "sgst_amount": sgst_amount,
        "igst_amount": igst_amount,
        "total_amount": total_amount,
    }


# ── Auth / User ───────────────────────────────────────────────────────────────

def create_user_with_business(db: Session, data: schemas.UserRegister) -> models.User:
    """Register a new user and create their initial business record."""
    # Check for duplicate email
    if db.query(models.User).filter(models.User.email == data.email).first():
        raise ValueError("Email already registered")

    user = models.User(
        email=data.email,
        full_name=data.full_name,
        password_hash=hash_password(data.password),
        role=models.UserRole.owner,
    )
    db.add(user)
    db.flush()  # Get user.id without committing

    business = models.Business(
        owner_id=user.id,
        name=data.business_name,
    )
    db.add(business)
    db.commit()
    db.refresh(user)
    return user


def get_user_by_email(db: Session, email: str) -> Optional[models.User]:
    return db.query(models.User).filter(models.User.email == email).first()


# ── Business ──────────────────────────────────────────────────────────────────

def update_business(db: Session, business: models.Business, data: schemas.BusinessUpdate) -> models.Business:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(business, field, value)
    db.commit()
    db.refresh(business)
    return business


# ── Customers ─────────────────────────────────────────────────────────────────

def create_customer(db: Session, business_id: int, data: schemas.CustomerCreate) -> models.Customer:
    customer = models.Customer(business_id=business_id, **data.model_dump())
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return customer


def get_customers(db: Session, business_id: int, search: Optional[str] = None) -> List[models.Customer]:
    q = db.query(models.Customer).filter(models.Customer.business_id == business_id)
    if search:
        q = q.filter(models.Customer.name.ilike(f"%{search}%"))
    return q.order_by(models.Customer.name).all()


def get_customer(db: Session, business_id: int, customer_id: int) -> Optional[models.Customer]:
    return (
        db.query(models.Customer)
        .filter(models.Customer.business_id == business_id, models.Customer.id == customer_id)
        .first()
    )


def update_customer(db: Session, customer: models.Customer, data: schemas.CustomerUpdate) -> models.Customer:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(customer, field, value)
    db.commit()
    db.refresh(customer)
    return customer


def delete_customer(db: Session, customer: models.Customer) -> None:
    db.delete(customer)
    db.commit()


# ── Products ──────────────────────────────────────────────────────────────────

def create_product(db: Session, business_id: int, data: schemas.ProductCreate) -> models.Product:
    product = models.Product(business_id=business_id, **data.model_dump())
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


def get_products(db: Session, business_id: int, search: Optional[str] = None) -> List[models.Product]:
    q = db.query(models.Product).filter(models.Product.business_id == business_id)
    if search:
        q = q.filter(models.Product.name.ilike(f"%{search}%"))
    return q.order_by(models.Product.name).all()


def get_product(db: Session, business_id: int, product_id: int) -> Optional[models.Product]:
    return (
        db.query(models.Product)
        .filter(models.Product.business_id == business_id, models.Product.id == product_id)
        .first()
    )


def update_product(db: Session, product: models.Product, data: schemas.ProductUpdate) -> models.Product:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(product, field, value)
    db.commit()
    db.refresh(product)
    return product


def delete_product(db: Session, product: models.Product) -> None:
    db.delete(product)
    db.commit()


# ── Invoices ──────────────────────────────────────────────────────────────────

def _next_invoice_number(db: Session, business: models.Business) -> str:
    """Generate sequential invoice number, e.g. INV-0042."""
    number = f"{business.invoice_prefix}-{business.invoice_counter:04d}"
    business.invoice_counter += 1
    return number


def create_invoice(db: Session, business: models.Business, data: schemas.InvoiceCreate) -> models.Invoice:
    invoice_number = _next_invoice_number(db, business)

    invoice = models.Invoice(
        business_id=business.id,
        customer_id=data.customer_id,
        invoice_number=invoice_number,
        invoice_date=data.invoice_date or datetime.utcnow(),
        due_date=data.due_date,
        supply_type=data.supply_type,
        status=models.InvoiceStatus.draft,
        notes=data.notes,
    )
    db.add(invoice)
    db.flush()

    subtotal = total_cgst = total_sgst = total_igst = 0.0

    for item_data in data.items:
        gst = calculate_gst_for_item(
            unit_price=item_data.unit_price,
            quantity=item_data.quantity,
            tax_rate=item_data.tax_rate,
            supply_type=data.supply_type,
        )
        item = models.InvoiceItem(
            invoice_id=invoice.id,
            product_id=item_data.product_id,
            description=item_data.description,
            hsn_sac=item_data.hsn_sac,
            quantity=item_data.quantity,
            unit_price=item_data.unit_price,
            tax_rate=item_data.tax_rate,
            **gst,
        )
        db.add(item)
        subtotal += gst["taxable_amount"]
        total_cgst += gst["cgst_amount"]
        total_sgst += gst["sgst_amount"]
        total_igst += gst["igst_amount"]

    invoice.subtotal = round(subtotal, 2)
    invoice.total_cgst = round(total_cgst, 2)
    invoice.total_sgst = round(total_sgst, 2)
    invoice.total_igst = round(total_igst, 2)
    invoice.grand_total = round(subtotal + total_cgst + total_sgst + total_igst, 2)

    db.commit()
    db.refresh(invoice)
    return invoice


def get_invoices(
    db: Session,
    business_id: int,
    status: Optional[str] = None,
    customer_id: Optional[int] = None,
) -> List[models.Invoice]:
    q = db.query(models.Invoice).filter(models.Invoice.business_id == business_id)
    if status:
        q = q.filter(models.Invoice.status == status)
    if customer_id:
        q = q.filter(models.Invoice.customer_id == customer_id)
    return q.order_by(models.Invoice.invoice_date.desc()).all()


def get_invoice(db: Session, business_id: int, invoice_id: int) -> Optional[models.Invoice]:
    return (
        db.query(models.Invoice)
        .filter(models.Invoice.business_id == business_id, models.Invoice.id == invoice_id)
        .first()
    )


def update_invoice_status(db: Session, invoice: models.Invoice, status: str) -> models.Invoice:
    invoice.status = status
    db.commit()
    db.refresh(invoice)
    return invoice


# ── Payments ──────────────────────────────────────────────────────────────────

def create_payment(db: Session, business_id: int, data: schemas.PaymentCreate) -> models.Payment:
    # Validate invoice belongs to business
    invoice = (
        db.query(models.Invoice)
        .filter(models.Invoice.id == data.invoice_id, models.Invoice.business_id == business_id)
        .first()
    )
    if not invoice:
        raise ValueError("Invoice not found")

    outstanding = round(invoice.grand_total - invoice.amount_paid, 2)
    if data.amount > outstanding + 0.01:  # tiny float tolerance
        raise ValueError(f"Payment amount ({data.amount}) exceeds outstanding balance ({outstanding})")

    payment = models.Payment(
        invoice_id=data.invoice_id,
        amount=data.amount,
        payment_date=data.payment_date or datetime.utcnow(),
        method=data.method,
        notes=data.notes,
    )
    db.add(payment)

    invoice.amount_paid = round(invoice.amount_paid + data.amount, 2)
    if invoice.amount_paid >= invoice.grand_total - 0.01:
        invoice.status = models.InvoiceStatus.paid

    db.commit()
    db.refresh(payment)
    return payment


def get_payments(db: Session, business_id: int, invoice_id: Optional[int] = None) -> List[models.Payment]:
    q = (
        db.query(models.Payment)
        .join(models.Invoice, models.Invoice.id == models.Payment.invoice_id)
        .filter(models.Invoice.business_id == business_id)
    )
    if invoice_id:
        q = q.filter(models.Payment.invoice_id == invoice_id)
    return q.order_by(models.Payment.payment_date.desc()).all()


# ── Reports ───────────────────────────────────────────────────────────────────

def sales_summary(db: Session, business_id: int) -> schemas.SalesSummary:
    invoices = get_invoices(db, business_id)
    total_sales = sum(i.grand_total for i in invoices)
    total_paid = sum(i.amount_paid for i in invoices)
    return schemas.SalesSummary(
        total_invoices=len(invoices),
        total_sales=round(total_sales, 2),
        total_paid=round(total_paid, 2),
        total_outstanding=round(total_sales - total_paid, 2),
        draft_count=sum(1 for i in invoices if i.status == "draft"),
        sent_count=sum(1 for i in invoices if i.status == "sent"),
        paid_count=sum(1 for i in invoices if i.status == "paid"),
    )


def gst_summary(db: Session, business_id: int, month: Optional[int] = None, year: Optional[int] = None) -> schemas.GSTSummary:
    q = db.query(models.Invoice).filter(
        models.Invoice.business_id == business_id,
        models.Invoice.status != "draft",
    )
    if month and year:
        q = q.filter(
            func.strftime("%m", models.Invoice.invoice_date) == f"{month:02d}",
            func.strftime("%Y", models.Invoice.invoice_date) == str(year),
        )
    invoices = q.all()
    total_taxable = sum(i.subtotal for i in invoices)
    total_cgst = sum(i.total_cgst for i in invoices)
    total_sgst = sum(i.total_sgst for i in invoices)
    total_igst = sum(i.total_igst for i in invoices)
    period = f"{year}-{month:02d}" if month and year else "All Time"
    return schemas.GSTSummary(
        period=period,
        total_taxable=round(total_taxable, 2),
        total_cgst=round(total_cgst, 2),
        total_sgst=round(total_sgst, 2),
        total_igst=round(total_igst, 2),
        total_tax=round(total_cgst + total_sgst + total_igst, 2),
        grand_total=round(total_taxable + total_cgst + total_sgst + total_igst, 2),
    )


def customer_report(db: Session, business_id: int) -> List[schemas.CustomerReport]:
    customers = get_customers(db, business_id)
    result = []
    for c in customers:
        invoices = get_invoices(db, business_id, customer_id=c.id)
        total_billed = sum(i.grand_total for i in invoices)
        total_paid = sum(i.amount_paid for i in invoices)
        result.append(schemas.CustomerReport(
            customer_id=c.id,
            customer_name=c.name,
            total_invoices=len(invoices),
            total_billed=round(total_billed, 2),
            total_paid=round(total_paid, 2),
            outstanding=round(total_billed - total_paid, 2),
        ))
    return result


def invoice_aging(db: Session, business_id: int) -> List[schemas.AgingBucket]:
    """Bucket unpaid invoices by how many days they are overdue."""
    today = datetime.utcnow()
    unpaid = (
        db.query(models.Invoice)
        .filter(
            models.Invoice.business_id == business_id,
            models.Invoice.status != "paid",
            models.Invoice.due_date.isnot(None),
        )
        .all()
    )
    buckets = {"0-30": (0, 0.0), "31-60": (0, 0.0), "61-90": (0, 0.0), "90+": (0, 0.0)}
    for inv in unpaid:
        days = (today - inv.due_date).days
        outstanding = inv.grand_total - inv.amount_paid
        if days <= 30:
            key = "0-30"
        elif days <= 60:
            key = "31-60"
        elif days <= 90:
            key = "61-90"
        else:
            key = "90+"
        c, a = buckets[key]
        buckets[key] = (c + 1, round(a + outstanding, 2))

    return [schemas.AgingBucket(bucket=k, count=v[0], amount=v[1]) for k, v in buckets.items()]
