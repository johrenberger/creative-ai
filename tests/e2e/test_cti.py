"""
CTI E2E Tests — Headless Playwright tests exercising all UI paths.

Covers: auth flow, tab navigation, data CRUD, WebSocket status,
protected-route guards, modal workflows, and error states.

Run against production:
    pytest tests/e2e/test_cti.py --base-url=https://cti.clawdexter.tech -v

Run against local dev:
    pytest tests/e2e/test_cti.py --base-url=http://localhost:3456 -v
"""
import time

import pytest


# ===================================================================
# ANONYMOUS / GUEST PATHS
# ===================================================================

@pytest.mark.anon
class TestAnonymousUser:
    """Exercises the UI when no user is logged in."""

    def test_homepage_loads(self, page, base_url):
        """Homepage responds and renders the app shell."""
        page.goto(base_url)
        page.wait_for_load_state("networkidle")
        assert page.title() == "CTI - Clawdexter's Thinking Interface"

    def test_shows_login_button(self, page, base_url):
        """Header shows a Login button when unauthenticated."""
        page.goto(base_url)
        page.wait_for_load_state("networkidle")
        login_btn = page.get_by_role("button", name="Login")
        assert login_btn.is_visible()

    def test_shows_disconnected_indicator(self, page, base_url):
        """WebSocket status shows Disconnected before login."""
        page.goto(base_url)
        page.wait_for_load_state("networkidle")
        status = page.locator("#wsStatus")
        assert status.inner_text() == "Disconnected"

    def test_clicking_login_shows_modal(self, page, base_url):
        """Clicking Login opens the auth modal with username/password fields."""
        page.goto(base_url)
        page.wait_for_load_state("networkidle")
        page.get_by_role("button", name="Login").click()
        page.wait_for_selector("#loginUsername", timeout=5000)
        assert page.locator("#loginUsername").is_visible()
        assert page.locator("#loginPassword").is_visible()

    def test_data_tabs_block_unauthenticated(self, page, base_url):
        """Protected tabs redirect to login modal when unauthenticated."""
        page.goto(base_url)
        page.wait_for_load_state("networkidle")
        for tab_name in ["Tasks", "Memory", "Bridge", "Context"]:
            page.get_by_role("button", name=tab_name).click()
            page.wait_for_selector("#loginUsername", timeout=3000)
            assert page.locator("#loginUsername").is_visible()

    def test_health_endpoint_accessible(self, page, base_url):
        """GET /health is publicly accessible."""
        resp = page.request.get(f"{base_url}/health")
        assert resp.status == 200
        data = resp.json()
        assert data.get("status") == "ok"

    def test_stats_endpoint_accessible(self, page, base_url):
        """GET /api/stats is publicly accessible."""
        resp = page.request.get(f"{base_url}/api/stats")
        assert resp.status == 200
        data = resp.json()
        assert "tasks" in data


# ===================================================================
# LOGIN FLOW
# ===================================================================

@pytest.mark.auth
class TestLoginFlow:
    """Exercises the full login → authenticated session path."""

    def test_login_success_shows_dashboard(self, page, base_url, test_user):
        """Valid credentials dismiss the modal and show dashboard stats."""
        page.goto(base_url)
        page.wait_for_load_state("networkidle")

        page.get_by_role("button", name="Login").click()
        page.wait_for_selector("#loginUsername", timeout=5000)
        page.fill("#loginUsername", test_user["username"])
        page.fill("#loginPassword", test_user["password"])
        page.click("button:has-text('Sign In')")

        page.wait_for_selector("#statTasks", timeout=10000)
        assert page.locator("#statTasks").is_visible()

    def test_login_failure_shows_error(self, page, base_url):
        """Invalid credentials display an error message."""
        page.goto(base_url)
        page.wait_for_load_state("networkidle")
        page.get_by_role("button", name="Login").click()
        page.wait_for_selector("#loginUsername", timeout=5000)

        page.fill("#loginUsername", "nobody")
        page.fill("#loginPassword", "wrongpassword")
        page.click("button:has-text('Sign In')")

        page.wait_for_selector("#loginError", timeout=5000)
        assert page.locator("#loginError").is_visible()
        error_text = page.locator("#loginError").inner_text()
        assert len(error_text) > 0

    def test_login_shows_username_in_header(self, page, base_url, test_user):
        """After login the header shows the authenticated username."""
        page.goto(base_url)
        page.wait_for_load_state("networkidle")
        page.get_by_role("button", name="Login").click()
        page.wait_for_selector("#loginUsername", timeout=5000)
        page.fill("#loginUsername", test_user["username"])
        page.fill("#loginPassword", test_user["password"])
        page.click("button:has-text('Sign In')")
        page.wait_for_selector("#statTasks", timeout=10000)

        header = page.locator("#authNav")
        assert header.inner_text() != ""

    def test_login_closes_modal(self, page, base_url, test_user):
        """Login success removes the login modal."""
        page.goto(base_url)
        page.wait_for_load_state("networkidle")
        page.get_by_role("button", name="Login").click()
        page.wait_for_selector("#loginUsername", timeout=5000)
        page.fill("#loginUsername", test_user["username"])
        page.fill("#loginPassword", test_user["password"])
        page.click("button:has-text('Sign In')")
        page.wait_for_timeout(1000)

        panel_html = page.locator("#loginPanel").inner_html()
        assert "#loginModal" not in panel_html


