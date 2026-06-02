import re
from typing import Optional

from data import CATEGORIES


CONTENT_LANGUAGES = {"ru", "kz", "en"}

CATEGORY_LABELS = {
    category["id"]: {
        "ru": category["name_ru"],
        "kz": category["name_kz"],
        "en": category["name"],
    }
    for category in CATEGORIES
}

PROBLEM_LABELS = {
    "Нет света": {"en": "No electricity", "kz": "Электр жарығы жоқ"},
    "Перебои с электричеством": {"en": "Power interruptions", "kz": "Электр қуаты үзіліп тұр"},
    "Не работает уличный фонарь": {"en": "Street light not working", "kz": "Көше шамы істемейді"},
    "Не горит фонарь": {"en": "Street light not working", "kz": "Көше шамы жанбайды"},
    "Короткое замыкание": {"en": "Short circuit", "kz": "Қысқа тұйықталу"},
    "Отсутствие света в подъезде": {"en": "No light in the entrance", "kz": "Кіреберісте жарық жоқ"},
    "Нет горячей воды": {"en": "No hot water", "kz": "Ыстық су жоқ"},
    "Нет холодной воды": {"en": "No cold water", "kz": "Суық су жоқ"},
    "Слабый напор": {"en": "Low water pressure", "kz": "Су қысымы төмен"},
    "Ржавая вода": {"en": "Rusty water", "kz": "Тат басқан су"},
    "Холодные батареи": {"en": "Cold radiators", "kz": "Батареялар суық"},
    "Нет отопления": {"en": "No heating", "kz": "Жылыту жоқ"},
    "Течь батареи": {"en": "Radiator leak", "kz": "Батарея ағып тұр"},
    "Слабое отопление": {"en": "Weak heating", "kz": "Жылыту әлсіз"},
    "Засор канализации": {"en": "Sewage blockage", "kz": "Кәріз бітелген"},
    "Запах из канализации": {"en": "Sewage smell", "kz": "Кәрізден жағымсыз иіс шығады"},
    "Переполненный люк": {"en": "Overflowing manhole", "kz": "Люк толып кеткен"},
    "Утечка канализации": {"en": "Sewage leak", "kz": "Кәріз ағып тұр"},
    "Засор и неприятный запах": {"en": "Blockage and unpleasant smell", "kz": "Бітелу және жағымсыз иіс"},
    "Переполненные контейнеры": {"en": "Overflowing containers", "kz": "Контейнерлер толып кеткен"},
    "Мусор не вывозят": {"en": "Garbage is not being collected", "kz": "Қоқыс шығарылмай жатыр"},
    "Незаконная свалка": {"en": "Illegal dump site", "kz": "Заңсыз қоқыс орны"},
    "Разбросанный мусор": {"en": "Scattered garbage", "kz": "Шашылған қоқыс"},
    "Яма на дороге": {"en": "Pothole", "kz": "Жолдағы шұңқыр"},
    "Поврежденное покрытие": {"en": "Damaged road surface", "kz": "Жол жабыны зақымдалған"},
    "Разбитый тротуар": {"en": "Damaged sidewalk", "kz": "Тротуар бұзылған"},
    "Отсутствие разметки": {"en": "Missing road markings", "kz": "Жол таңбасы жоқ"},
    "Яма на дороге у въезда": {"en": "Pothole near the entrance", "kz": "Кіреберіс жанындағы жол шұңқыры"},
    "Фонарь мигает": {"en": "Flickering street light", "kz": "Көше шамы жыпылықтайды"},
    "Темный участок дороги": {"en": "Dark section of road", "kz": "Жолдың қараңғы бөлігі"},
    "Сломан столб": {"en": "Damaged pole", "kz": "Бағана сынған"},
    "Шум в ночное время": {"en": "Night noise", "kz": "Түнгі уақытта шу"},
    "Незаконная торговля": {"en": "Illegal street trading", "kz": "Заңсыз сауда"},
    "Драка во дворе": {"en": "Fight in the yard", "kz": "Ауладағы төбелес"},
    "Граффити на стенах": {"en": "Graffiti on walls", "kz": "Қабырғадағы граффити"},
    "Бродячие животные": {"en": "Stray animals", "kz": "Қаңғыбас жануарлар"},
    "Поврежденная детская площадка": {"en": "Damaged playground", "kz": "Балалар алаңы зақымдалған"},
    "Незаконная парковка": {"en": "Illegal parking", "kz": "Заңсыз тұрақ"},
    "Поврежденная скамейка": {"en": "Damaged bench", "kz": "Орындық зақымдалған"},
}

