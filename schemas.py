"""
schemas.py – Pydantic v2 schemas for request/response validation in NeuraBills.
"""

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, EmailStr, field_validator
import re


# ── Auth ─────────────────────────────────────────────────────────────────────

class UserRegister(BaseModel):
    email: EmailStr
    full_name: str
    password: str
    business_name: str  # Register business alongside user

    @field_validator("password")
    @classmethod
    def password_truncate(cls, v: str) -> str:
        if not v:
            raise ValueError("Password cannot be empty")
        return v[:72]


class UserLogin(BaseModel):
    email: EmailStr
    password: str

    @field_validator("password")
    @classmethod
    def password_truncate(cls, v: str) -> str:
        return v[:72]


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    business_id: int
    full_name: str


class UserOut(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    is_active: bool

    model_config = {"from_attributes": True}


# ── Business ──────────────────────────────────────────────────────────────────

class BusinessUpdate(BaseModel):
    name: Optional[str] = None
    gstin: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    state_code: Optional[str] = None
    invoice_prefix: Optional[str] = None

    @field_validator("gstin")
    @classmethod
    def validate_gstin(cls, v: Optional[str]) -> Optional[str]:
        if v and not re.match(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$", v):
            raise ValueError("Invalid GSTIN format (e.g. 22AAAAA0000A1Z5)")
        return v


class BusinessOut(BaseModel):
    id: int
    name: str
    gstin: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    state_code: Optional[str] = None
    invoice_prefix: str
    invoice_counter: int
    logo_url: Optional[str] = None

    model_config = {"from_attributes": True}


# ── Customer ──────────────────────────────────────────────────────────────────

class CustomerCreate(BaseModel):
    name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    gstin: Optional[str] = None
    state_code: Optional[str] = None
    is_gst: bool = False

    @field_validator("gstin")
    @classmethod
    def validate_gstin(cls, v: Optional[str]) -> Optional[str]:
        if v and not re.match(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$", v):
            raise ValueError("Invalid GSTIN format")
        return v


class CustomerUpdate(CustomerCreate):
    pass


class CustomerOut(BaseModel):
    id: int
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    gstin: Optional[str] = None
    state_code: Optional[str] = None
    is_gst: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Product ───────────────────────────────────────────────────────────────────

class ProductCreate(BaseModel):
    name: str
    description: Optional[str] = None
    hsn_sac: Optional[str] = None
    tax_rate: float = 18.0
    price: float
    unit: str = "pcs"

    @field_validator("tax_rate")
    @classmethod
    def validate_tax_rate(cls, v: float) -> float:
        valid_rates = [0, 0.25, 3, 5, 12, 18, 28]
        if v not in valid_rates:
            raise ValueError(f"Tax rate must be one of {valid_rates}")
        return v

    @field_validator("price")
    @classmethod
    def price_positive(cls, v: float) -> float:
        if v < 0:
            raise ValueError("Price must be non-negative")
        return v


class ProductUpdate(ProductCreate):
    pass


class ProductOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    hsn_sac: Optional[str] = None
    tax_rate: float
    price: float
    unit: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Invoice ───────────────────────────────────────────────────────────────────

class InvoiceItemCreate(BaseModel):
    product_id: Optional[int] = None
    description: str
    hsn_sac: Optional[str] = None
    quantity: float = 1.0
    unit_price: float
    tax_rate: float = 0.0

    @field_validator("quantity", "unit_price")
    @classmethod
    def positive_values(cls, v: float) -> float:
        if v < 0:
            raise ValueError("Must be non-negative")
        return v


class InvoiceItemOut(BaseModel):
    id: int
    product_id: Optional[int] = None
    description: str
    hsn_sac: Optional[str] = None
    quantity: float
    unit_price: float
    tax_rate: float
    taxable_amount: float
    cgst_rate: float
    sgst_rate: float
    igst_rate: float
    cgst_amount: float
    sgst_amount: float
    igst_amount: float
    total_amount: float

    model_config = {"from_attributes": True}


class InvoiceCreate(BaseModel):
    customer_id: int
    invoice_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    supply_type: str = "intrastate"  # intrastate | interstate
    notes: Optional[str] = None
    items: List[InvoiceItemCreate]

    @field_validator("supply_type")
    @classmethod
    def validate_supply_type(cls, v: str) -> str:
        if v not in ("intrastate", "interstate"):
            raise ValueError("supply_type must be 'intrastate' or 'interstate'")
        return v


class InvoiceStatusUpdate(BaseModel):
    status: str  # draft | sent | paid

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        if v not in ("draft", "sent", "paid"):
            raise ValueError("status must be 'draft', 'sent', or 'paid'")
        return v


class InvoiceOut(BaseModel):
    id: int
    invoice_number: str
    customer_id: int
    customer_name: Optional[str] = None
    invoice_date: datetime
    due_date: Optional[datetime] = None
    supply_type: str
    status: str
    notes: Optional[str] = None
    subtotal: float
    total_cgst: float
    total_sgst: float
    total_igst: float
    grand_total: float
    amount_paid: float
    outstanding: float
    items: List[InvoiceItemOut] = []

    model_config = {"from_attributes": True}


# ── Payment ───────────────────────────────────────────────────────────────────

class PaymentCreate(BaseModel):
    invoice_id: int
    amount: float
    payment_date: Optional[datetime] = None
    method: str = "cash"
    notes: Optional[str] = None

    @field_validator("amount")
    @classmethod
    def amount_positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Payment amount must be positive")
        return v

    @field_validator("method")
    @classmethod
    def validate_method(cls, v: str) -> str:
        valid = ["cash", "upi", "bank", "card", "cheque", "other"]
        if v not in valid:
            raise ValueError(f"Payment method must be one of {valid}")
        return v


class PaymentOut(BaseModel):
    id: int
    invoice_id: int
    amount: float
    payment_date: datetime
    method: str
    notes: Optional[str] = None

    model_config = {"from_attributes": True}


# ── Reports ───────────────────────────────────────────────────────────────────

class SalesSummary(BaseModel):
    total_invoices: int
    total_sales: float
    total_paid: float
    total_outstanding: float
    draft_count: int
    sent_count: int
    paid_count: int


class GSTSummary(BaseModel):
    period: str
    total_taxable: float
    total_cgst: float
    total_sgst: float
    total_igst: float
    total_tax: float
    grand_total: float


class CustomerReport(BaseModel):
    customer_id: int
    customer_name: str
    total_invoices: int
    total_billed: float
    total_paid: float
    outstanding: float


class AgingBucket(BaseModel):
    bucket: str   # "0-30", "31-60", "61-90", "90+"
    count: int
    amount: float
