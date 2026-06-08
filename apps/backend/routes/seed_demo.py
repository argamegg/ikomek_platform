from collections import defaultdict
from datetime import datetime, timedelta
import random
import uuid

from fastapi import APIRouter, HTTPException

from core.config import db
from data import CATEGORIES
from geo import is_within_astana_request_zone
from helpers import get_password_hash
from seed_credentials import SeedCredentialError, get_system_seed_passwords
from schemas import ROLE_ADMIN, ROLE_CITIZEN, ROLE_OPERATOR

router = APIRouter()

REAL_CITIZEN_EMAIL = "armanbezhanov@gmail.com"
OPERATOR_EMAIL = "operator@ikomek.kz"
ADMIN_EMAIL = "admin@ikomek.kz"
DEMO_PASSWORD = "demo123"

DEMO_NAMES = [
    "Арман Беков",
    "Айгерим Сейткали",
    "Данияр Ахметов",
    "Зарина Нурланова",
    "Бауыржан Касымов",
    "Мадина Жаксыбекова",
    "Нурлан Оспанов",
    "Гульнара Абенова",
    "Асель Муратова",
    "Ерлан Сарсенов",
    "Камила Дюсенова",
    "Тимур Алиев",
    "Жанна Кенжебаева",
    "Максат Ибрагимов",
    "Айнур Сулейменова",
    "Руслан Назаров",
    "Диана Байжанова",
    "Серик Тоқаев",
    "Лаура Есимова",
    "Азамат Джаксыбеков",
    "Венера Омарова",
    "Болат Қасымов",
    "Алия Нурмаганбетова",
    "Ержан Бекбосынов",
    "Сауле Жұмабаева",
    "Рустем Сейткали",
    "Меруерт Ахметова",
    "Даулет Нұрланов",
    "Гүлмира Қасенова",
    "Нұрсұлтан Байғалиев",
    "Әсел Мұратова",
    "Бақыт Өтеғалиев",
    "Жұлдыз Серікбаева",
    "Санжар Имангалиев",
    "Перизат Қалиева",
    "Марат Досмұхамбетов",
    "Айжан Сыздықова",
    "Қанат Бердіғалиев",
    "Толғанай Жанғалиева",
    "Ғалым Сейітқалиев",
    "Назгүл Тәжібаева",
    "Ділназ Мұхамеджанова",
    "Аян Қожахметов",
    "Жансая Берікова",
    "Тұрсынбек Елемесов",
    "Индира Мұстафина",
    "Нұржан Өтебаев",
    "Фариза Қасымбекова",
    "Алишер Жақыпов",
    "Маржан Сейтқалиева",
]

DEMO_EMAILS = ["demo@ikomek.kz", *[f"demo{index}@ikomek.kz" for index in range(1, 50)]]
DATE_FROM = datetime(2026, 2, 24, 7, 0, 0)
DATE_TO = datetime(2026, 5, 15, 23, 59, 59)
RIGHT_BANK_SHARE = 0.18