REASON_LABELS = {
    "Повреждение проводки": {"en": "Damaged wiring", "kz": "Сымдар зақымдалған"},
    "Перегорел предохранитель": {"en": "Blown fuse", "kz": "Сақтандырғыш жанып кеткен"},
    "Повреждение из-за погоды": {"en": "Weather damage", "kz": "Ауа райынан болған зақым"},
    "Плановые работы не завершены": {"en": "Scheduled work has not been completed", "kz": "Жоспарлы жұмыстар аяқталмаған"},
    "Авария на подстанции": {"en": "Substation accident", "kz": "Қосалқы станциядағы апат"},
    "Прорыв трубы": {"en": "Pipe burst", "kz": "Құбыр жарылған"},
    "Плановое отключение затянулось": {"en": "Scheduled shutdown is taking longer than planned", "kz": "Жоспарлы өшіру ұзаққа созылды"},
    "Засор в системе": {"en": "System blockage", "kz": "Жүйе бітелген"},
    "Авария на водопроводе": {"en": "Water supply accident", "kz": "Су құбырындағы апат"},
    "Начало сезона": {"en": "Start of the heating season", "kz": "Жылыту маусымының басталуы"},
    "Авария в теплосети": {"en": "Heating network accident", "kz": "Жылу желісіндегі апат"},
    "Засор в системе отопления": {"en": "Heating system blockage", "kz": "Жылыту жүйесі бітелген"},
    "Не отрегулирован клапан": {"en": "Valve has not been adjusted", "kz": "Клапан реттелмеген"},
    "Засор трубы": {"en": "Pipe blockage", "kz": "Құбыр бітелген"},
    "Повреждение коллектора": {"en": "Collector damage", "kz": "Коллектор зақымдалған"},
    "Корни деревьев": {"en": "Tree roots", "kz": "Ағаш тамырлары"},
    "Жировые отложения": {"en": "Grease buildup", "kz": "Май қалдықтары жиналған"},
    "Нарушение графика вывоза": {"en": "Collection schedule violation", "kz": "Қоқыс шығару кестесі бұзылған"},
    "Недостаточно контейнеров": {"en": "Not enough containers", "kz": "Контейнерлер жеткіліксіз"},
    "Сломан контейнер": {"en": "Broken container", "kz": "Контейнер сынған"},
    "Объём мусора вырос": {"en": "Garbage volume has increased", "kz": "Қоқыс көлемі артқан"},
    "Износ покрытия": {"en": "Surface wear", "kz": "Жол жабыны тозған"},
    "Последствия зимы": {"en": "Winter damage", "kz": "Қыстан кейінгі зақым"},
    "Повреждение после ремонта": {"en": "Damage after repair work", "kz": "Жөндеуден кейінгі зақым"},
    "Погодные условия": {"en": "Weather conditions", "kz": "Ауа райы жағдайлары"},
    "Перегорела лампа": {"en": "Burned-out lamp", "kz": "Шам жанып кеткен"},
    "Повреждение кабеля": {"en": "Cable damage", "kz": "Кабель зақымдалған"},
    "Вандализм": {"en": "Vandalism", "kz": "Вандализм"},
    "Износ оборудования": {"en": "Equipment wear", "kz": "Жабдық тозған"},
    "Систематическое нарушение": {"en": "Repeated violation", "kz": "Жүйелі бұзушылық"},
    "Единичный случай": {"en": "Single incident", "kz": "Бір реттік жағдай"},
    "Группа лиц": {"en": "Group of people", "kz": "Адамдар тобы"},
    "Неизвестный нарушитель": {"en": "Unknown offender", "kz": "Бұзушы белгісіз"},
    "Требует осмотра": {"en": "Inspection required", "kz": "Тексеру қажет"},
    "Давняя проблема": {"en": "Long-standing issue", "kz": "Бұрыннан бар мәселе"},
    "Жалоба жителей": {"en": "Residents' complaint", "kz": "Тұрғындардың шағымы"},
    "Обнаружено случайно": {"en": "Found by chance", "kz": "Кездейсоқ анықталған"},
}

