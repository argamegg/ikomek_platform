from fastapi import APIRouter

router = APIRouter()

#eto root api endpoint  
@router.get("/")
async def root():
    return {"message": "iKomek 109 API", "version": "2.0.0"}