# Coordinates were resolved via Nominatim before embedding them here.
ASTANA_ADDRESSES = [
    {
        "address": "ул. Туран, 20",
        "complex": "ЖК Туран",
        "lat": 51.1415928,
        "lng": 71.4112047,
        "district": "Нура",
    },
    {
        "address": "ул. Туран, 57",
        "complex": "ЖК Изумруд",
        "lat": 51.1091911,
        "lng": 71.3948078,
        "district": "Нура",
    },
    {
        "address": "пр. Мәңгілік Ел, 6",
        "complex": "ЖК Ак Орда",
        "lat": 51.1254059,
        "lng": 71.4407286,
        "district": "Есиль",
    },
    {
        "address": "пр. Мәңгілік Ел, 13",
        "complex": "ЖК Байтерек",
        "lat": 51.1192632,
        "lng": 71.4340378,
        "district": "Есиль",
    },
    {
        "address": "ул. Сарайшык, 5",
        "complex": "ЖК Сарайшык",
        "lat": 51.1359590,
        "lng": 71.4227297,
        "district": "Есиль",
    },
    {
        "address": "ул. Сарайшык, 34",
        "complex": "ЖК Нурсая",
        "lat": 51.1329130,
        "lng": 71.4278324,
        "district": "Есиль",
    },
    {
        "address": "ул. Достык, 12",
        "complex": "ЖК Достык",
        "lat": 51.1260853,
        "lng": 71.4261403,
        "district": "Есиль",
    },
    {
        "address": "ул. Достык, 44",
        "complex": "ЖК Астана",
        "lat": 51.1258185,
        "lng": 71.4307689,
        "district": "Есиль",
    },
    {
        "address": "пр. Республики, 15",
        "complex": "ЖК Республика",
        "lat": 51.1622542,
        "lng": 71.4277984,
        "district": "Сарыарка",
    },
    {
        "address": "пр. Республики, 38",
        "complex": "ЖК Центральный",
        "lat": 51.1749657,
        "lng": 71.4254320,
        "district": "Байконыр",
    },
    {
        "address": "ул. Бейбітшілік, 10",
        "complex": "ЖК Мирный",
        "lat": 51.1683716,
        "lng": 71.4213816,
        "district": "Сарыарка",
    },
    {
        "address": "ул. Бейбітшілік, 27",
        "complex": "ЖК Береке",
        "lat": 51.1731965,
        "lng": 71.4188757,
        "district": "Сарыарка",
    },
    {
        "address": "ул. Иманова, 8",
        "complex": "ЖК Иманов",
        "lat": 51.1626871,
        "lng": 71.4302624,
        "district": "Байконыр",
    },
    {
        "address": "ул. Иманова, 19",
        "complex": "",
        "lat": 51.1646884,
        "lng": 71.4420705,
        "district": "Байконыр",
    },
    {
        "address": "ул. Кенесары, 4",
        "complex": "ЖК Кенесары",
        "lat": 51.1629984,
        "lng": 71.4632223,
        "district": "Байконыр",
    },
    {
        "address": "ул. Кенесары, 52",
        "complex": "ЖК Премиум",
        "lat": 51.1668371,
        "lng": 71.4414435,
        "district": "Байконыр",
    },
    {
        "address": "ул. Кабанбай батыра, 3",
        "complex": "",
        "lat": 51.0947397,
        "lng": 71.4072522,
        "district": "Есиль",
    },
    {
        "address": "ул. Кабанбай батыра, 21",
        "complex": "ЖК Кабанбай",
        "lat": 51.1280624,
        "lng": 71.4116334,
        "district": "Нура",
    },
    {
        "address": "ул. Алматы, 6",
        "complex": "ЖК Алматы",
        "lat": 51.1161840,
        "lng": 71.4211420,
        "district": "Есиль",
    },
    {
        "address": "ул. Алматы, 33",
        "complex": "",
        "lat": 51.1160790,
        "lng": 71.4281647,
        "district": "Есиль",
    },
    {
        "address": "ул. Бейбітшілік, 18",
        "complex": "",
        "lat": 51.1720127,
        "lng": 71.4204178,
        "district": "Алматы",
        "right_bank": True,
    },
    {
        "address": "ул. Республики, 22",
        "complex": "",
        "lat": 51.1589192,
        "lng": 71.4292120,
        "district": "Алматы",
        "right_bank": True,
    },
    {
        "address": "ул. Абылай хана, 14",
        "complex": "",
        "lat": 51.1575560,
        "lng": 71.4760729,
        "district": "Алматы",
        "right_bank": True,
    },
    {
        "address": "ул. Абылай хана, 33",
        "complex": "",
        "lat": 51.1547093,
        "lng": 71.4874340,
        "district": "Алматы",
        "right_bank": True,
    },
    {
        "address": "ул. Бараева, 12",
        "complex": "",
        "lat": 51.1577870,
        "lng": 71.4374058,
        "district": "Алматы",
        "right_bank": True,
    },
    {
        "address": "ул. Бараева, 27",
        "complex": "",
        "lat": 51.1569689,
        "lng": 71.4355090,
        "district": "Алматы",
        "right_bank": True,
    },
    {
        "address": "ул. Жибек жолы, 5",
        "complex": "",
        "lat": 51.1553090,
        "lng": 71.4850639,
        "district": "Алматы",
        "right_bank": True,
    },
    {
        "address": "ул. Жибек жолы, 31",
        "complex": "",
        "lat": 51.1553090,
        "lng": 71.4850639,
        "district": "Алматы",
        "right_bank": True,
    },
]