DESCRIPTION_LABELS = {
    "В подъезде №3 уже неделю не горит свет, дети боятся заходить": {
        "en": "There has been no light in entrance No. 3 for a week; children are afraid to enter.",
        "kz": "№3 кіреберісте бір аптадан бері жарық жоқ, балалар кіруге қорқады.",
    },
    "Перегорела лампочка на 5 этаже, темно и опасно": {
        "en": "The bulb on the 5th floor has burned out; it is dark and unsafe.",
        "kz": "5-қабаттағы шам жанып кеткен, қараңғы әрі қауіпті.",
    },
    "Освещение в подъезде отсутствует с прошлой недели": {
        "en": "The entrance lighting has been out since last week.",
        "kz": "Кіреберістегі жарық өткен аптадан бері жоқ.",
    },
    "В нашем подъезде ЖК Ак Орда нет света, просим устранить": {
        "en": "There is no light in our entrance at Ak Orda residential complex. Please fix it.",
        "kz": "Ақ Орда тұрғын үй кешеніндегі кіреберісте жарық жоқ. Жөндеп беруіңізді сұраймыз.",
    },
    "Электрика нет в подъезде, пожилым соседям тяжело подниматься": {
        "en": "There is no electricity in the entrance; elderly neighbors have difficulty going upstairs.",
        "kz": "Кіреберісте электр жоқ, егде көршілерге жоғары көтерілу қиын.",
    },
    "Горячей воды нет уже 3 дня, в ЖК Туран никто не реагирует": {
        "en": "There has been no hot water for 3 days; no one is responding at Turan residential complex.",
        "kz": "Тұран тұрғын үй кешенінде 3 күннен бері ыстық су жоқ, ешкім жауап бермей жатыр.",
    },
    "Отсутствует горячее водоснабжение в кв. 45": {
        "en": "There is no hot water supply in apartment 45.",
        "kz": "45-пәтерде ыстық су жоқ.",
    },
    "С понедельника нет горячей воды, дети не могут нормально мыться": {
        "en": "There has been no hot water since Monday; children cannot wash properly.",
        "kz": "Дүйсенбіден бері ыстық су жоқ, балалар дұрыс жуына алмай жүр.",
    },
    "Горячая вода отключена без предупреждения": {
        "en": "Hot water was turned off without warning.",
        "kz": "Ыстық су ескертусіз өшірілген.",
    },
    "Уже четвертый день без горячей воды в ЖК Туран": {
        "en": "Turan residential complex has been without hot water for four days.",
        "kz": "Тұран тұрғын үй кешенінде төртінші күн ыстық су жоқ.",
    },
    "Прошу восстановить горячее водоснабжение срочно": {
        "en": "Please restore the hot water supply urgently.",
        "kz": "Ыстық суды шұғыл қалпына келтіруіңізді сұраймын.",
    },
    "Мусорные баки переполнены, мусор лежит на земле уже 2 дня": {
        "en": "The garbage bins are overflowing, and trash has been lying on the ground for 2 days.",
        "kz": "Қоқыс жәшіктері толып кеткен, қоқыс 2 күннен бері жерде жатыр.",
    },
    "Контейнеры не вывозят, запах стоит по всему двору": {
        "en": "The containers are not being collected, and the smell has spread across the whole yard.",
        "kz": "Контейнерлер шығарылмай жатыр, иіс бүкіл аулаға таралған.",
    },
    "Мусор не забирают третий день, ЖК Сарайшык": {
        "en": "Garbage has not been collected for the third day at Saraishyk residential complex.",
        "kz": "Сарайшық тұрғын үй кешенінде қоқыс үшінші күн шығарылмай жатыр.",
    },
    "Переполненные баки привлекают ворон и кошек": {
        "en": "Overflowing bins are attracting birds and cats.",
        "kz": "Толып кеткен жәшіктер құстар мен мысықтарды тартып жатыр.",
    },
    "Прошу организовать вывоз мусора в ЖК Сарайшык": {
        "en": "Please arrange garbage collection at Saraishyk residential complex.",
        "kz": "Сарайшық тұрғын үй кешенінде қоқыс шығаруды ұйымдастыруыңызды сұраймын.",
    },
    "Огромная яма у въезда в ЖК Байтерек, уже несколько машин пострадало": {
        "en": "There is a large pothole near the entrance to Baiterek residential complex; several cars have already been damaged.",
        "kz": "Бәйтерек тұрғын үй кешеніне кіреберісте үлкен шұңқыр бар, бірнеше көлік зақымданды.",
    },
    "Дорожное покрытие разрушено у шлагбаума, прошу отремонтировать": {
        "en": "The road surface near the barrier is damaged. Please repair it.",
        "kz": "Шлагбаум жанындағы жол жабыны бұзылған. Жөндеуіңізді сұраймын.",
    },
    "Яма глубиной 20 см мешает въезжать в подземный паркинг": {
        "en": "A 20 cm deep pothole makes it difficult to enter the underground parking.",
        "kz": "Тереңдігі 20 см шұңқыр жерасты тұраққа кіруге кедергі келтіреді.",
    },
    "Повредил подвеску из-за ямы у ЖК Байтерек": {
        "en": "My car suspension was damaged because of the pothole near Baiterek residential complex.",
        "kz": "Бәйтерек тұрғын үй кешені жанындағы шұңқырдан көліктің аспасы зақымданды.",
    },
    "Канализация засорилась, запах по всему подъезду": {
        "en": "The sewage system is blocked, and the smell has spread through the whole entrance.",
        "kz": "Кәріз бітелген, иіс бүкіл кіреберіске таралған.",
    },
    "В подвале стоит вода из-за засора канализации": {
        "en": "Water is standing in the basement because of a sewage blockage.",
        "kz": "Кәріз бітелгендіктен жертөледе су жиналып тұр.",
    },
    "Неприятный запах из канализации в ЖК Достык": {
        "en": "There is an unpleasant sewage smell at Dostyk residential complex.",
        "kz": "Достық тұрғын үй кешенінде кәрізден жағымсыз иіс шығады.",
    },
    "Прошу прочистить канализацию, уже несколько дней проблема": {
        "en": "Please clean the sewage system; the issue has lasted for several days.",
        "kz": "Кәрізді тазалауыңызды сұраймын, мәселе бірнеше күннен бері бар.",
    },
    "Канализационный люк во дворе переполнен": {
        "en": "The sewage manhole in the yard is overflowing.",
        "kz": "Ауладағы кәріз люгі толып кеткен.",
    },
    "Батареи еле теплые, в квартире +15 градусов": {
        "en": "The radiators are barely warm, and the apartment is only +15 degrees.",
        "kz": "Батареялар әрең жылы, пәтерде +15 градус.",
    },
    "Отопление слабое, дети мерзнут в ЖК Мирный": {
        "en": "Heating is weak, and children are cold at Mirny residential complex.",
        "kz": "Мирный тұрғын үй кешенінде жылыту әлсіз, балалар тоңып жүр.",
    },
    "Радиаторы холодные несмотря на начало отопительного сезона": {
        "en": "The radiators are cold despite the start of the heating season.",
        "kz": "Жылыту маусымы басталса да радиаторлар суық.",
    },
    "Прошу проверить систему отопления в нашем доме": {
        "en": "Please inspect the heating system in our building.",
        "kz": "Үйіміздегі жылыту жүйесін тексеруіңізді сұраймын.",
    },
}

