"""
models.py – SQLAlchemy ORM models for NeuraBills.
Covers: User, Business, Customer, Product, Invoice, InvoiceItem, Payment.
"""

from datetime import datetime
from sqlalchemy import (
    Boolean, Column, DateTime, Float, ForeignKey,
    Integer, String, Text, Enum as SAEnum
)
from sqlalchemy.orm import relationship
import enum

from database import Base


# ── Enums ───────────────────────────────────────────────────────────────────

class UserRole(str, enum.Enum):
    owner = "owner"
    staff = "staff"


class InvoiceStatus(str, enum.Enum):
    draft = "draft"
    sent = "sent"
    paid = "paid"


class SupplyType(str, enum.Enum):
    intrastate = "intrastate"   # CGST + SGST
    interstate = "interstate"   # IGST


# ── Models ───────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    full_name = Column(String(255), nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(SAEnum(UserRole), default=UserRole.owner, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    businesses = relationship("Business", back_populates="owner")


class Business(Base):
    __tablename__ = "businesses"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String(255), nullable=False)
    gstin = Column(String(15), nullable=True)  # 15-char GST number
    address = Column(Text, nullable=True)
    phone = Column(String(20), nullable=True)
    email = Column(String(255), nullable=True)
    state_code = Column(String(5), nullable=True)  # For CGST/SGST vs IGST
    invoice_prefix = Column(String(10), default="INV")
    invoice_counter = Column(Integer, default=1)
    logo_url = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    owner = relationship("User", back_populates="businesses")
    customers = relationship("Customer", back_populates="business")
    products = relationship("Product", back_populates="business")
    invoices = relationship("Invoice", back_populates="business")


class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=False)
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=True)
    phone = Column(String(20), nullable=True)
    address = Column(Text, nullable=True)
    gstin = Column(String(15), nullable=True)   # Optional – GST customer
    state_code = Column(String(5), nullable=True)
    is_gst = Column(Boolean, default=False)     # Registered GST customer?
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    business = relationship("Business", back_populates="customers")
    invoices = relationship("Invoice", back_populates="customer")


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    hsn_sac = Column(String(10), nullable=True)   # HSN (goods) / SAC (services)
    tax_rate = Column(Float, nullable=False, default=18.0)  # e.g., 0, 5, 12, 18, 28
    price = Column(Float, nullable=False, default=0.0)
    unit = Column(String(20), default="pcs")
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    business = relationship("Business", back_populates="products")
    invoice_items = relationship("InvoiceItem", back_populates="product")


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    invoice_number = Column(String(50), nullable=False, unique=True)
    invoice_date = Column(DateTime, default=datetime.utcnow)
    due_date = Column(DateTime, nullable=True)
    supply_type = Column(SAEnum(SupplyType), default=SupplyType.intrastate)
    status = Column(SAEnum(InvoiceStatus), default=InvoiceStatus.draft)
    notes = Column(Text, nullable=True)

    # Totals (calculated and stored for fast retrieval)
    subtotal = Column(Float, default=0.0)
    total_cgst = Column(Float, default=0.0)
    total_sgst = Column(Float, default=0.0)
    total_igst = Column(Float, default=0.0)
    grand_total = Column(Float, default=0.0)
    amount_paid = Column(Float, default=0.0)

    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    business = relationship("Business", back_populates="invoices")
    customer = relationship("Customer", back_populates="invoices")
    items = relationship("InvoiceItem", back_populates="invoice", cascade="all, delete-orphan")
    payments = relationship("Payment", back_populates="invoice", cascade="all, delete-orphan")

    @property
    def outstanding(self) -> float:
        return round(self.grand_total - self.amount_paid, 2)


class InvoiceItem(Base):
    __tablename__ = "invoice_items"

    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)
    description = Column(String(500), nullable=False)  # Snapshot name at time of invoice
    hsn_sac = Column(String(10), nullable=True)
    quantity = Column(Float, nullable=False, default=1.0)
    unit_price = Column(Float, nullable=False, default=0.0)
    tax_rate = Column(Float, nullable=False, default=0.0)  # Total tax %

    # Tax values (computed on create)
    taxable_amount = Column(Float, default=0.0)
    cgst_rate = Column(Float, default=0.0)
    sgst_rate = Column(Float, default=0.0)
    igst_rate = Column(Float, default=0.0)
    cgst_amount = Column(Float, default=0.0)
    sgst_amount = Column(Float, default=0.0)
    igst_amount = Column(Float, default=0.0)
    total_amount = Column(Float, default=0.0)

    # Relationships
    invoice = relationship("Invoice", back_populates="items")
    product = relationship("Product", back_populates="invoice_items")


class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=False)
    amount = Column(Float, nullable=False)
    payment_date = Column(DateTime, default=datetime.utcnow)
    method = Column(String(50), default="cash")  # cash, upi, bank, card
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    invoice = relationship("Invoice", back_populates="payments")