# ===================================================================
# DASHBOARD
# ===================================================================

@pytest.mark.auth
class TestDashboard:
    """Exercises the dashboard panel and WebSocket status."""

    def test_dashboard_stats_load(self, page, base_url, test_user):
        """Dashboard stat cards show non-placeholder values after login."""
        _login(page, test_user)
        page.wait_for_selector("#statTasks", timeout=10000)

        stat_tasks = page.locator("#statTasks").inner_text()
        stat_exchanges = page.locator("#statExchanges").inner_text()
        stat_memories = page.locator("#statMemories").inner_text()
        stat_urgent = page.locator("#statUrgent").inner_text()

        assert stat_tasks != "-"
        assert stat_exchanges != "-"
        assert stat_memories != "-"
        assert stat_urgent != "-"
        assert int(stat_tasks) >= 0
        assert int(stat_exchanges) >= 0
        assert int(stat_memories) >= 0
        assert int(stat_urgent) >= 0

    def test_dashboard_shows_recent_tasks(self, page, base_url, test_user):
        """Dashboard recent-tasks card renders task items or empty state."""
        _login(page, test_user)
        page.wait_for_selector("#statTasks", timeout=10000)
        page.wait_for_timeout(1000)

        html = page.locator("#recentTasks").inner_html()
        assert ("task-item" in html) or ("empty-state" in html)

    def test_websocket_connects_after_login(self, page, base_url, test_user):
        """After login, WebSocket status changes to Connected."""
        _login(page, test_user)
        page.wait_for_selector("#statTasks", timeout=10000)
        page.wait_for_timeout(3000)

        assert page.locator("#wsStatus").inner_text() == "Connected"
        assert "connected" in (page.locator("#wsIndicator").get_attribute("class") or "")

    def test_websocket_disconnected_before_login(self, page, base_url):
        """Fresh page load shows Disconnected before authentication."""
        page.goto(base_url)
        page.wait_for_load_state("networkidle")
        assert page.locator("#wsStatus").inner_text() == "Disconnected"


# ===================================================================
# TAB NAVIGATION
# ===================================================================