PLACE_TYPE_LABELS = {
    "Квартира": {"en": "Apartment", "kz": "Пәтер"},
    "Подъезд": {"en": "Entrance", "kz": "Кіреберіс"},
    "Двор": {"en": "Yard", "kz": "Аула"},
    "Улица": {"en": "Street", "kz": "Көше"},
    "Паркинг": {"en": "Parking", "kz": "Тұрақ"},
    "Детская площадка": {"en": "Playground", "kz": "Балалар алаңы"},
}

COMPLEX_REPLACEMENTS = {
    "ЖК": {"en": "Residential Complex", "kz": "ТК"},
    "Ак Орда": {"en": "Ak Orda", "kz": "Ақ Орда"},
    "Байтерек": {"en": "Baiterek", "kz": "Бәйтерек"},
    "Туран": {"en": "Turan", "kz": "Тұран"},
    "Сарайшык": {"en": "Saraishyk", "kz": "Сарайшық"},
    "Нурсая": {"en": "Nursaya", "kz": "Нұрсая"},
    "Достык": {"en": "Dostyk", "kz": "Достық"},
    "Астана": {"en": "Astana", "kz": "Астана"},
    "Республика": {"en": "Respublika", "kz": "Республика"},
    "Центральный": {"en": "Central", "kz": "Орталық"},
    "Мирный": {"en": "Mirny", "kz": "Мирный"},
    "Береке": {"en": "Bereke", "kz": "Береке"},
    "Иманов": {"en": "Imanov", "kz": "Иманов"},
    "Кенесары": {"en": "Kenesary", "kz": "Кенесары"},
    "Премиум": {"en": "Premium", "kz": "Премиум"},
    "Кабанбай": {"en": "Kabanbay", "kz": "Қабанбай"},
    "Алматы": {"en": "Almaty", "kz": "Алматы"},
}