RIGHT_BANK_ADDRESSES = [address for address in ASTANA_ADDRESSES if address.get("right_bank")]
PRIMARY_ADDRESSES = [address for address in ASTANA_ADDRESSES if not address.get("right_bank")]

REQUEST_TEMPLATES = {
    "electricity": {
        "problem_types": ["Нет света", "Перебои с электричеством", "Не работает уличный фонарь", "Короткое замыкание"],
        "reasons": [
            "Повреждение проводки",
            "Перегорел предохранитель",
            "Повреждение из-за погоды",
            "Плановые работы не завершены",
            "Авария на подстанции",
        ],
    },
    "water": {
        "problem_types": ["Нет горячей воды", "Нет холодной воды", "Слабый напор", "Ржавая вода"],
        "reasons": ["Прорыв трубы", "Плановое отключение затянулось", "Засор в системе", "Авария на водопроводе"],
    },
    "heating": {
        "problem_types": ["Холодные батареи", "Нет отопления", "Течь батареи", "Слабое отопление"],
        "reasons": ["Начало сезона", "Авария в теплосети", "Засор в системе отопления", "Не отрегулирован клапан"],
    },
    "sewage": {
        "problem_types": ["Засор канализации", "Запах из канализации", "Переполненный люк", "Утечка канализации"],
        "reasons": ["Засор трубы", "Повреждение коллектора", "Корни деревьев", "Жировые отложения"],
    },
    "waste": {
        "problem_types": ["Переполненные контейнеры", "Мусор не вывозят", "Незаконная свалка", "Разбросанный мусор"],
        "reasons": ["Нарушение графика вывоза", "Недостаточно контейнеров", "Сломан контейнер", "Объём мусора вырос"],
    },
    "roads": {
        "problem_types": ["Яма на дороге", "Поврежденное покрытие", "Разбитый тротуар", "Отсутствие разметки"],
        "reasons": ["Износ покрытия", "Последствия зимы", "Повреждение после ремонта", "Погодные условия"],
    },
    "street_lighting": {
        "problem_types": ["Не горит фонарь", "Фонарь мигает", "Темный участок дороги", "Сломан столб"],
        "reasons": ["Перегорела лампа", "Повреждение кабеля", "Вандализм", "Износ оборудования"],
    },
    "public_order": {
        "problem_types": ["Шум в ночное время", "Незаконная торговля", "Драка во дворе", "Граффити на стенах"],
        "reasons": ["Систематическое нарушение", "Единичный случай", "Группа лиц", "Неизвестный нарушитель"],
    },
    "other": {
        "problem_types": ["Бродячие животные", "Поврежденная детская площадка", "Незаконная парковка", "Поврежденная скамейка"],
        "reasons": ["Требует осмотра", "Давняя проблема", "Жалоба жителей", "Обнаружено случайно"],
    },
}