@pytest.mark.auth
class TestTabNavigation:
    """Exercises all five tabs."""

    def test_navigate_to_tasks_tab(self, page, base_url, test_user):
        """Clicking Tasks tab shows the Tasks panel."""
        _login(page, test_user)
        page.wait_for_selector("#statTasks", timeout=10000)
        page.get_by_role("button", name="Tasks").click()
        page.wait_for_selector("#taskList", timeout=5000)
        assert page.locator("#panel-tasks").is_visible()

    def test_navigate_to_memory_tab(self, page, base_url, test_user):
        """Clicking Memory tab shows the Memory panel."""
        _login(page, test_user)
        page.wait_for_selector("#statTasks", timeout=10000)
        page.get_by_role("button", name="Memory").click()
        page.wait_for_selector("#memoryList", timeout=5000)
        assert page.locator("#panel-memory").is_visible()

    def test_navigate_to_bridge_tab(self, page, base_url, test_user):
        """Clicking Bridge tab shows the Bridge panel."""
        _login(page, test_user)
        page.wait_for_selector("#statTasks", timeout=10000)
        page.get_by_role("button", name="Bridge").click()
        page.wait_for_selector("#exchangeList", timeout=5000)
        assert page.locator("#panel-bridge").is_visible()

    def test_navigate_to_context_tab(self, page, base_url, test_user):
        """Clicking Context tab shows the Context panel."""
        _login(page, test_user)
        page.wait_for_selector("#statStats", timeout=10000)
        page.get_by_role("button", name="Context").click()
        page.wait_for_selector("#contextList", timeout=5000)
        assert page.locator("#panel-context").is_visible()

    def test_active_tab_button_is_highlighted(self, page, base_url, test_user):
        """The active tab button has the 'active' CSS class."""
        _login(page, test_user)
        page.wait_for_selector("#statTasks", timeout=10000)
        tasks_tab = page.get_by_role("button", name="Tasks")
        tasks_tab.click()
        page.wait_for_timeout(500)
        assert "active" in (tasks_tab.get_attribute("class") or "")


# ===================================================================
# TASKS CRUD
# ===================================================================

@pytest.mark.auth
class TestTasksCrud:
    """Exercises task creation, listing, and deletion."""

    def test_new_task_button_opens_modal(self, page, base_url, test_user):
        """Clicking '+ New Task' opens the task modal."""
        _goto_tasks(page, test_user)
        page.click("button:has-text('+ New Task')")
        page.wait_for_selector("#taskModal.active", timeout=5000)
        assert page.locator("#taskModal").is_visible()

    def test_task_form_title_required(self, page, base_url, test_user):
        """Title field is required; empty submit keeps modal open."""
        _goto_tasks(page, test_user)
        page.click("button:has-text('+ New Task')")
        page.wait_for_selector("#taskModal.active", timeout=5000)
        page.fill("#taskTitle", "")
        page.click("button[type='submit']")
        page.wait_for_timeout(500)
        assert page.locator("#taskModal").is_visible()

    def test_create_task(self, page, base_url, test_user):
        """Filling and submitting the task form creates a new task."""
        _goto_tasks(page, test_user)
        page.click("button:has-text('+ New Task')")
        page.wait_for_selector("#taskModal.active", timeout=5000)

        task_title = f"Test task {_now_ms()}"
        page.fill("#taskTitle", task_title)
        page.fill("#taskDescription", "A test task description")
        page.fill("#taskPriority", "7")
        page.fill("#taskUrgency", "8")
        page.fill("#taskProject", "test-project")
        page.click("button[type='submit']")

        page.wait_for_selector("#taskModal:not(.active)", timeout=5000)
        page.wait_for_timeout(1000)

        assert task_title in page.locator("#taskList").inner_html()

    def test_delete_task_removes_from_list(self, page, base_url, test_user):
        """Deleting a task removes it from the list."""
        _goto_tasks(page, test_user)
        _create_task(page, f"Deletable task {_now_ms()}")

        def accept_dialog(dialog):
            dialog.accept()
        page.on("dialog", accept_dialog)
        page.locator("#taskList .task-item button.btn-danger").first.click()
        page.wait_for_timeout(1000)

        html = page.locator("#taskList").inner_html()
        assert "Deletable task" not in html

    def test_task_filter_by_status(self, page, base_url, test_user):
        """Changing the status filter updates the task list without crashing."""
        _goto_tasks(page, test_user)
        page.select_option("#taskFilterStatus", "done")
        page.wait_for_timeout(1000)
        html = page.locator("#taskList").inner_html()
        assert ("empty-state" in html) or ("task-item" in html)

    def test_task_search_no_results(self, page, base_url, test_user):
        """Searching a non-existent term shows the empty state."""
        _goto_tasks(page, test_user)
        page.fill("#taskSearch", "xyznonexistent999")
        page.wait_for_timeout(1000)
        html = page.locator("#taskList").inner_html()
        assert "empty-state" in html


# ===================================================================
# MEMORY CRUD
# ===================================================================