STREET_REPLACEMENTS = {
    "Туран": {"en": "Turan", "kz": "Тұран"},
    "Мәңгілік Ел": {"en": "Mangilik El", "kz": "Мәңгілік Ел"},
    "Сарайшык": {"en": "Saraishyk", "kz": "Сарайшық"},
    "Достык": {"en": "Dostyk", "kz": "Достық"},
    "Республики": {"en": "Republic", "kz": "Республика"},
    "Бейбітшілік": {"en": "Beibitshilik", "kz": "Бейбітшілік"},
    "Иманова": {"en": "Imanov", "kz": "Иманов"},
    "Кенесары": {"en": "Kenesary", "kz": "Кенесары"},
    "Кабанбай батыра": {"en": "Kabanbay Batyr", "kz": "Қабанбай батыр"},
    "Алматы": {"en": "Almaty", "kz": "Алматы"},
    "Абылай хана": {"en": "Abylai Khan", "kz": "Абылай хан"},
    "Бараева": {"en": "Barayev", "kz": "Бараев"},
    "Жибек жолы": {"en": "Zhibek Zholy", "kz": "Жібек жолы"},
}

CYRILLIC_TO_LATIN = {
    "а": "a", "ә": "a", "б": "b", "в": "v", "г": "g", "ғ": "g", "д": "d", "е": "e", "ё": "yo",
    "ж": "zh", "з": "z", "и": "i", "й": "y", "к": "k", "қ": "k", "л": "l", "м": "m", "н": "n",
    "ң": "n", "о": "o", "ө": "o", "п": "p", "р": "r", "с": "s", "т": "t", "у": "u", "ұ": "u",
    "ү": "u", "ф": "f", "х": "kh", "һ": "h", "ц": "ts", "ч": "ch", "ш": "sh", "щ": "shch",
    "ъ": "", "ы": "y", "і": "i", "ь": "", "э": "e", "ю": "yu", "я": "ya",
}


