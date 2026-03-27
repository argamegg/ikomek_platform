#!/usr/bin/env python3
"""
iKomek 109 Smart City Service App - Backend API Tests
Tests all backend endpoints with proper authentication flow
"""

import requests
import json
import uuid
from datetime import datetime
import sys
import traceback

# Base URL from environment
BASE_URL = "https://ikomek-astana.preview.emergentagent.com/api"

# Demo credentials
DEMO_EMAIL = "demo@ikomek.kz"
DEMO_PASSWORD = "demo123"

class BackendTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.access_token = None
        self.headers = {"Content-Type": "application/json"}
        self.test_results = []
        self.demo_user_data = None
        
    def log_result(self, test_name, success, message="", data=None):
        """Log test result"""
        result = {
            "test": test_name,
            "success": success,
            "message": message,
            "timestamp": datetime.utcnow().isoformat()
        }
        if data and not success:
            result["error_data"] = str(data)[:500]  # Limit error data size
        self.test_results.append(result)
        
        status = "✅ PASS" if success else "❌ FAIL" 
        print(f"{status} {test_name}: {message}")
        
    def make_request(self, method, endpoint, data=None, headers=None, params=None):
        """Make HTTP request with error handling"""
        try:
            url = f"{self.base_url}{endpoint}"
            request_headers = self.headers.copy()
            if headers:
                request_headers.update(headers)
                
            if method.upper() == "GET":
                response = requests.get(url, headers=request_headers, params=params, timeout=30)
            elif method.upper() == "POST":
                response = requests.post(url, json=data, headers=request_headers, params=params, timeout=30)
            elif method.upper() == "PUT":
                response = requests.put(url, json=data, headers=request_headers, params=params, timeout=30)
            elif method.upper() == "DELETE":
                response = requests.delete(url, headers=request_headers, params=params, timeout=30)
            else:
                raise ValueError(f"Unsupported method: {method}")
                
            return response
        except requests.exceptions.Timeout:
            return None
        except requests.exceptions.RequestException as e:
            return None
    
    def test_auth_flow(self):
        """Test complete authentication flow"""
        print("\n=== Testing Authentication Flow ===")
        
        # Test 1: Login with demo credentials
        login_data = {
            "email": DEMO_EMAIL,
            "password": DEMO_PASSWORD
        }
        
        response = self.make_request("POST", "/auth/login", login_data)
        if response and response.status_code == 200:
            data = response.json()
            if "access_token" in data and "user" in data:
                self.access_token = data["access_token"]
                self.demo_user_data = data["user"]
                self.headers["Authorization"] = f"Bearer {self.access_token}"
                self.log_result("Auth Login", True, f"Successfully logged in as {data['user']['email']}")
            else:
                self.log_result("Auth Login", False, "Login response missing required fields", data)
        else:
            error_msg = response.text if response else "Connection timeout"
            self.log_result("Auth Login", False, f"Login failed with status {response.status_code if response else 'timeout'}", error_msg)
            return False
        
        # Test 2: Get current user info
        response = self.make_request("GET", "/auth/me")
        if response and response.status_code == 200:
            data = response.json()
            if data.get("email") == DEMO_EMAIL:
                self.log_result("Auth Me", True, f"Retrieved user info for {data['email']}")
            else:
                self.log_result("Auth Me", False, "User info doesn't match login", data)
        else:
            error_msg = response.text if response else "Connection timeout"
            self.log_result("Auth Me", False, f"Get user info failed", error_msg)
        
        # Test 3: Test registration (with unique email)
        unique_email = f"test_{uuid.uuid4().hex[:8]}@gmail.com"
        register_data = {
            "email": unique_email,
            "password": "test123456",
            "full_name": "Test User",
            "phone": "+7 777 999 8877"
        }
        
        response = self.make_request("POST", "/auth/register", register_data)
        if response and response.status_code == 200:
            data = response.json()
            if "access_token" in data and data["user"]["email"] == unique_email:
                self.log_result("Auth Register", True, f"Successfully registered {unique_email}")
            else:
                self.log_result("Auth Register", False, "Registration response invalid", data)
        else:
            error_msg = response.text if response else "Connection timeout"
            self.log_result("Auth Register", False, f"Registration failed", error_msg)
        
        return self.access_token is not None
    
    def test_categories(self):
        """Test categories endpoint"""
        print("\n=== Testing Categories API ===")
        
        response = self.make_request("GET", "/categories")
        if response and response.status_code == 200:
            categories = response.json()
            if isinstance(categories, list) and len(categories) > 0:
                # Check if categories have required fields
                first_cat = categories[0]
                required_fields = ["id", "name", "name_ru", "name_kz", "icon", "color"]
                if all(field in first_cat for field in required_fields):
                    self.log_result("Categories API", True, f"Retrieved {len(categories)} categories with multilingual support")
                    return categories
                else:
                    self.log_result("Categories API", False, "Categories missing required fields", first_cat)
            else:
                self.log_result("Categories API", False, "No categories returned", categories)
        else:
            error_msg = response.text if response else "Connection timeout"
            self.log_result("Categories API", False, "Failed to get categories", error_msg)
        
        return None
    
    def test_requests_crud(self):
        """Test requests CRUD operations"""
        print("\n=== Testing Requests CRUD ===")
        
        if not self.access_token:
            self.log_result("Requests CRUD", False, "No authentication token available")
            return
        
        # Test 1: Create a new request
        request_data = {
            "category_id": "roads",
            "address": "ул. Абая, 15, Астана",
            "latitude": 51.1500,
            "longitude": 71.4500,
            "place_type": "street",
            "problem_type": "Pothole",
            "reason": "Weather wear",
            "description": "Large pothole on the road causing traffic issues",
            "photos": []
        }
        
        response = self.make_request("POST", "/requests", request_data)
        created_request_id = None
        
        if response and response.status_code == 200:
            data = response.json()
            if "id" in data and data["category_id"] == "roads":
                created_request_id = data["id"]
                self.log_result("Create Request", True, f"Created request {created_request_id}")
            else:
                self.log_result("Create Request", False, "Invalid request response", data)
        else:
            error_msg = response.text if response else "Connection timeout"
            self.log_result("Create Request", False, "Failed to create request", error_msg)
        
        # Test 2: Get user's requests
        response = self.make_request("GET", "/requests")
        if response and response.status_code == 200:
            requests_list = response.json()
            if isinstance(requests_list, list):
                self.log_result("Get User Requests", True, f"Retrieved {len(requests_list)} user requests")
            else:
                self.log_result("Get User Requests", False, "Invalid requests response", requests_list)
        else:
            error_msg = response.text if response else "Connection timeout"
            self.log_result("Get User Requests", False, "Failed to get user requests", error_msg)
        
        # Test 3: Get all requests
        response = self.make_request("GET", "/requests/all")
        if response and response.status_code == 200:
            all_requests = response.json()
            if isinstance(all_requests, list):
                self.log_result("Get All Requests", True, f"Retrieved {len(all_requests)} total requests")
            else:
                self.log_result("Get All Requests", False, "Invalid all requests response", all_requests)
        else:
            error_msg = response.text if response else "Connection timeout"
            self.log_result("Get All Requests", False, "Failed to get all requests", error_msg)
        
        # Test 4: Get single request (if we created one)
        if created_request_id:
            response = self.make_request("GET", f"/requests/{created_request_id}")
            if response and response.status_code == 200:
                request_detail = response.json()
                if request_detail.get("id") == created_request_id:
                    self.log_result("Get Single Request", True, f"Retrieved request details for {created_request_id}")
                else:
                    self.log_result("Get Single Request", False, "Request details don't match", request_detail)
            else:
                error_msg = response.text if response else "Connection timeout"
                self.log_result("Get Single Request", False, "Failed to get single request", error_msg)
    
    def test_news_api(self):
        """Test news endpoints"""
        print("\n=== Testing News API ===")
        
        # Test 1: Get all news
        response = self.make_request("GET", "/news")
        if response and response.status_code == 200:
            news_list = response.json()
            if isinstance(news_list, list):
                self.log_result("Get All News", True, f"Retrieved {len(news_list)} news items")
                
                # Test news item structure
                if len(news_list) > 0:
                    first_news = news_list[0]
                    required_fields = ["id", "title", "content", "category", "created_at"]
                    if all(field in first_news for field in required_fields):
                        self.log_result("News Structure", True, "News items have correct structure")
                    else:
                        self.log_result("News Structure", False, "News items missing required fields", first_news)
            else:
                self.log_result("Get All News", False, "Invalid news response", news_list)
        else:
            error_msg = response.text if response else "Connection timeout"
            self.log_result("Get All News", False, "Failed to get news", error_msg)
        
        # Test 2: Filter news by category
        response = self.make_request("GET", "/news", params={"category": "critical"})
        if response and response.status_code == 200:
            filtered_news = response.json()
            if isinstance(filtered_news, list):
                # Check if all items have critical category
                critical_only = all(item.get("category") == "critical" for item in filtered_news) if filtered_news else True
                if critical_only:
                    self.log_result("News Category Filter", True, f"Retrieved {len(filtered_news)} critical news items")
                else:
                    self.log_result("News Category Filter", False, "Filter not working properly", filtered_news)
            else:
                self.log_result("News Category Filter", False, "Invalid filtered news response", filtered_news)
        else:
            error_msg = response.text if response else "Connection timeout"
            self.log_result("News Category Filter", False, "Failed to filter news", error_msg)
    
    def test_map_points(self):
        """Test map points endpoint"""
        print("\n=== Testing Map Points API ===")
        
        if not self.access_token:
            self.log_result("Map Points", False, "No authentication token available")
            return
        
        # Test 1: Get all map points
        response = self.make_request("GET", "/map/points")
        if response and response.status_code == 200:
            points = response.json()
            if isinstance(points, list):
                self.log_result("Get Map Points", True, f"Retrieved {len(points)} map points")
                
                # Check point structure
                if len(points) > 0:
                    first_point = points[0]
                    required_fields = ["id", "lat", "lng", "category", "status"]
                    if all(field in first_point for field in required_fields):
                        self.log_result("Map Points Structure", True, "Map points have correct structure")
                    else:
                        self.log_result("Map Points Structure", False, "Map points missing required fields", first_point)
            else:
                self.log_result("Get Map Points", False, "Invalid map points response", points)
        else:
            error_msg = response.text if response else "Connection timeout"
            self.log_result("Get Map Points", False, "Failed to get map points", error_msg)
        
        # Test 2: Get only user's points
        response = self.make_request("GET", "/map/points", params={"my_only": "true"})
        if response and response.status_code == 200:
            my_points = response.json()
            if isinstance(my_points, list):
                # Check if all points belong to user
                user_points_only = all(point.get("is_mine", False) for point in my_points) if my_points else True
                if user_points_only:
                    self.log_result("My Map Points Only", True, f"Retrieved {len(my_points)} user-specific points")
                else:
                    self.log_result("My Map Points Only", False, "Filter not working - contains other users' points", my_points[:2])
            else:
                self.log_result("My Map Points Only", False, "Invalid my points response", my_points)
        else:
            error_msg = response.text if response else "Connection timeout"
            self.log_result("My Map Points Only", False, "Failed to get user's points", error_msg)
    
    def test_locations_api(self):
        """Test saved locations endpoints"""
        print("\n=== Testing Locations API ===")
        
        if not self.access_token:
            self.log_result("Locations API", False, "No authentication token available")
            return
        
        # Test 1: Get saved locations
        response = self.make_request("GET", "/locations")
        if response and response.status_code == 200:
            locations = response.json()
            if isinstance(locations, list):
                self.log_result("Get Saved Locations", True, f"Retrieved {len(locations)} saved locations")
            else:
                self.log_result("Get Saved Locations", False, "Invalid locations response", locations)
        else:
            error_msg = response.text if response else "Connection timeout"
            self.log_result("Get Saved Locations", False, "Failed to get locations", error_msg)
        
        # Test 2: Create saved location
        location_data = {
            "name": "home",
            "label": "My Home",
            "address": "ул. Кенесары, 40, кв. 15",
            "latitude": 51.1600,
            "longitude": 71.4400
        }
        
        response = self.make_request("POST", "/locations", location_data)
        created_location_id = None
        
        if response and response.status_code == 200:
            location = response.json()
            if "id" in location and location["name"] == "home":
                created_location_id = location["id"]
                self.log_result("Create Saved Location", True, f"Created location {created_location_id}")
            else:
                self.log_result("Create Saved Location", False, "Invalid location creation response", location)
        else:
            error_msg = response.text if response else "Connection timeout"
            self.log_result("Create Saved Location", False, "Failed to create location", error_msg)
        
        # Test 3: Delete saved location (if created)
        if created_location_id:
            response = self.make_request("DELETE", f"/locations/{created_location_id}")
            if response and response.status_code == 200:
                self.log_result("Delete Saved Location", True, f"Deleted location {created_location_id}")
            else:
                error_msg = response.text if response else "Connection timeout"
                self.log_result("Delete Saved Location", False, "Failed to delete location", error_msg)
    
    def test_messages_api(self):
        """Test messages/chat endpoints"""
        print("\n=== Testing Messages API ===")
        
        if not self.access_token:
            self.log_result("Messages API", False, "No authentication token available")
            return
        
        # First, we need a request ID to test messages
        # Let's get user's requests to find one
        response = self.make_request("GET", "/requests")
        request_id = None
        
        if response and response.status_code == 200:
            requests_list = response.json()
            if requests_list and len(requests_list) > 0:
                request_id = requests_list[0]["id"]
        
        if not request_id:
            self.log_result("Messages API Setup", False, "No request available to test messages")
            return
        
        # Test 1: Get messages for a request
        response = self.make_request("GET", f"/requests/{request_id}/messages")
        if response and response.status_code == 200:
            messages = response.json()
            if isinstance(messages, list):
                self.log_result("Get Messages", True, f"Retrieved {len(messages)} messages for request {request_id}")
            else:
                self.log_result("Get Messages", False, "Invalid messages response", messages)
        else:
            error_msg = response.text if response else "Connection timeout"
            self.log_result("Get Messages", False, "Failed to get messages", error_msg)
        
        # Test 2: Send a message
        message_data = {
            "content": "Test message from API testing - is there any update on this request?"
        }
        
        response = self.make_request("POST", f"/requests/{request_id}/messages", message_data)
        if response and response.status_code == 200:
            message = response.json()
            if "id" in message and message["content"] == message_data["content"]:
                self.log_result("Send Message", True, f"Sent message to request {request_id}")
            else:
                self.log_result("Send Message", False, "Invalid message creation response", message)
        else:
            error_msg = response.text if response else "Connection timeout"
            self.log_result("Send Message", False, "Failed to send message", error_msg)
    
    def test_error_handling(self):
        """Test API error handling"""
        print("\n=== Testing Error Handling ===")
        
        # Test 1: Unauthorized access
        old_headers = self.headers.copy()
        self.headers = {"Content-Type": "application/json"}  # Remove auth header
        
        try:
            response = requests.get(f"{self.base_url}/auth/me", headers=self.headers, timeout=10)
            if response.status_code == 403:  # API returns 403 for missing auth
                self.log_result("Unauthorized Access", True, "Properly rejected unauthorized request")
            else:
                self.log_result("Unauthorized Access", False, f"Expected 403, got {response.status_code}")
        except Exception as e:
            self.log_result("Unauthorized Access", False, f"Request failed: {str(e)}")
        
        # Restore headers
        self.headers = old_headers
        
        # Test 2: Invalid request ID
        try:
            response = requests.get(f"{self.base_url}/requests/invalid-uuid", headers=self.headers, timeout=10)
            if response.status_code == 404:
                self.log_result("Invalid Request ID", True, "Properly handled invalid request ID")
            else:
                self.log_result("Invalid Request ID", False, f"Expected 404, got {response.status_code}")
        except Exception as e:
            self.log_result("Invalid Request ID", False, f"Request failed: {str(e)}")
        
        # Test 3: Invalid login credentials
        invalid_login = {
            "email": "nonexistent@example.com",
            "password": "wrongpassword"
        }
        
        # Temporarily remove auth to test login
        temp_headers = {"Content-Type": "application/json"}
        
        try:
            response = requests.post(f"{self.base_url}/auth/login", json=invalid_login, headers=temp_headers, timeout=10)
            if response.status_code == 401:
                self.log_result("Invalid Login", True, "Properly rejected invalid credentials")
            else:
                self.log_result("Invalid Login", False, f"Expected 401, got {response.status_code}")
        except Exception as e:
            self.log_result("Invalid Login", False, f"Request failed: {str(e)}")
    
    def run_all_tests(self):
        """Run all backend tests"""
        print("🧪 iKomek 109 Backend API Testing Started")
        print(f"🌐 Base URL: {self.base_url}")
        print(f"👤 Demo User: {DEMO_EMAIL}")
        print("=" * 60)
        
        try:
            # Must authenticate first
            if not self.test_auth_flow():
                print("❌ Authentication failed - cannot continue with other tests")
                return False
            
            # Test all endpoints
            self.test_categories()
            self.test_requests_crud() 
            self.test_news_api()
            self.test_map_points()
            self.test_locations_api()
            self.test_messages_api()
            self.test_error_handling()
            
            return True
            
        except Exception as e:
            print(f"❌ Test execution failed: {e}")
            traceback.print_exc()
            return False
    
    def print_summary(self):
        """Print test results summary"""
        print("\n" + "=" * 60)
        print("📊 TEST RESULTS SUMMARY")
        print("=" * 60)
        
        passed = len([r for r in self.test_results if r["success"]])
        failed = len([r for r in self.test_results if not r["success"]])
        total = len(self.test_results)
        
        print(f"✅ Passed: {passed}")
        print(f"❌ Failed: {failed}")
        print(f"📈 Total: {total}")
        print(f"🎯 Success Rate: {(passed/total)*100:.1f}%")
        
        if failed > 0:
            print(f"\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  • {result['test']}: {result['message']}")
        
        print("\n" + "=" * 60)
        return passed, failed, total

def main():
    """Main test execution"""
    tester = BackendTester()
    
    success = tester.run_all_tests()
    passed, failed, total = tester.print_summary()
    
    if not success or failed > 0:
        sys.exit(1)
    else:
        print("🎉 All backend tests passed successfully!")
        sys.exit(0)

if __name__ == "__main__":
    main()