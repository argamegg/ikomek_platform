from fastapi.routing import APIRoute

from apps.backend.server import app


def test_api_routes_are_mounted_under_api_prefix():
    route_paths = {
        route.path
        for route in app.routes
        if isinstance(route, APIRoute) and not route.path.startswith(("/docs", "/redoc", "/openapi"))
    }

    assert route_paths
    assert all(path.startswith("/api/") for path in route_paths)


def test_critical_auth_routes_exist_with_expected_methods():
    routes = {
        (route.path, tuple(sorted(route.methods)))
        for route in app.routes
        if isinstance(route, APIRoute)
    }

    assert ("/api/auth/register", ("POST",)) in routes
    assert ("/api/auth/login", ("POST",)) in routes
    assert ("/api/auth/verify-email", ("POST",)) in routes
    assert ("/api/auth/me", ("GET",)) in routes


def test_openapi_schema_contains_security_for_current_user_endpoint():
    schema = app.openapi()
    current_user_operation = schema["paths"]["/api/auth/me"]["get"]

    assert current_user_operation.get("security")