def normalize_content_language(language: Optional[str]) -> str:
    if language in CONTENT_LANGUAGES:
        return language
    if language == "kk":
        return "kz"
    return "ru"


def _label(value: Optional[str], labels: dict[str, dict[str, str]], lang: str) -> Optional[str]:
    if not value or lang == "ru":
        return value
    return labels.get(value, {}).get(lang) or value


def transliterate_to_english(value: Optional[str]) -> Optional[str]:
    if not value:
        return value

    result = []
    for char in value:
        lower = char.lower()
        replacement = CYRILLIC_TO_LATIN.get(lower)
        if replacement is None:
            result.append(char)
        elif char.isupper():
            result.append(replacement.capitalize())
        else:
            result.append(replacement)

    return re.sub(r"\s+", " ", "".join(result)).strip()


def localize_category(category_id: Optional[str], current: Optional[str], lang: str) -> Optional[str]:
    if lang == "ru":
        return current
    return CATEGORY_LABELS.get(category_id or "", {}).get(lang) or current


def localize_problem_type(value: Optional[str], lang: str) -> Optional[str]:
    return _label(value, PROBLEM_LABELS, lang)


def localize_reason(value: Optional[str], lang: str) -> Optional[str]:
    return _label(value, REASON_LABELS, lang)


def localize_place_type(value: Optional[str], lang: str) -> Optional[str]:
    if not value or lang == "ru":
        return value

    if value in PLACE_TYPE_LABELS:
        return PLACE_TYPE_LABELS[value][lang]

    for source, labels in COMPLEX_REPLACEMENTS.items():
        if value == f"ЖК {source}":
            return f"{labels[lang]} {COMPLEX_REPLACEMENTS['ЖК'][lang]}" if lang == "en" else f"{COMPLEX_REPLACEMENTS['ЖК'][lang]} {labels[lang]}"

    return transliterate_to_english(value) if lang == "en" else value


def localize_address(address: Optional[str], lang: str) -> Optional[str]:
    if not address or lang == "ru":
        return address

    replacements = {
        "ул.": {"en": "Street", "kz": "көшесі"},
        "пр.": {"en": "Avenue", "kz": "даңғылы"},
    }
    match = re.match(r"^(ул\.|пр\.)\s+(.+?),\s*(.+)$", address)
    if not match:
        return transliterate_to_english(address) if lang == "en" else address

    prefix, street, number = match.groups()
    street_name = STREET_REPLACEMENTS.get(street, {}).get(lang)
    if lang == "en":
        return f"{street_name or transliterate_to_english(street)} {replacements[prefix]['en']}, {number}"
    return f"{street_name or street} {replacements[prefix]['kz']}, {number}"


def _localize_known_description(description: str, lang: str) -> Optional[str]:
    if lang == "ru":
        return description
    return DESCRIPTION_LABELS.get(description, {}).get(lang)