CLUSTERS = [
    {
        "address": "пр. Мәңгілік Ел, 6",
        "category_id": "electricity",
        "problem_type": "Отсутствие света в подъезде",
        "reason": "Повреждение проводки",
        "descriptions": [
            "В подъезде №3 уже неделю не горит свет, дети боятся заходить",
            "Перегорела лампочка на 5 этаже, темно и опасно",
            "Освещение в подъезде отсутствует с прошлой недели",
            "В нашем подъезде ЖК Ак Орда нет света, просим устранить",
            "Электрика нет в подъезде, пожилым соседям тяжело подниматься",
        ],
    },
    {
        "address": "ул. Туран, 20",
        "category_id": "water",
        "problem_type": "Нет горячей воды",
        "reason": "Авария на водопроводе",
        "descriptions": [
            "Горячей воды нет уже 3 дня, в ЖК Туран никто не реагирует",
            "Отсутствует горячее водоснабжение в кв. 45",
            "С понедельника нет горячей воды, дети не могут нормально мыться",
            "Горячая вода отключена без предупреждения",
            "Уже четвертый день без горячей воды в ЖК Туран",
            "Прошу восстановить горячее водоснабжение срочно",
        ],
    },
    {
        "address": "ул. Сарайшык, 5",
        "category_id": "waste",
        "problem_type": "Переполненные контейнеры",
        "reason": "Нарушение графика вывоза",
        "descriptions": [
            "Мусорные баки переполнены, мусор лежит на земле уже 2 дня",
            "Контейнеры не вывозят, запах стоит по всему двору",
            "Мусор не забирают третий день, ЖК Сарайшык",
            "Переполненные баки привлекают ворон и кошек",
            "Прошу организовать вывоз мусора в ЖК Сарайшык",
        ],
    },
    {
        "address": "пр. Мәңгілік Ел, 13",
        "category_id": "roads",
        "problem_type": "Яма на дороге у въезда",
        "reason": "Повреждение после ремонта",
        "descriptions": [
            "Огромная яма у въезда в ЖК Байтерек, уже несколько машин пострадало",
            "Дорожное покрытие разрушено у шлагбаума, прошу отремонтировать",
            "Яма глубиной 20 см мешает въезжать в подземный паркинг",
            "Повредил подвеску из-за ямы у ЖК Байтерек",
        ],
    },
    {
        "address": "ул. Достык, 12",
        "category_id": "sewage",
        "problem_type": "Засор и неприятный запах",
        "reason": "Засор трубы",
        "descriptions": [
            "Канализация засорилась, запах по всему подъезду",
            "В подвале стоит вода из-за засора канализации",
            "Неприятный запах из канализации в ЖК Достык",
            "Прошу прочистить канализацию, уже несколько дней проблема",
            "Канализационный люк во дворе переполнен",
        ],
    },
    {
        "address": "ул. Бейбітшілік, 10",
        "category_id": "heating",
        "problem_type": "Холодные батареи",
        "reason": "Засор в системе отопления",
        "descriptions": [
            "Батареи еле теплые, в квартире +15 градусов",
            "Отопление слабое, дети мерзнут в ЖК Мирный",
            "Радиаторы холодные несмотря на начало отопительного сезона",
            "Прошу проверить систему отопления в нашем доме",
        ],
    },
]

DEPARTMENTS = {
    "electricity": "Городская электросетевая служба",
    "water": "Астана Су Арнасы",
    "heating": "Теплотранзит",
    "public_order": "Служба общественного порядка",
    "sewage": "Канализационная служба",
    "waste": "Служба вывоза отходов",
    "roads": "Дорожная служба",
    "street_lighting": "Служба уличного освещения",
    "other": "Единая городская служба",
}

STATUS_WEIGHTS = [("pending", 0.5), ("in_progress", 0.3), ("closed", 0.2)]
PRIORITY_WEIGHTS = [("unset", 0.25), ("medium", 0.35), ("high", 0.25), ("low", 0.15)]
PLACE_TYPES = ["Квартира", "Подъезд", "Двор", "Улица", "Паркинг", "Детская площадка"]
ASTANA_BOUNDS = {
    "min_lat": 51.05,
    "max_lat": 51.20,
    "min_lng": 71.35,
    "max_lng": 71.52,
}


def weighted_choice(rng: random.Random, choices: list[tuple[str, float]]) -> str:
    values = [value for value, _ in choices]
    weights = [weight for _, weight in choices]
    return rng.choices(values, weights=weights, k=1)[0]


def get_address(address: str) -> dict:
    return next(item for item in ASTANA_ADDRESSES if item["address"] == address)


def offset_coordinate(value: float, rng: random.Random, radius: float) -> float:
    return value + rng.uniform(-radius, radius)


