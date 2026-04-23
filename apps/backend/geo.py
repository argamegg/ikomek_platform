import os
from math import atan2, cos, radians, sin, sqrt
from pathlib import Path
from typing import Any, Optional, Tuple

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

ASTANA_CENTER_LAT = float(os.getenv("ASTANA_CENTER_LAT", "51.1282"))
ASTANA_CENTER_LNG = float(os.getenv("ASTANA_CENTER_LNG", "71.4306"))
ASTANA_MAX_RADIUS_KM = float(os.getenv("ASTANA_MAX_RADIUS_KM", "60"))

REQUEST_OUT_OF_ZONE_ERROR = (
    "Обращения можно создавать только в Астане и в радиусе до 60 км от города"
)


def haversine_distance_km(
    lat1: float,
    lng1: float,
    lat2: float,
    lng2: float,
) -> float:
    earth_radius_km = 6371.0
    lat1_rad = radians(lat1)
    lng1_rad = radians(lng1)
    lat2_rad = radians(lat2)
    lng2_rad = radians(lng2)

    delta_lat = lat2_rad - lat1_rad
    delta_lng = lng2_rad - lng1_rad

    haversine = (
        sin(delta_lat / 2) ** 2
        + cos(lat1_rad) * cos(lat2_rad) * sin(delta_lng / 2) ** 2
    )
    arc = 2 * atan2(sqrt(haversine), sqrt(1 - haversine))
    return earth_radius_km * arc


def is_valid_coordinate_pair(lat: float, lng: float) -> bool:
    return -90 <= lat <= 90 and -180 <= lng <= 180


def get_distance_to_astana_km(lat: float, lng: float) -> float:
    return haversine_distance_km(lat, lng, ASTANA_CENTER_LAT, ASTANA_CENTER_LNG)


def is_within_astana_request_zone(lat: float, lng: float) -> bool:
    if not is_valid_coordinate_pair(lat, lng):
        return False
    return get_distance_to_astana_km(lat, lng) <= ASTANA_MAX_RADIUS_KM


def extract_coordinates_from_record(record: dict[str, Any]) -> Tuple[Optional[float], Optional[float]]:
    latitude = record.get("latitude")
    longitude = record.get("longitude")

    if latitude is not None and longitude is not None:
        return float(latitude), float(longitude)

    for key in ("geoPoint", "point", "geo", "coordinates"):
        value = record.get(key)
        if isinstance(value, dict):
            lat_value = value.get("lat", value.get("latitude"))
            lng_value = value.get("lng", value.get("lon", value.get("longitude")))
            if lat_value is not None and lng_value is not None:
                return float(lat_value), float(lng_value)

        if isinstance(value, (list, tuple)) and len(value) >= 2:
            longitude_value, latitude_value = value[0], value[1]
            return float(latitude_value), float(longitude_value)

    return None, None