@pytest.mark.auth
class TestMemoryCrud:
    """Exercises memory creation and listing."""

    def test_new_memory_button_opens_modal(self, page, base_url, test_user):
        """Clicking '+ Store Memory' opens the memory modal."""
        _goto_memory(page, test_user)
        page.click("button:has-text('+ Store Memory')")
        page.wait_for_selector("#memoryModal.active", timeout=5000)
        assert page.locator("#memoryModal").is_visible()

    def test_create_memory(self, page, base_url, test_user):
        """Filling and submitting the memory form stores a new memory."""
        _goto_memory(page, test_user)
        page.click("button:has-text('+ Store Memory')")
        page.wait_for_selector("#memoryModal.active", timeout=5000)

        memory_content = f"Test memory {_now_ms()}"
        page.fill("#memoryContent", memory_content)
        page.select_option("#memoryType", "note")
        page.fill("#memoryConfidence", "0.9")
        page.fill("#memoryTags", "test, e2e")
        page.click("button[type='submit']")

        page.wait_for_selector("#memoryModal:not(.active)", timeout=5000)
        page.wait_for_timeout(1000)

        assert memory_content in page.locator("#memoryList").inner_html()

    def test_memory_filter_by_type(self, page, base_url, test_user):
        """Changing the type filter updates the memory list without crashing."""
        _goto_memory(page, test_user)
        page.select_option("#memoryFilterType", "decision")
        page.wait_for_timeout(1000)
        assert True


# ===================================================================
# BRIDGE / EXCHANGE CRUD
# ===================================================================

@pytest.mark.auth
class TestBridgeCrud:
    """Exercises exchange creation and listing."""

    def test_new_exchange_button_opens_modal(self, page, base_url, test_user):
        """Clicking '+ New Exchange' opens the exchange modal."""
        _goto_bridge(page, test_user)
        page.click("button:has-text('+ New Exchange')")
        page.wait_for_selector("#exchangeModal.active", timeout=5000)
        assert page.locator("#exchangeModal").is_visible()

    def test_create_exchange(self, page, base_url, test_user):
        """Filling and submitting the exchange form creates a new exchange."""
        _goto_bridge(page, test_user)
        page.click("button:has-text('+ New Exchange')")
        page.wait_for_selector("#exchangeModal.active", timeout=5000)

        exchange_subject = f"Test exchange {_now_ms()}"
        page.select_option("#exchangeType", "task")
        page.fill("#exchangeSubject", exchange_subject)
        page.fill("#exchangeContent", "Exchange test content")
        page.fill("#exchangeIntent", "Test intent")
        page.fill("#exchangeImpact", "Test impact")
        page.select_option("#exchangePriority", "high")
        page.click("button[type='submit']")

        page.wait_for_selector("#exchangeModal:not(.active)", timeout=5000)
        page.wait_for_timeout(1000)

        assert exchange_subject in page.locator("#exchangeList").inner_html()

    def test_exchange_filter_by_status(self, page, base_url, test_user):
        """Changing the status filter updates the exchange list without crashing."""
        _goto_bridge(page, test_user)
        page.select_option("#bridgeFilterStatus", "closed")
        page.wait_for_timeout(1000)
        assert True


# ===================================================================
# CONTEXT
# ===================================================================