def make_created_at(
    rng: random.Random,
    latest: datetime,
    used_timestamps: set[datetime],
    sequence: int,
) -> datetime:
    total_seconds = max(int((latest - DATE_FROM).total_seconds()), 0)
    created_at = (DATE_FROM + timedelta(seconds=rng.randint(0, total_seconds))).replace(
        hour=rng.randint(7, 23),
        minute=rng.randint(0, 59),
        second=rng.randint(0, 59),
        microsecond=sequence,
    )

    if created_at > latest:
        created_at = latest.replace(microsecond=sequence)

    while created_at in used_timestamps:
        created_at += timedelta(microseconds=1)

    used_timestamps.add(created_at)
    return created_at


def make_dates(
    rng: random.Random,
    status: str,
    used_timestamps: set[datetime],
    sequence: int,
) -> tuple[datetime, datetime, datetime | None]:
    closed_at = None

    if status == "closed":
        close_delta = timedelta(days=rng.randint(1, 14))
        created_at = make_created_at(rng, DATE_TO - close_delta, used_timestamps, sequence)
        closed_at = created_at + close_delta
        updated_at = closed_at
    elif status == "in_progress":
        progress_delta = timedelta(days=rng.randint(1, 7))
        created_at = make_created_at(rng, DATE_TO - progress_delta, used_timestamps, sequence)
        updated_at = created_at + progress_delta
    else:
        created_at = make_created_at(rng, DATE_TO, used_timestamps, sequence)
        updated_at = created_at

    return created_at, updated_at, closed_at


def make_request_doc(
    *,
    rng: random.Random,
    user_id: str,
    category_id: str,
    address_data: dict,
    problem_type: str,
    reason: str,
    description: str,
    status: str,
    priority: str,
    operator_id: str | None,
    used_timestamps: set[datetime],
    sequence: int,
    cluster: bool = False,
) -> dict:
    category = next(item for item in CATEGORIES if item["id"] == category_id)
    radius = 0.0001 if cluster else 0.00035
    latitude = offset_coordinate(address_data["lat"], rng, radius)
    longitude = offset_coordinate(address_data["lng"], rng, radius)
    created_at, updated_at, closed_at = make_dates(rng, status, used_timestamps, sequence)
    assigned_operator_id = operator_id if status in {"in_progress", "closed"} else None

    return {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "category_id": category_id,
        "category_name": category["name_ru"],
        "address": address_data["address"],
        "latitude": latitude,
        "longitude": longitude,
        "place_type": address_data["complex"] or rng.choice(PLACE_TYPES),
        "problem_type": problem_type,
        "reason": reason,
        "description": description,
        "description_ru": description,
        "description_kz": None,
        "description_en": None,
        "source_lang": "ru",
        "photos": [],
        "status": status,
        "priority": priority,
        "district": address_data["district"],
        "created_at": created_at,
        "updated_at": updated_at,
        "closed_at": closed_at,
        "operator_id": assigned_operator_id,
        "operator_notes": "Передано в профильную службу" if assigned_operator_id else None,
        "assigned_department": DEPARTMENTS[category_id] if assigned_operator_id else None,
        "resolution_notes": "Проблема устранена городской службой." if status == "closed" else None,
        "resolution_photos": [],
    }


async def ensure_system_user(email: str, role: str, full_name: str, password: str) -> dict:
    existing = await db.users.find_one({"email": email})
    now = datetime.utcnow()

    if existing:
        update_data = {
            "password": get_password_hash(password),
            "role": role,
            "full_name": existing.get("full_name") or full_name,
            "has_local_password": True,
            "is_verified": True,
            "verified_at": existing.get("verified_at") or now,
            "updated_at": now,
        }
        await db.users.update_one({"email": email}, {"$set": update_data})
        existing.update(update_data)
        return existing

    user = {
        "id": str(uuid.uuid4()),
        "email": email,
        "password": get_password_hash(password),
        "full_name": full_name,
        "phone": None,
        "role": role,
        "language": "ru",
        "created_at": now,
        "onboarding_completed": True,
        "is_verified": True,
        "verified_at": now,
    }
    await db.users.insert_one(user)
    return user


