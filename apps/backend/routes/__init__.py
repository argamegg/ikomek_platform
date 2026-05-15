from . import ai
from . import analytics
from . import auth
from . import categories
from . import locations
from . import map_points
from . import messages
from . import news
from . import requests
from . import root
from . import seed
from . import seed_demo
from . import users

ROUTERS = [
    auth.router,
    users.router,
    categories.router,
    locations.router,
    requests.router,
    messages.router,
    ai.router,
    news.router,
    map_points.router,
    analytics.router,
    seed.router,
    seed_demo.router,
    root.router,
]