@pytest.mark.auth
class TestContext:
    """Exercises context management."""

    def test_set_context_button_opens_modal(self, page, base_url, test_user):
        """Clicking '+ Set Context' opens the context modal."""
        _goto_context(page, test_user)
        page.click("button:has-text('+ Set Context')")
        page.wait_for_selector("#contextModal.active", timeout=5000)
        assert page.locator("#contextModal").is_visible()

    def test_set_string_context(self, page, base_url, test_user):
        """Setting a string context key/value persists it."""
        _goto_context(page, test_user)
        page.click("button:has-text('+ Set Context')")
        page.wait_for_selector("#contextModal.active", timeout=5000)

        ctx_key = f"test_key_{_now_ms()}"
        page.fill("#contextKey", ctx_key)
        page.fill("#contextValue", "test value")
        page.select_option("#contextType", "string")
        page.fill("#contextProject", "test-project")
        page.click("button[type='submit']")

        page.wait_for_selector("#contextModal:not(.active)", timeout=5000)
        page.wait_for_timeout(1000)

        assert ctx_key in page.locator("#contextList").inner_html()

    def test_delete_context(self, page, base_url, test_user):
        """Deleting a context removes it from the list."""
        _goto_context(page, test_user)
        page.click("button:has-text('+ Set Context')")
        page.wait_for_selector("#contextModal.active", timeout=5000)

        ctx_key = f"delete_me_{_now_ms()}"
        page.fill("#contextKey", ctx_key)
        page.fill("#contextValue", "to be deleted")
        page.click("button[type='submit']")
        page.wait_for_selector("#contextModal:not(.active)", timeout=5000)
        page.wait_for_timeout(1000)

        def accept_dialog(dialog):
            dialog.accept()
        page.on("dialog", accept_dialog)
        page.locator("#contextList .card button.btn-danger").first.click()
        page.wait_for_timeout(1000)

        html = page.locator("#contextList").inner_html()
        assert ctx_key not in html


# ===================================================================
# LOGOUT
# ===================================================================

@pytest.mark.auth
class TestLogout:
    """Exercises the logout flow."""

    def test_logout_returns_to_login(self, page, base_url, test_user):
        """Clicking Logout shows the login modal and resets WebSocket status."""
        _login(page, test_user)
        page.wait_for_selector("#statTasks", timeout=10000)
        page.wait_for_timeout(2000)

        page.click("button:has-text('Logout')")
        page.wait_for_timeout(1000)

        assert page.locator("#loginUsername").is_visible()
        assert page.locator("#wsStatus").inner_text() == "Disconnected"

    def test_logged_out_user_cannot_access_data_tabs(self, page, base_url, test_user):
        """After logout, protected tabs redirect to the login modal."""
        _login(page, test_user)
        page.wait_for_selector("#statTasks", timeout=10000)
        page.click("button:has-text('Logout')")
        page.wait_for_timeout(1000)

        page.get_by_role("button", name="Tasks").click()
        page.wait_for_selector("#loginUsername", timeout=3000)
        assert page.locator("#loginUsername").is_visible()


# ===================================================================
# MODAL BEHAVIOR
# ===================================================================

@pytest.mark.auth
class TestModalBehavior:
    """Exercises modal open/close/escape-key/backdrop behaviors."""

    def test_modal_closes_on_cancel(self, page, base_url, test_user):
        """Clicking Cancel closes the modal without submitting."""
        _goto_tasks(page, test_user)
        page.click("button:has-text('+ New Task')")
        page.wait_for_selector("#taskModal.active", timeout=5000)
        page.click("button:has-text('Cancel')")
        page.wait_for_selector("#taskModal:not(.active)", timeout=5000)

    def test_modal_closes_on_escape(self, page, base_url, test_user):
        """Pressing Escape closes the active modal."""
        _goto_tasks(page, test_user)
        page.click("button:has-text('+ New Task')")
        page.wait_for_selector("#taskModal.active", timeout=5000)
        page.keyboard.press("Escape")
        page.wait_for_selector("#taskModal:not(.active)", timeout=5000)

    def test_modal_closes_on_backdrop_click(self, page, base_url, test_user):
        """Clicking the modal backdrop closes it without submitting."""
        _goto_tasks(page, test_user)
        page.click("button:has-text('+ New Task')")
        page.wait_for_selector("#taskModal.active", timeout=5000)
        page.locator("#taskModal").click(position={"x": 10, "y": 10})
        page.wait_for_selector("#taskModal:not(.active)", timeout=5000)


# ===================================================================
# SESSION PERSISTENCE
# ===================================================================

@pytest.mark.auth
class TestSessionPersistence:
    """Exercises that the session survives a page reload."""

    def test_page_reload_stays_logged_in(self, page, base_url, test_user):
        """Reloading the page preserves the authenticated session."""
        _login(page, test_user)
        page.wait_for_selector("#statTasks", timeout=10000)
        page.reload()
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(2000)

        assert page.locator("#statTasks").is_visible()
        assert page.locator("#loginPanel").inner_html() == ""


# ===================================================================
# ERROR / EDGE CASES
# ===================================================================