async def build_validations(real_before: dict | None, operator_before: dict | None, admin_before: dict | None) -> dict:
    real_after = await db.users.find_one({"email": REAL_CITIZEN_EMAIL})
    operator_after = await db.users.find_one({"email": OPERATOR_EMAIL})
    admin_after = await db.users.find_one({"email": ADMIN_EMAIL})
    request_user_ids = set(await db.requests.distinct("user_id"))
    existing_user_ids = set(await db.users.distinct("id", {"id": {"$in": list(request_user_ids)}}))
    duplicate_timestamps = await db.requests.aggregate(
        [
            {"$group": {"_id": "$created_at", "count": {"$sum": 1}}},
            {"$match": {"count": {"$gt": 1}}},
            {"$count": "duplicates"},
        ]
    ).to_list(1)
    coordinates_outside_astana = await db.requests.count_documents(
        {
            "$or": [
                {"latitude": {"$lt": ASTANA_BOUNDS["min_lat"]}},
                {"latitude": {"$gt": ASTANA_BOUNDS["max_lat"]}},
                {"longitude": {"$lt": ASTANA_BOUNDS["min_lng"]}},
                {"longitude": {"$gt": ASTANA_BOUNDS["max_lng"]}},
            ]
        }
    )
    outside_request_zone = 0
    async for request in db.requests.find({}, {"latitude": 1, "longitude": 1}):
        if not is_within_astana_request_zone(request["latitude"], request["longitude"]):
            outside_request_zone += 1

    outside_seed_date_range = await db.requests.count_documents(
        {
            "$or": [
                {"created_at": {"$lt": DATE_FROM}},
                {"created_at": {"$gt": DATE_TO}},
            ]
        }
    )
    right_bank_requests = await db.requests.count_documents(
        {"address": {"$in": [address["address"] for address in RIGHT_BANK_ADDRESSES]}}
    )

    cluster_addresses = [cluster["address"] for cluster in CLUSTERS]
    cluster_counts = {
        address: await db.requests.count_documents({"address": address})
        for address in cluster_addresses
    }

    return {
        "demo_citizens": await db.users.count_documents({"email": {"$in": DEMO_EMAILS}, "role": ROLE_CITIZEN}),
        "real_account_existed": real_before is not None,
        "real_account_preserved": real_before is None
        or (real_after is not None and real_after.get("id") == real_before.get("id")),
        "operator_account_existed": operator_before is not None,
        "operator_account_preserved": operator_before is None
        or (operator_after is not None and operator_after.get("id") == operator_before.get("id")),
        "admin_account_existed": admin_before is not None,
        "admin_account_preserved": admin_before is None
        or (admin_after is not None and admin_after.get("id") == admin_before.get("id")),
        "orphan_request_user_ids": sorted(request_user_ids - existing_user_ids),
        "coordinates_outside_astana_bounds": coordinates_outside_astana,
        "coordinates_outside_request_zone": outside_request_zone,
        "created_at_outside_seed_range": outside_seed_date_range,
        "right_bank_requests": right_bank_requests,
        "duplicate_created_at_groups": duplicate_timestamps[0]["duplicates"] if duplicate_timestamps else 0,
        "cluster_counts_by_address": cluster_counts,
    }


