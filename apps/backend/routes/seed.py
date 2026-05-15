from datetime import datetime, timedelta
import random
import uuid

from fastapi import APIRouter

from core.config import db
from data import CATEGORIES
from helpers import get_password_hash
from news_fixtures import build_news_fixtures
from schemas import ROLE_ADMIN, ROLE_CITIZEN, ROLE_OPERATOR

router = APIRouter()

# ================================
# SEED DATA
# ================================

@router.post("/seed")
async def seed_demo_data():
    existing = await db.requests.count_documents({})
    if existing > 0:
        return {"message": "Data already seeded", "count": existing}
    
    # Real Astana locations
    astana_locations = [
        {"name": "Байтерек", "lat": 51.1282, "lng": 71.4306, "address": "ул. Сарайшык, 20", "district": "Есиль"},
        {"name": "Хан Шатыр", "lat": 51.1326, "lng": 71.4035, "address": "пр. Туран, 37", "district": "Есиль"},
        {"name": "Мечеть Нур-Астана", "lat": 51.1246, "lng": 71.4686, "address": "пр. Кабанбай батыра, 62", "district": "Есиль"},
        {"name": "Дворец Мира", "lat": 51.1108, "lng": 71.4692, "address": "пр. Тәуелсіздік, 57", "district": "Есиль"},
        {"name": "Ак Орда", "lat": 51.1250, "lng": 71.4594, "address": "пр. Мәңгілік Ел, 6", "district": "Есиль"},
        {"name": "Мега Силк Вей", "lat": 51.0897, "lng": 71.4175, "address": "ул. Кабанбай батыра, 62/2", "district": "Есиль"},
        {"name": "Центральный парк", "lat": 51.1283, "lng": 71.4189, "address": "Центральный парк", "district": "Есиль"},
        {"name": "Назарбаев Университет", "lat": 51.0905, "lng": 71.3975, "address": "ул. Кабанбай батыра, 53", "district": "Есиль"},
        {"name": "Астана Арена", "lat": 51.1031, "lng": 71.4025, "address": "ул. Туран, 57", "district": "Есиль"},
        {"name": "Абу-Даби Плаза", "lat": 51.1344, "lng": 71.4264, "address": "пр. Достык, 5", "district": "Алматы"},
        {"name": "Национальный музей", "lat": 51.1217, "lng": 71.4631, "address": "пр. Тәуелсіздік, 54", "district": "Есиль"},
        {"name": "Барыс Арена", "lat": 51.1436, "lng": 71.4197, "address": "пр. Туран, 57", "district": "Сарыарка"},
        {"name": "Набережная Есиль", "lat": 51.1306, "lng": 71.4142, "address": "Набережная Есиль", "district": "Есиль"},
        {"name": "Район Сарыарка", "lat": 51.1667, "lng": 71.4500, "address": "Сарыарка район", "district": "Сарыарка"},
        {"name": "Район Алматы", "lat": 51.1350, "lng": 71.4850, "address": "Алматы район", "district": "Алматы"},
        {"name": "ЭКСПО", "lat": 51.0875, "lng": 71.4158, "address": "Территория ЭКСПО", "district": "Есиль"},
        {"name": "Зеленый квартал", "lat": 51.1400, "lng": 71.4600, "address": "Зеленый квартал", "district": "Алматы"},
        {"name": "Талан Тауэрс", "lat": 51.0983, "lng": 71.4186, "address": "ул. Кунаева, 14", "district": "Есиль"},
        {"name": "Кормэ", "lat": 51.1156, "lng": 71.4269, "address": "ул. Мангилик Ел, 2", "district": "Есиль"},
        {"name": "Старый центр", "lat": 51.1700, "lng": 71.4300, "address": "Старый центр", "district": "Сарыарка"},
    ]
    
    categories = ["electricity", "water", "heating", "public_order", "sewage", "waste", "roads", "street_lighting"]
    statuses = ["pending", "in_progress", "closed"]
    priorities = ["low", "normal", "high"]
    
    problem_types_ru = {
        "electricity": ["Отключение света", "Скачки напряжения", "Повреждение кабеля", "Не работает фонарь"],
        "water": ["Нет воды", "Слабое давление", "Утечка трубы", "Грязная вода"],
        "heating": ["Нет отопления", "Утечка радиатора", "Холодно в квартире", "Перегрев"],
        "public_order": ["Шумовое нарушение", "Незаконная парковка", "Вандализм", "Брошенное авто"],
        "sewage": ["Засор канализации", "Утечка", "Неприятный запах", "Переполнение"],
        "waste": ["Переполненный бак", "Незаконная свалка", "Пропущен вывоз", "Опасные отходы"],
        "roads": ["Яма на дороге", "Поврежденное покрытие", "Нет знака", "Не работает светофор"],
        "street_lighting": ["Не работает фонарь", "Мигающий свет", "Повреждена опора", "Темный участок"],
    }
    
    reasons_ru = {
        "electricity": ["Нарушение общественного порядка", "Повреждение имущества", "Аварийная ситуация"],
        "water": ["Авария на сетях", "Плановые работы", "Износ оборудования"],
        "heating": ["Поломка котельной", "Авария на трассе", "Засор системы"],
        "public_order": ["Нарушение общественного порядка", "Распитие алкогольных напитков", "Шумовое нарушение"],
        "sewage": ["Засор", "Износ труб", "Неправильная эксплуатация"],
        "waste": ["Нарушение графика", "Переполнение", "Незаконный сброс"],
        "roads": ["Погодные условия", "Износ покрытия", "Повреждение"],
        "street_lighting": ["Перегорела лампа", "Проблема электросети", "Вандализм", "Износ оборудования"],
    }
    
    # Create demo users
    demo_citizen_id = str(uuid.uuid4())
    demo_operator_id = str(uuid.uuid4())
    demo_admin_id = str(uuid.uuid4())
    
    demo_users = [
        {
            "id": demo_citizen_id,
            "email": "demo@ikomek.kz",
            "password": get_password_hash("demo123"),
            "full_name": "Демо Пользователь",
            "phone": "+7 777 123 4567",
            "role": ROLE_CITIZEN,
            "language": "ru",
            "created_at": datetime.utcnow(),
            "onboarding_completed": True,
            "is_verified": True,
            "verified_at": datetime.utcnow(),
        },
        {
            "id": demo_operator_id,
            "email": "operator@ikomek.kz",
            "password": get_password_hash("operator123"),
            "full_name": "Оператор Колл-центра",
            "phone": "+7 777 111 2222",
            "role": ROLE_OPERATOR,
            "language": "ru",
            "created_at": datetime.utcnow(),
            "onboarding_completed": True,
            "is_verified": True,
            "verified_at": datetime.utcnow(),
        },
        {
            "id": demo_admin_id,
            "email": "admin@ikomek.kz",
            "password": get_password_hash("admin123"),
            "full_name": "Администратор",
            "phone": "+7 777 000 0000",
            "role": ROLE_ADMIN,
            "language": "ru",
            "created_at": datetime.utcnow(),
            "onboarding_completed": True,
            "is_verified": True,
            "verified_at": datetime.utcnow(),
        }
    ]
    
    for user in demo_users:
        await db.users.insert_one(user)
    
    # Create demo requests
    requests_to_insert = []
    for i, loc in enumerate(astana_locations):
        lat_offset = random.uniform(-0.005, 0.005)
        lng_offset = random.uniform(-0.005, 0.005)
        
        category = random.choice(categories)
        status = random.choice(statuses)
        priority = random.choice(priorities)
        problem_type = random.choice(problem_types_ru[category])
        reason = random.choice(reasons_ru[category])
        
        days_ago = random.randint(0, 30)
        created_at = datetime.utcnow() - timedelta(days=days_ago)
        
        request_obj = {
            "id": str(uuid.uuid4()),
            "user_id": demo_citizen_id if i < 10 else str(uuid.uuid4()),
            "category_id": category,
            "category_name": next(c["name_ru"] for c in CATEGORIES if c["id"] == category),
            "address": loc["address"],
            "latitude": loc["lat"] + lat_offset,
            "longitude": loc["lng"] + lng_offset,
            "district": loc["district"],
            "place_type": random.choice(["Квартира", "Подъезд", "Двор", "Паркинг", "Другое"]),
            "problem_type": problem_type,
            "reason": reason,
            "description": f"Обращение по адресу {loc['name']}: {problem_type}. {reason}.",
            "photos": [],
            "status": status,
            "priority": priority,
            "created_at": created_at,
            "updated_at": created_at + timedelta(hours=random.randint(1, 48)) if status != "pending" else created_at,
            "closed_at": created_at + timedelta(days=random.randint(1, 7)) if status == "closed" else None,
            "operator_id": demo_operator_id if status != "pending" else None,
            "operator_notes": "Передано в соответствующую службу" if status != "pending" else None,
            "resolution_notes": "Проблема устранена бригадой." if status == "closed" else None,
            "resolution_photos": []
        }
        requests_to_insert.append(request_obj)
    
    # Add more random points
    for i in range(30):
        lat = 51.1 + random.uniform(-0.1, 0.1)
        lng = 71.4 + random.uniform(-0.15, 0.15)
        category = random.choice(categories)
        status = random.choice(statuses)
        
        request_obj = {
            "id": str(uuid.uuid4()),
            "user_id": str(uuid.uuid4()),
            "category_id": category,
            "category_name": next(c["name_ru"] for c in CATEGORIES if c["id"] == category),
            "address": f"ул. Астана, {random.randint(1, 200)}",
            "latitude": lat,
            "longitude": lng,
            "district": random.choice(["Есиль", "Сарыарка", "Алматы", "Байконыр"]),
            "place_type": random.choice(["Квартира", "Подъезд", "Двор", "Улица"]),
            "problem_type": random.choice(problem_types_ru[category]),
            "reason": random.choice(reasons_ru[category]),
            "description": "Автоматически сгенерированная заявка.",
            "photos": [],
            "status": status,
            "priority": random.choice(priorities),
            "created_at": datetime.utcnow() - timedelta(days=random.randint(0, 30)),
            "updated_at": datetime.utcnow(),
            "closed_at": None,
            "operator_id": None,
            "operator_notes": None,
            "resolution_notes": None,
            "resolution_photos": []
        }
        requests_to_insert.append(request_obj)
    
    await db.requests.insert_many(requests_to_insert)
    
    # Create demo news
    news_items = build_news_fixtures(datetime.utcnow())
    await db.news.insert_many(news_items)
    
    return {
        "message": "Demo data seeded successfully",
        "requests": len(requests_to_insert),
        "news": len(news_items),
        "users": {
            "citizen": "demo@ikomek.kz / demo123",
            "operator": "operator@ikomek.kz / operator123",
            "admin": "admin@ikomek.kz / admin123"
        }
    }