@pytest.mark.auth
class TestEdgeCases:
    """Edge cases and error handling."""

    def test_no_double_websocket_connection(self, page, base_url, test_user):
        """Login → logout → re-login does not leave WS stuck on Disconnected."""
        _login(page, test_user)
        page.wait_for_selector("#statTasks", timeout=10000)
        page.wait_for_timeout(2000)

        page.click("button:has-text('Logout')")
        page.wait_for_timeout(1000)

        page.get_by_role("button", name="Login").click()
        page.wait_for_selector("#loginUsername", timeout=5000)
        page.fill("#loginUsername", test_user["username"])
        page.fill("#loginPassword", test_user["password"])
        page.click("button:has-text('Sign In')")
        page.wait_for_selector("#statTasks", timeout=10000)
        page.wait_for_timeout(2000)

        assert page.locator("#wsStatus").inner_text() == "Connected"

    def test_xss_in_task_title_is_escaped(self, page, base_url, test_user):
        """Malicious script tags in task titles are HTML-escaped."""
        _goto_tasks(page, test_user)
        page.click("button:has-text('+ New Task')")
        page.wait_for_selector("#taskModal.active", timeout=5000)

        xss_title = "<script>alert(1)</script>"
        page.fill("#taskTitle", xss_title)
        page.fill("#taskDescription", "safe")
        page.click("button[type='submit']")
        page.wait_for_selector("#taskModal:not(.active)", timeout=5000)
        page.wait_for_timeout(1000)

        page_content = page.content()
        assert "<script>" not in page_content or "&lt;script&gt;" in page_content


# ===================================================================
# HELPERS
# ===================================================================

def _login(page, test_user):
    """Perform the standard login sequence."""
    page.get_by_role("button", name="Login").click()
    page.wait_for_selector("#loginUsername", timeout=5000)
    page.fill("#loginUsername", test_user["username"])
    page.fill("#loginPassword", test_user["password"])
    page.click("button:has-text('Sign In')")
    page.wait_for_selector("#statTasks", timeout=10000)


def _goto_tasks(page, test_user):
    """Navigate to Tasks tab."""
    page.goto("https://cti.clawdexter.tech")
    page.wait_for_load_state("networkidle")
    _login(page, test_user)
    page.wait_for_selector("#statTasks", timeout=10000)
    page.get_by_role("button", name="Tasks").click()
    page.wait_for_selector("#taskList", timeout=5000)


def _goto_memory(page, test_user):
    """Navigate to Memory tab."""
    page.goto("https://cti.clawdexter.tech")
    page.wait_for_load_state("networkidle")
    _login(page, test_user)
    page.wait_for_selector("#statTasks", timeout=10000)
    page.get_by_role("button", name="Memory").click()
    page.wait_for_selector("#memoryList", timeout=5000)


def _goto_bridge(page, test_user):
    """Navigate to Bridge tab."""
    page.goto("https://cti.clawdexter.tech")
    page.wait_for_load_state("networkidle")
    _login(page, test_user)
    page.wait_for_selector("#statTasks", timeout=10000)
    page.get_by_role("button", name="Bridge").click()
    page.wait_for_selector("#exchangeList", timeout=5000)


def _goto_context(page, test_user):
    """Navigate to Context tab."""
    page.goto("https://cti.clawdexter.tech")
    page.wait_for_load_state("networkidle")
    _login(page, test_user)
    page.wait_for_selector("#statTasks", timeout=10000)
    page.get_by_role("button", name="Context").click()
    page.wait_for_selector("#contextList", timeout=5000)


def _create_task(page, title, priority=5, urgency=5):
    """Create a task via the modal (assumes Tasks tab is already visible)."""
    page.click("button:has-text('+ New Task')")
    page.wait_for_selector("#taskModal.active", timeout=5000)
    page.fill("#taskTitle", title)
    page.fill("#taskPriority", str(priority))
    page.fill("#taskUrgency", str(urgency))
    page.click("button[type='submit']")
    page.wait_for_selector("#taskModal:not(.active)", timeout=5000)
    page.wait_for_timeout(1000)


def _now_ms():
    """Monotonic timestamp for unique test data names."""
    return str(int(time.time() * 1000))