from typing import List

from fastapi import APIRouter

from data import CATEGORIES
from schemas import Category

router = APIRouter()

# ================================
# CATEGORIES ENDPOINTS
# ================================

@router.get("/categories", response_model=List[Category])
async def get_categories():
    return CATEGORIES