def localize_description(
    description: Optional[str],
    lang: str,
    *,
    problem_type: Optional[str] = None,
    reason: Optional[str] = None,
) -> Optional[str]:
    if not description or lang == "ru":
        return description

    exact = _localize_known_description(description, lang)
    if exact:
        return exact

    pattern = re.match(r"^(.+?)\s+по\s+адресу\s+(.+)\.\s+(.+?)\.$", description)
    if pattern:
        raw_problem, raw_address, raw_reason = pattern.groups()
        problem = localize_problem_type(problem_type or raw_problem, lang) or raw_problem
        reason_text = localize_reason(reason or raw_reason, lang) or raw_reason
        address = localize_address(raw_address, lang) or raw_address
        if lang == "en":
            return f"{problem} at {address}. {reason_text}."
        return f"{address} мекенжайында: {problem.lower()}. {reason_text}."

    translated = description
    for source, labels in {**PROBLEM_LABELS, **REASON_LABELS}.items():
        translated = translated.replace(source, labels.get(lang, source))
    return translated


def localize_author_name(value: Optional[str], lang: str) -> Optional[str]:
    if lang != "en":
        return value
    return transliterate_to_english(value)


def build_request_translations(request: dict) -> dict:
    problem_type = request.get("problem_type")
    reason = request.get("reason")
    description = request.get("description") or request.get("description_ru")
    citizen_name = request.get("citizen_name")
    description_kz = localize_description(description, "kz", problem_type=problem_type, reason=reason)
    description_en = localize_description(description, "en", problem_type=problem_type, reason=reason)

    return {
        "category_name_ru": localize_category(request.get("category_id"), request.get("category_name"), "ru"),
        "category_name_kz": localize_category(request.get("category_id"), request.get("category_name"), "kz"),
        "category_name_en": localize_category(request.get("category_id"), request.get("category_name"), "en"),
        "address_ru": request.get("address"),
        "address_kz": localize_address(request.get("address"), "kz"),
        "address_en": localize_address(request.get("address"), "en"),
        "place_type_ru": request.get("place_type"),
        "place_type_kz": localize_place_type(request.get("place_type"), "kz"),
        "place_type_en": localize_place_type(request.get("place_type"), "en"),
        "problem_type_ru": problem_type,
        "problem_type_kz": localize_problem_type(problem_type, "kz"),
        "problem_type_en": localize_problem_type(problem_type, "en"),
        "reason_ru": reason,
        "reason_kz": localize_reason(reason, "kz"),
        "reason_en": localize_reason(reason, "en"),
        "description_ru": request.get("description_ru") or description,
        "description_kz": description_kz or request.get("description_kz"),
        "description_en": description_en or request.get("description_en"),
        "citizen_name_en": localize_author_name(citizen_name, "en"),
    }


def localize_request_payload(request: dict, lang: Optional[str]) -> dict:
    request = dict(request)
    content_lang = normalize_content_language(lang)

    if content_lang == "ru":
        request["category_name"] = request.get("category_name_ru") or request.get("category_name")
        request["address"] = request.get("address_ru") or request.get("address")
        request["place_type"] = request.get("place_type_ru") or request.get("place_type")
        request["problem_type"] = request.get("problem_type_ru") or request.get("problem_type")
        request["reason"] = request.get("reason_ru") or request.get("reason")
        request["description"] = request.get("description_ru") or request.get("description")
        return request

    translations = build_request_translations(request)
    suffix = "kz" if content_lang == "kz" else "en"
    request["category_name"] = request.get(f"category_name_{suffix}") or translations.get(f"category_name_{suffix}") or request.get("category_name")
    request["address"] = request.get(f"address_{suffix}") or translations.get(f"address_{suffix}") or request.get("address")
    request["place_type"] = request.get(f"place_type_{suffix}") or translations.get(f"place_type_{suffix}") or request.get("place_type")
    request["problem_type"] = request.get(f"problem_type_{suffix}") or translations.get(f"problem_type_{suffix}") or request.get("problem_type")
    request["reason"] = request.get(f"reason_{suffix}") or translations.get(f"reason_{suffix}") or request.get("reason")
    request["description"] = translations.get(f"description_{suffix}") or request.get(f"description_{suffix}") or request.get("description")

    if content_lang == "en":
        request["citizen_name"] = request.get("citizen_name_en") or translations.get("citizen_name_en") or request.get("citizen_name")

    return request