@router.post("/seed-demo")
async def seed_realistic_demo_data():
    if len(DEMO_NAMES) != 50 or len(DEMO_EMAILS) != 50:
        return {"message": "Demo seed is misconfigured", "demo_names": len(DEMO_NAMES), "demo_emails": len(DEMO_EMAILS)}

    try:
        system_passwords = get_system_seed_passwords()
    except SeedCredentialError as error:
        raise HTTPException(status_code=500, detail=str(error)) from error

    rng = random.Random(42)
    now = datetime.utcnow()

    real_before = await db.users.find_one({"email": REAL_CITIZEN_EMAIL})
    operator_before = await db.users.find_one({"email": OPERATOR_EMAIL})
    admin_before = await db.users.find_one({"email": ADMIN_EMAIL})

    deleted_requests = await db.requests.delete_many({})
    deleted_citizens = await db.users.delete_many(
        {"role": ROLE_CITIZEN, "email": {"$ne": REAL_CITIZEN_EMAIL}}
    )

    operator = await ensure_system_user(
        OPERATOR_EMAIL,
        ROLE_OPERATOR,
        "Оператор Колл-центра",
        system_passwords["operator"],
    )
    await ensure_system_user(
        ADMIN_EMAIL,
        ROLE_ADMIN,
        "Администратор",
        system_passwords["admin"],
    )
    operator_id = operator.get("id") or str(operator.get("_id"))

    demo_users = []
    password_hash = get_password_hash(DEMO_PASSWORD)
    for email, name in zip(DEMO_EMAILS, DEMO_NAMES):
        user = {
            "id": str(uuid.uuid4()),
            "email": email,
            "password": password_hash,
            "full_name": name,
            "phone": f"+7 700 {rng.randint(100, 999)} {rng.randint(10, 99)} {rng.randint(10, 99)}",
            "role": ROLE_CITIZEN,
            "language": rng.choice(["ru", "kz"]),
            "created_at": now,
            "onboarding_completed": True,
            "is_verified": True,
            "verified_at": now,
        }
        await db.users.replace_one({"email": email}, user, upsert=True)
        demo_users.append(user)

    target_counts = {user["id"]: rng.randint(10, 30) for user in demo_users}
    created_counts: dict[str, int] = defaultdict(int)
    used_timestamps: set[datetime] = set()
    requests_to_insert = []
    sequence = 0
    cluster_user_index = 0

    for cluster in CLUSTERS:
        address_data = get_address(cluster["address"])
        for description in cluster["descriptions"]:
            user = demo_users[cluster_user_index % len(demo_users)]
            status = weighted_choice(rng, STATUS_WEIGHTS)
            priority = weighted_choice(rng, PRIORITY_WEIGHTS)
            requests_to_insert.append(
                make_request_doc(
                    rng=rng,
                    user_id=user["id"],
                    category_id=cluster["category_id"],
                    address_data=address_data,
                    problem_type=cluster["problem_type"],
                    reason=cluster["reason"],
                    description=description,
                    status=status,
                    priority=priority,
                    operator_id=operator_id,
                    used_timestamps=used_timestamps,
                    sequence=sequence,
                    cluster=True,
                )
            )
            created_counts[user["id"]] += 1
            sequence += 1
            cluster_user_index += 1

    category_ids = [category["id"] for category in CATEGORIES]
    category_index = 0

    for user in demo_users:
        while created_counts[user["id"]] < target_counts[user["id"]]:
            category_id = category_ids[category_index % len(category_ids)]
            template = REQUEST_TEMPLATES[category_id]
            address_data = rng.choice(RIGHT_BANK_ADDRESSES if rng.random() < RIGHT_BANK_SHARE else PRIMARY_ADDRESSES)
            problem_type = rng.choice(template["problem_types"])
            reason = rng.choice(template["reasons"])
            status = weighted_choice(rng, STATUS_WEIGHTS)
            priority = weighted_choice(rng, PRIORITY_WEIGHTS)
            description = f"{problem_type} по адресу {address_data['address']}. {reason}."

            requests_to_insert.append(
                make_request_doc(
                    rng=rng,
                    user_id=user["id"],
                    category_id=category_id,
                    address_data=address_data,
                    problem_type=problem_type,
                    reason=reason,
                    description=description,
                    status=status,
                    priority=priority,
                    operator_id=operator_id,
                    used_timestamps=used_timestamps,
                    sequence=sequence,
                )
            )
            created_counts[user["id"]] += 1
            category_index += 1
            sequence += 1

    await db.requests.insert_many(requests_to_insert)
    validations = await build_validations(real_before, operator_before, admin_before)

    return {
        "message": "Realistic demo data seeded",
        "deleted_requests": deleted_requests.deleted_count,
        "deleted_citizens": deleted_citizens.deleted_count,
        "demo_users": len(demo_users),
        "requests": len(requests_to_insert),
        "cluster_requests": sum(len(cluster["descriptions"]) for cluster in CLUSTERS),
        "min_requests_per_demo_user": min(created_counts.values()),
        "max_requests_per_demo_user": max(created_counts.values()),
        "validations": validations,
    }
