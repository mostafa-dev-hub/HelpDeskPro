console.log('Script starting...');

// API Configuration
const API_BASE_URL = 'http://localhost:3000/api';

// Current user and page state
let currentUser = null;
let currentUserData = null;
let currentUserType = 'admin';
let currentPage = 'dashboard';
let authToken = null;

// Cache for frequently accessed data
let categoriesCache = null;
let ticketsCache = null;

console.log('Variables initialized successfully');

// Enhanced API call function with better error handling
async function apiCall(endpoint, options = {}) {
    const url = `${API_BASE_URL}/${endpoint}`;
    const config = {
        headers: {
            'Content-Type': 'application/json',
            ...(authToken && { 'Authorization': `Bearer ${authToken}` })
        },
        ...options
    };

    if (config.body && typeof config.body === 'object') {
        config.body = JSON.stringify(config.body);
    }

    console.log(`API Call: ${config.method || 'GET'} ${url}`, config.body ? JSON.parse(config.body) : 'No body');

    try {
        const response = await fetch(url, config);
        
        // Check if response is ok
        if (!response.ok) {
            console.error(`HTTP Error: ${response.status} ${response.statusText}`);
        }
        
        // Try to parse JSON
        let data;
        try {
            data = await response.json();
        } catch (parseError) {
            console.error('Failed to parse JSON response:', parseError);
            throw new Error(`Server returned invalid response (${response.status})`);
        }
        
        console.log('API Response:', data);
        
        if (!response.ok) {
            throw new Error(data.message || `HTTP error! status: ${response.status}`);
        }
        
        return data;
    } catch (error) {
        console.error(`API call failed for ${endpoint}:`, error);
        
        // Enhanced error messages
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            throw new Error('Cannot connect to server. Please check if the server is running.');
        }
        
        throw error;
    }
}

// User type selection
function selectUserType(type) {
    document.querySelectorAll('.user-type-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`[onclick="selectUserType('${type}')"]`).classList.add('active');
    
    const signupLink = document.querySelector('.signup-link');
    
    if (type === 'admin') {
        document.getElementById('adminCredentials').classList.remove('hidden');
        document.getElementById('customerCredentials').classList.add('hidden');
        if (signupLink) {
            signupLink.classList.remove('show-signup');
        }
    } else {
        document.getElementById('adminCredentials').classList.add('hidden');
        document.getElementById('customerCredentials').classList.remove('hidden');
        if (signupLink) {
            signupLink.classList.add('show-signup');
        }
    }
}

// Enhanced login functionality with real database
async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    try {
        // Show loading state
        const loginBtn = document.querySelector('.login-btn');
        const originalText = loginBtn.textContent;
        loginBtn.textContent = 'Signing In...';
        loginBtn.disabled = true;
        
        // Call real API
        const result = await apiCall('auth/login', {
            method: 'POST',
            body: { username, password }
        });
        
        if (result.success) {
            // Store authentication data
            currentUserData = result.user;
            currentUser = `${result.user.firstName} ${result.user.lastName}`;
            currentUserType = result.user.role.toLowerCase();
            authToken = result.token;
            
            // Store token for future API calls
            localStorage.setItem('authToken', authToken);
            localStorage.setItem('currentUser', JSON.stringify(currentUserData));
            
            // Set body class based on role
            document.body.className = `user-${currentUserType}`;
            
            // Update UI with user info
            document.getElementById('userRole').textContent = result.user.role;
            
            // Show main app and navigate to appropriate dashboard
            showMainApp();
            
            if (currentUserType === 'customer') {
                showPage('customerDashboard');
            } else {
                showPage('dashboard');
            }
            
            // Load initial data
            await loadDashboardData();
            
        } else {
            throw new Error(result.message || 'Login failed');
        }
        
    } catch (error) {
        console.error('Login error:', error);
        alert(`Login failed: ${error.message}`);
    } finally {
        // Reset button state
        const loginBtn = document.querySelector('.login-btn');
        loginBtn.textContent = 'Sign In';
        loginBtn.disabled = false;
    }
    
    return false;
}

// Enhanced sign-up functionality with real database
async function handleSignUp(e) {
    e.preventDefault();
    
    const formData = {
        firstName: document.getElementById('signupFirstName').value,
        lastName: document.getElementById('signupLastName').value,
        email: document.getElementById('signupEmail').value,
        company: document.getElementById('signupCompany').value,
        phone: document.getElementById('signupPhone').value,
        username: document.getElementById('signupUsername').value,
        password: document.getElementById('signupPassword').value
    };
    
    const confirmPassword = document.getElementById('signupConfirmPassword').value;
    const agreeTerms = document.getElementById('agreeTerms').checked;
    
    // Client-side validation
    if (formData.password !== confirmPassword) {
        alert('Passwords do not match. Please try again.');
        return false;
    }
    
    if (formData.password.length < 6) {
        alert('Password must be at least 6 characters long.');
        return false;
    }
    
    if (!agreeTerms) {
        alert('You must agree to the Terms of Service to create an account.');
        return false;
    }
    
    try {
        // Show loading state
        const signupBtn = document.querySelector('#signupForm .login-btn');
        const originalText = signupBtn.textContent;
        signupBtn.textContent = 'Creating Account...';
        signupBtn.disabled = true;
        
        // Call real API
        const result = await apiCall('users/register', {
            method: 'POST',
            body: formData
        });
        
        if (result.success) {
            alert(`Account created successfully!\n\nWelcome ${formData.firstName}! You can now sign in with your credentials.\n\nUsername: ${formData.username}\nEmail: ${formData.email}`);
            
            // Clear form and go back to login
            document.getElementById('signupForm').reset();
            showLogin();
            
            // Pre-fill login form
            document.getElementById('username').value = formData.username;
            selectUserType('customer');
        } else {
            throw new Error(result.message || 'Registration failed');
        }
        
    } catch (error) {
        console.error('Registration error:', error);
        alert(`Registration failed: ${error.message}`);
    } finally {
        // Reset button state
        const signupBtn = document.querySelector('#signupForm .login-btn');
        signupBtn.textContent = 'Create Account';
        signupBtn.disabled = false;
    }
    
    return false;
}

// Load dashboard statistics from real database
async function loadDashboardData() {
    try {
        if (!currentUserData) return;
        
        const result = await apiCall(`dashboard/stats?userID=${currentUserData.userID}&userRole=${currentUserData.role}`);
        
        if (result.success) {
            updateDashboardStats(result.stats);
        }
        
        // Load tickets for current user
        await loadUserTickets();
        
        // Load categories if not cached
        if (!categoriesCache) {
            await loadCategories();
        }
        
    } catch (error) {
        console.error('Error loading dashboard data:', error);
    }
}

// Update dashboard statistics in UI
function updateDashboardStats(stats) {
    if (currentUserType === 'customer') {
        // Customer dashboard stats
        const totalEl = document.getElementById('customerTotalTickets');
        const openEl = document.getElementById('customerOpenTickets');
        const resolvedEl = document.getElementById('customerResolvedTickets');
        
        if (totalEl) totalEl.textContent = stats.TotalTickets || 0;
        if (openEl) openEl.textContent = stats.OpenTickets || 0;
        if (resolvedEl) resolvedEl.textContent = (stats.ResolvedTickets || 0) + (stats.ClosedTickets || 0);
        
    } else {
        // Admin/Staff dashboard stats
        const statCards = document.querySelectorAll('#dashboardPage .stat-number');
        if (statCards.length >= 4) {
            statCards[0].textContent = stats.OpenTickets || 0;
            statCards[1].textContent = stats.PendingTickets || 0;
            statCards[2].textContent = stats.ResolvedTickets || 0;
            statCards[3].textContent = stats.ClosedTickets || 0;
        }
    }
}

// Load user tickets from real database
async function loadUserTickets(status = null, pageSize = 20, pageNumber = 1) {
    try {
        if (!currentUserData) return;
        
        const params = new URLSearchParams({
            userID: currentUserData.userID,
            userRole: currentUserData.role,
            pageSize: pageSize,
            pageNumber: pageNumber
        });
        
        if (status) params.append('status', status);
        
        const result = await apiCall(`tickets/user?${params}`);
        
        if (result.success) {
            ticketsCache = result.tickets;
            console.log('=== TICKETS DATA FROM DATABASE ===');
            console.log('User type:', currentUserType);
            console.log('User data:', currentUserData);
            console.log('Tickets received:', ticketsCache);
            if (ticketsCache && ticketsCache.length > 0) {
                console.log('Sample ticket data:', ticketsCache[0]);
                console.log('Ticket fields:', Object.keys(ticketsCache[0]));
            }
            populateTicketTables();
        }
        
    } catch (error) {
        console.error('Error loading tickets:', error);
    }
}

// Enhanced category loading with error handling
async function loadCategories() {
    try {
        console.log('Loading categories...');
        const result = await apiCall('categories');
        
        if (result.success) {
            categoriesCache = result.categories;
            console.log('Categories loaded:', categoriesCache);
            populateCategoryDropdowns();
        } else {
            console.error('Failed to load categories:', result.message);
            // Use default categories if API fails
            setDefaultCategories();
        }
        
    } catch (error) {
        console.error('Error loading categories:', error);
        // Use default categories as fallback
        setDefaultCategories();
    }
}

// Set default categories as fallback
function setDefaultCategories() {
    categoriesCache = [
        { CategoryID: 1, CategoryName: 'Technical Support' },
        { CategoryID: 2, CategoryName: 'Billing' },
        { CategoryID: 3, CategoryName: 'General Inquiry' },
        { CategoryID: 4, CategoryName: 'Bug Report' },
        { CategoryID: 5, CategoryName: 'Feature Request' }
    ];
    populateCategoryDropdowns();
}

// Enhanced ticket creation with proper error handling and debugging
async function createNewTicket(formId) {
    console.log('=== CREATE NEW TICKET FUNCTION CALLED ===');
    console.log('Form ID:', formId);
    console.log('Current user type:', currentUserType);
    console.log('Current user data:', currentUserData);
    
    const isModal = formId === 'modalTicketForm';
    const prefix = isModal ? 'modal' : '';
    
    // Get form elements with correct IDs
    const subjectEl = document.getElementById('ticketSubject');
    const priorityEl = document.getElementById('ticketPriority');
    const categoryEl = document.getElementById('ticketCategory');
    const descriptionEl = document.getElementById('ticketDescription');
    
    console.log('Form elements found:', {
        subject: !!subjectEl,
        priority: !!priorityEl,
        category: !!categoryEl,
        description: !!descriptionEl
    });
    
    if (!subjectEl || !priorityEl || !categoryEl || !descriptionEl) {
        console.error('Form elements not found:', {
            subject: !!subjectEl,
            priority: !!priorityEl,
            category: !!categoryEl,
            description: !!descriptionEl
        });
        alert('Form elements missing. Please refresh the page and try again.');
        return;
    }
    
    // Validate form data
    const subject = subjectEl.value.trim();
    const description = descriptionEl.value.trim();
    
    console.log('Form values:', {
        subject: subject,
        priority: priorityEl.value,
        category: categoryEl.value,
        description: description
    });
    
    if (!subject) {
        alert('Please enter a subject for your ticket.');
        subjectEl.focus();
        return;
    }
    
    if (!description) {
        alert('Please enter a description for your ticket.');
        descriptionEl.focus();
        return;
    }
    
    const ticketData = {
        subject: subject,
        priority: priorityEl.value,
        categoryID: parseInt(categoryEl.value) || 1, // Default to 1 if NaN
        description: description,
        customerID: currentUserData?.userID || 1
    };
    
    console.log('Ticket data to submit:', ticketData);
    
    // For admin users, get customer email
    if (currentUserType === 'admin' || currentUserType === 'staff') {
        const customerEmailEl = document.getElementById('ticketCustomer');
        if (customerEmailEl && customerEmailEl.value.trim()) {
            ticketData.customerEmail = customerEmailEl.value.trim();
        }
    }
    
    try {
        // Show loading state
        const submitBtn = document.querySelector(`#${formId} .new-ticket-btn`);
        if (!submitBtn) {
            console.error('Submit button not found in form:', formId);
            return;
        }
        
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Creating...';
        submitBtn.disabled = true;
        
        console.log('Sending API request to tickets/create...');
        const result = await apiCall('tickets/create', {
            method: 'POST',
            body: ticketData
        });
        
        console.log('API response:', result);
        
        if (result.success) {
            // Reset form
            document.getElementById(formId).reset();
            
            // Show success message
            const ticketNumber = result.ticket?.TicketNumber || `TKT-${String(result.ticket?.TicketID || Date.now()).padStart(6, '0')}`;
            
            if (currentUserType === 'customer') {
                alert(`Your support request ${ticketNumber} has been submitted successfully!\n\nWe'll get back to you as soon as possible.`);
                if (!isModal) {
                    showPage('myTickets');
                }
            } else {
                alert(`Ticket ${ticketNumber} created successfully!`);
                if (!isModal) {
                    showPage('tickets');
                }
            }
            
            // Reload tickets and dashboard
            await loadUserTickets();
            await loadDashboardData();
            
        } else {
            throw new Error(result.message || 'Failed to create ticket');
        }
        
    } catch (error) {
        console.error('Error creating ticket:', error);
        
        // Show user-friendly error message
        let errorMessage = 'Failed to create ticket. ';
        if (error.message.includes('fetch')) {
            errorMessage += 'Please check your internet connection and try again.';
        } else if (error.message.includes('500')) {
            errorMessage += 'Server error. Please try again later.';
        } else {
            errorMessage += error.message;
        }
        
        alert(errorMessage);
    } finally {
        // Reset button state
        const submitBtn = document.querySelector(`#${formId} .new-ticket-btn`);
        if (submitBtn) {
            submitBtn.textContent = currentUserType === 'customer' ? 'Submit Ticket' : 'Create Ticket';
            submitBtn.disabled = false;
        }
    }
}

// Enhanced ticket editing with real database
async function editTicket(ticketId) {
    if (currentUserType !== 'admin' && currentUserType !== 'staff') {
        alert('You do not have permission to edit tickets.');
        return;
    }
    
    const ticket = ticketsCache?.find(t => t.TicketID == ticketId);
    if (!ticket) {
        alert('Ticket not found.');
        return;
    }
    
    const newStatus = prompt(`Current Status: ${ticket.Status}\n\nEnter new status (Open, Pending, Resolved, Closed):`, ticket.Status);
    
    if (newStatus && ['Open', 'Pending', 'Resolved', 'Closed'].includes(newStatus)) {
        try {
            const result = await apiCall(`tickets/${ticketId}/status`, {
                method: 'PUT',
                body: {
                    newStatus: newStatus,
                    updatedBy: currentUserData.userID,
                    resolutionNotes: newStatus === 'Resolved' ? 'Ticket resolved by agent' : null
                }
            });
            
            if (result.success) {
                alert('Ticket updated successfully!');
                await loadUserTickets(); // Reload tickets
                await loadDashboardData(); // Reload dashboard stats
            } else {
                throw new Error(result.message || 'Failed to update ticket');
            }
            
        } catch (error) {
            console.error('Error updating ticket:', error);
            alert(`Failed to update ticket: ${error.message}`);
        }
    }
}

// Enhanced category dropdown population
function populateCategoryDropdowns() {
    if (!categoriesCache || categoriesCache.length === 0) {
        console.warn('No categories available to populate dropdowns');
        return;
    }
    
    const categorySelects = document.querySelectorAll('[id$="Category"]');
    console.log(`Found ${categorySelects.length} category dropdowns to populate`);
    
    categorySelects.forEach((select, index) => {
        console.log(`Populating dropdown ${index}:`, select.id);
        
        // Clear existing options
        while (select.children.length > 0) {
            select.removeChild(select.firstChild);
        }
        
        // Add categories
        categoriesCache.forEach(category => {
            const option = document.createElement('option');
            option.value = category.CategoryID;
            option.textContent = category.CategoryName;
            select.appendChild(option);
        });
        
        console.log(`Dropdown ${select.id} populated with ${select.children.length} options`);
    });
}

// Enhanced ticket table population
function populateTicketTables() {
    if (!ticketsCache) return;
    
    if (currentUserType === 'customer') {
        populateCustomerTickets();
    } else {
        populateAdminTickets();
    }
}

function populateCustomerTickets() {
    // Populate customer recent tickets table
    const tbody = document.getElementById('customerRecentTicketsTable');
    if (tbody) {
        tbody.innerHTML = '';
        ticketsCache.slice(0, 5).forEach(ticket => {
            const row = createTicketRow(ticket, true, 'customer');
            tbody.appendChild(row);
        });
    }

    // Populate my tickets table
    const myTicketsBody = document.getElementById('myTicketsTable');
    if (myTicketsBody) {
        myTicketsBody.innerHTML = '';
        ticketsCache.forEach(ticket => {
            const row = createTicketRow(ticket, true, 'customer');
            myTicketsBody.appendChild(row);
        });
    }
}

function populateAdminTickets() {
    // Populate admin priority tickets table (dashboard)
    const adminPriorityBody = document.getElementById('adminPriorityTicketsTable');
    if (adminPriorityBody) {
        adminPriorityBody.innerHTML = '';
        const priorityTickets = ticketsCache.filter(ticket => 
            ticket.Priority === 'High' || ticket.Priority === 'Critical'
        ).slice(0, 5);
        priorityTickets.forEach(ticket => {
            const row = createTicketRow(ticket, true, 'admin');
            adminPriorityBody.appendChild(row);
        });
    }

    // Populate staff urgent tickets table (staff dashboard)
    const staffUrgentBody = document.getElementById('staffUrgentTicketsTable');
    if (staffUrgentBody) {
        staffUrgentBody.innerHTML = '';
        const urgentTickets = ticketsCache.filter(ticket => 
            (ticket.Priority === 'High' || ticket.Priority === 'Critical') &&
            (ticket.Status === 'Open' || ticket.Status === 'Pending')
        ).slice(0, 5);
        urgentTickets.forEach(ticket => {
            const row = createTicketRow(ticket, true, 'staff');
            staffUrgentBody.appendChild(row);
        });
    }

    // Populate all tickets table
    const allTicketsBody = document.getElementById('allTicketsTable');
    if (allTicketsBody) {
        allTicketsBody.innerHTML = '';
        ticketsCache.forEach(ticket => {
            const row = createTicketRow(ticket, true, 'admin');
            allTicketsBody.appendChild(row);
        });
    }

    // Populate my tickets table (assigned to current user)
    const myTicketsBody = document.getElementById('myTicketsTable');
    if (myTicketsBody) {
        myTicketsBody.innerHTML = '';
        const myTickets = ticketsCache.filter(ticket => 
            ticket.AssignedToName && ticket.AssignedToName.includes(currentUser.split(' ')[0])
        );
        myTickets.forEach(ticket => {
            const row = createTicketRow(ticket, true, 'admin');
            myTicketsBody.appendChild(row);
        });
    }
}

// Enhanced ticket row creation
function createTicketRow(ticket, includeActions, userType) {
    console.log('=== CREATING TICKET ROW ===');
    console.log('Ticket data:', ticket);
    console.log('User type:', userType);
    console.log('Include actions:', includeActions);
    
    const row = document.createElement('tr');
    
    const statusClass = `status-${ticket.Status.toLowerCase()}`;
    const priorityClass = `priority-${ticket.Priority.toLowerCase()}`;
    
    console.log('Status class:', statusClass);
    console.log('Priority class:', priorityClass);
    
    let actionsHtml = '';
    if (includeActions) {
        if (userType === 'admin' || userType === 'staff') {
            actionsHtml = `<td>
                <button class="action-btn" onclick="viewTicket(${ticket.TicketID})">View</button>
                <button class="action-btn secondary" onclick="editTicket(${ticket.TicketID})">Edit</button>
            </td>`;
        } else {
            // For customers, show delete button only for non-resolved/non-closed tickets
            const canDelete = ticket.Status !== 'Resolved' && ticket.Status !== 'Closed';
            const deleteButton = canDelete ? 
                `<button class="action-btn" style="background: #ff6b6b; color: white;" onclick="deleteTicket(${ticket.TicketID})">Delete</button>` : '';
            
            actionsHtml = `<td>
                <button class="action-btn" onclick="viewTicket(${ticket.TicketID})">View</button>
                <button class="action-btn secondary" onclick="addReply(${ticket.TicketID})">Reply</button>
                ${deleteButton}
            </td>`;
        }
    }

    // Check if we're in the "All Tickets" page (which has Assigned To column)
    const isAllTicketsPage = document.getElementById('ticketsPage') && !document.getElementById('ticketsPage').classList.contains('hidden');
    
    console.log('Is All Tickets page:', isAllTicketsPage);
    
    if (userType === 'admin' || userType === 'staff') {
        if (isAllTicketsPage) {
            // All Tickets page layout (includes Assigned To column)
            row.innerHTML = `
                <td><strong>${ticket.TicketNumber || `TKT-${String(ticket.TicketID).padStart(6, '0')}`}</strong></td>
                <td>${ticket.Subject}</td>
                <td>${ticket.CustomerName || ticket.CustomerEmail || 'Unknown'}</td>
                <td><span class="${priorityClass}">${ticket.Priority}</span></td>
                <td><span class="status-badge ${statusClass}">${ticket.Status}</span></td>
                <td>${ticket.AssignedToName || 'Unassigned'}</td>
                <td>${formatDate(ticket.CreatedDate)}</td>
                ${actionsHtml}
            `;
        } else {
            // My Tickets page layout - MUST MATCH HTML HEADERS EXACTLY:
            // Ticket # | Subject | Priority | Status | Actions
            row.innerHTML = `
                <td><strong>${ticket.TicketNumber || `TKT-${String(ticket.TicketID).padStart(6, '0')}`}</strong></td>
                <td>${ticket.Subject}</td>
                <td><span class="${priorityClass}">${ticket.Priority}</span></td>
                <td><span class="status-badge ${statusClass}">${ticket.Status}</span></td>
                ${actionsHtml}
            `;
        }
    } else {
        // Customer view - simplified columns - MUST MATCH HTML HEADERS EXACTLY:
        // Ticket # | Subject | Priority | Status | Last Update | Actions
        row.innerHTML = `
            <td><strong>${ticket.TicketNumber || `TKT-${String(ticket.TicketID).padStart(6, '0')}`}</strong></td>
            <td>${ticket.Subject}</td>
            <td><span class="${priorityClass}">${ticket.Priority}</span></td>
            <td><span class="status-badge ${statusClass}">${ticket.Status}</span></td>
            <td>${formatDate(ticket.UpdatedDate || ticket.CreatedDate)}</td>
            ${actionsHtml}
        `;
    }
    
    console.log('Row HTML created:', row.innerHTML);
    return row;
}

// Helper function to format dates
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    } catch (error) {
        return dateString;
    }
}

// Show/Hide pages
function showSignUp() {
    document.getElementById('loginPage').classList.add('hidden');
    document.getElementById('signupPage').classList.remove('hidden');
}

function showLogin() {
    document.getElementById('signupPage').classList.add('hidden');
    document.getElementById('loginPage').classList.remove('hidden');
}

function showMainApp() {
    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('signupPage').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
    document.getElementById('currentUser').textContent = currentUser;
    document.getElementById('userAvatar').textContent = currentUser.charAt(0);
}

// Enhanced logout functionality
function logout() {
    // Clear authentication data
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    currentUser = null;
    currentUserData = null;
    currentUserType = '';
    authToken = null;
    ticketsCache = null;
    categoriesCache = null;
    
    // Reset UI
    document.getElementById('mainApp').style.display = 'none';
    document.getElementById('loginPage').style.display = 'block';
    document.getElementById('signupPage').style.display = 'none';
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    document.body.className = '';
}

// Navigation functionality
function showPage(pageId) {
    console.log('Showing page:', pageId);
    
    // Hide all pages
    const pages = ['dashboardPage', 'customerDashboardPage', 'staffDashboardPage', 'ticketsPage', 'myTicketsPage', 'newTicketPage', 'knowledgeBasePage', 'profilePage', 'customersPage', 'reportsPage', 'settingsPage'];
    pages.forEach(page => {
        const element = document.getElementById(page);
        if (element) {
            element.classList.add('hidden');
        }
    });

    // Remove active class from all nav items
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });

    // Show selected page
    const targetPage = document.getElementById(pageId + 'Page');
    if (targetPage) {
        targetPage.classList.remove('hidden');
        console.log('Page shown:', pageId);
        
        // Set up form event listeners when showing new ticket page
        if (pageId === 'newTicket') {
            console.log('Setting up new ticket form for page:', pageId);
            setupNewTicketForm();
        }
        
        // Populate profile form when showing profile page
        if (pageId === 'profile') {
            console.log('Populating profile form for page:', pageId);
            populateProfileForm();
            setupProfileForm();
        }
    } else {
        console.error('Page not found:', pageId + 'Page');
    }
    
    currentPage = pageId;

    // Refresh data when viewing tickets
    if (pageId === 'tickets' || pageId === 'myTickets' || pageId === 'dashboard' || pageId === 'customerDashboard') {
        if (currentUserData) {
            loadUserTickets();
        }
    }
}

// Handle navigation clicks
function handleNavigation(pageId, element) {
    console.log('Navigation clicked:', pageId);
    
    // Remove active class from all nav items
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Add active class to clicked item
    if (element) {
        element.classList.add('active');
    }
    
    // Show the page
    showPage(pageId);
}

// Ticket actions (enhanced)
function viewTicket(ticketId) {
    const ticket = ticketsCache?.find(t => t.TicketID == ticketId);
    if (ticket) {
        if (currentUserType === 'customer') {
            alert(`Ticket Details: ${ticket.TicketNumber}\n\nSubject: ${ticket.Subject}\nStatus: ${ticket.Status}\nPriority: ${ticket.Priority}\nSubmitted: ${formatDate(ticket.CreatedDate)}\n\nOur support team is working on your request. You'll receive updates via email.`);
        } else {
            alert(`Viewing Ticket: ${ticket.TicketNumber}\n\nSubject: ${ticket.Subject}\nCustomer: ${ticket.CustomerName || ticket.CustomerEmail}\nStatus: ${ticket.Status}\nPriority: ${ticket.Priority}\nAssigned to: ${ticket.AssignedToName || 'Unassigned'}\nCreated: ${formatDate(ticket.CreatedDate)}\nCategory: ${ticket.CategoryName}`);
        }
    }
}

// Enhanced reply functionality with database integration
async function addReply(ticketId) {
    const ticket = ticketsCache?.find(t => t.TicketID == ticketId);
    if (ticket) {
        const reply = prompt(`Add a reply to ticket ${ticket.TicketNumber}:\n\nSubject: ${ticket.Subject}`, '');
        if (reply && reply.trim()) {
            try {
                console.log(`Adding reply to ticket ${ticketId}:`, reply);
                
                // Call the API to save the comment
                const result = await apiCall(`tickets/${ticketId}/comments`, {
                    method: 'POST',
                    body: {
                        comment: reply,
                        userID: currentUserData?.userID || 1,
                        isInternal: false,
                        isResolution: false
                    }
                });
                
                if (result.success) {
                    alert(`Reply added to ticket ${ticket.TicketNumber} successfully!`);
                    
                    // Reload tickets to show updated information
                    await loadUserTickets();
                    
                    console.log('Comment added successfully:', result.comment);
                } else {
                    throw new Error(result.message || 'Failed to add reply');
                }
                
            } catch (error) {
                console.error('Error adding reply:', error);
                alert(`Failed to add reply: ${error.message}`);
            }
        }
    }
}

// Enhanced ticket deletion functionality with database integration
async function deleteTicket(ticketId) {
    const ticket = ticketsCache?.find(t => t.TicketID == ticketId);
    if (ticket) {
        // Show confirmation dialog
        const confirmDelete = confirm(`Are you sure you want to delete ticket ${ticket.TicketNumber}?\n\nSubject: ${ticket.Subject}\n\nThis action cannot be undone.`);
        
        if (confirmDelete) {
            try {
                console.log(`Deleting ticket ${ticketId}:`, ticket);
                
                // Call the API to delete the ticket
                const result = await apiCall(`tickets/${ticketId}`, {
                    method: 'DELETE',
                    body: {
                        userID: currentUserData?.userID || 1,
                        userRole: currentUserData?.role || 'Customer'
                    }
                });
                
                if (result.success) {
                    alert(`Ticket ${ticket.TicketNumber} deleted successfully!`);
                    
                    // Reload tickets to show updated information
                    await loadUserTickets();
                    await loadDashboardData();
                    
                    console.log('Ticket deleted successfully');
                } else {
                    throw new Error(result.message || 'Failed to delete ticket');
                }
                
            } catch (error) {
                console.error('Error deleting ticket:', error);
                alert(`Failed to delete ticket: ${error.message}`);
            }
        }
    }
}

// Knowledge Base functions (enhanced)
async function showArticle(articleId) {
    try {
        // Simple client-side articles for demo
        const articles = {
            'login-issues': 'Login Issues Help\n\n1. Clear your browser cache\n2. Try incognito/private mode\n3. Check your credentials\n4. Reset your password if needed',
            'password-reset': 'Password Reset Guide\n\n1. Click "Forgot Password" on login page\n2. Enter your email address\n3. Check your email for reset link\n4. Follow the instructions in the email',
            'browser-compatibility': 'Browser Compatibility\n\nSupported browsers:\n- Chrome 90+\n- Firefox 88+\n- Safari 14+\n- Edge 90+',
            'mobile-app': 'Mobile App Troubleshooting\n\n1. Update to latest version\n2. Restart the app\n3. Check internet connection\n4. Clear app cache'
        };
        
        const content = articles[articleId] || 'Article content would be displayed here.';
        alert(content);
        
    } catch (error) {
        console.error('Error loading article:', error);
        alert('Failed to load article content.');
    }
}

// Customer management functions (Admin only)
function viewCustomer(customerId) {
    alert(`Viewing customer details for ${customerId}\n\nThis would show complete customer information, ticket history, and account details.`);
}

function editCustomer(customerId) {
    alert(`Editing customer ${customerId}\n\nThis would open a form to edit customer information.`);
}

function openNewCustomerModal() {
    alert('Add New Customer form would open here.\n\nThis would include fields for:\n- Name\n- Email\n- Company\n- Phone\n- Account type');
}

// Modal functionality
function openNewTicketModal() {
    document.getElementById('newTicketModal').style.display = 'block';
    setTimeout(() => {
        document.getElementById('newTicketModal').classList.add('show');
    }, 10);
}

function closeNewTicketModal() {
    document.getElementById('newTicketModal').classList.remove('show');
    setTimeout(() => {
        document.getElementById('newTicketModal').style.display = 'none';
    }, 300);
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('newTicketModal');
    if (event.target === modal) {
        closeNewTicketModal();
    }
}

// Terms and Privacy functions
function showTerms() {
    alert(`Terms of Service\n\n1. Account Usage: You agree to use this ticketing system responsibly and in accordance with applicable laws.\n\n2. Data Privacy: We protect your personal information and use it only for support purposes.\n\n3. Service Availability: We strive for 99.9% uptime but cannot guarantee uninterrupted service.\n\n4. User Conduct: Harassment, spam, or misuse of the system is prohibited.\n\n5. Account Termination: We reserve the right to suspend accounts that violate these terms.\n\nFor complete terms, visit our website.`);
}

function showPrivacy() {
    alert(`Privacy Policy Summary\n\n• We collect only necessary information to provide support\n• Your data is encrypted and stored securely\n• We never sell or share your personal information\n• You can request data deletion at any time\n• Cookies are used only for session management\n• We comply with GDPR and other privacy regulations\n\nFor our complete privacy policy, visit our website.`);
}

// Utility functions
function refreshMyTickets() {
    if (currentUserData) {
        loadUserTickets();
    }
}

// Password strength checker
function checkPasswordStrength(password) {
    const strengthIndicator = document.getElementById('passwordStrength') || createPasswordStrengthIndicator();
    
    let strength = 0;
    let feedback = [];
    
    if (password.length >= 6) strength += 1;
    else feedback.push('At least 6 characters');
    
    if (password.match(/[a-z]/)) strength += 1;
    else feedback.push('Lowercase letter');
    
    if (password.match(/[A-Z]/)) strength += 1;
    else feedback.push('Uppercase letter');
    
    if (password.match(/[0-9]/)) strength += 1;
    else feedback.push('Number');
    
    if (password.match(/[^a-zA-Z0-9]/)) strength += 1;
    else feedback.push('Special character');
    
    // Update strength indicator
    if (strength < 2) {
        strengthIndicator.className = 'password-strength password-weak';
        strengthIndicator.textContent = 'Weak password. Add: ' + feedback.slice(0, 2).join(', ');
    } else if (strength < 4) {
        strengthIndicator.className = 'password-strength password-medium';
        strengthIndicator.textContent = 'Medium strength. Consider adding: ' + feedback.slice(0, 1).join(', ');
    } else {
        strengthIndicator.className = 'password-strength password-strong';
        strengthIndicator.textContent = 'Strong password!';
    }
}

function createPasswordStrengthIndicator() {
    const indicator = document.createElement('div');
    indicator.id = 'passwordStrength';
    indicator.className = 'password-strength';
    const passwordField = document.getElementById('signupPassword');
    if (passwordField && passwordField.parentNode) {
        passwordField.parentNode.appendChild(indicator);
    }
    return indicator;
}

// Fixed event listener setup for new ticket form
function setupNewTicketForm() {
    console.log('Setting up new ticket form...');
    
    const newTicketForm = document.getElementById('newTicketForm');
    if (newTicketForm) {
        console.log('Found newTicketForm, attaching event listener...');
        
        // Remove any existing event listeners by removing and re-adding the listener
        newTicketForm.removeEventListener('submit', handleFormSubmit);
        
        // Add new event listener
        newTicketForm.addEventListener('submit', handleFormSubmit);
        
        console.log('New ticket form event listener added successfully');
    } else {
        console.error('New ticket form not found');
    }

    const modalTicketForm = document.getElementById('modalTicketForm');
    if (modalTicketForm) {
        console.log('Found modalTicketForm, attaching event listener...');
        
        // Remove any existing event listeners
        modalTicketForm.removeEventListener('submit', handleModalFormSubmit);
        
        // Add new event listener
        modalTicketForm.addEventListener('submit', handleModalFormSubmit);
        
        console.log('Modal ticket form event listener added successfully');
    }
}

// Separate handler functions for better debugging
function handleFormSubmit(e) {
    console.log('Form submit event triggered!');
    e.preventDefault();
    createNewTicket('newTicketForm');
}

function handleModalFormSubmit(e) {
    console.log('Modal form submit event triggered!');
    e.preventDefault();
    createNewTicket('modalTicketForm');
    closeNewTicketModal();
}

// Enhanced profile update functionality with database integration
async function handleProfileUpdate(e) {
    console.log('=== PROFILE UPDATE FUNCTION CALLED ===');
    console.log('Event:', e);
    console.log('Current user data:', currentUserData);
    
    e.preventDefault();
    
    if (!currentUserData) {
        alert('Please log in to update your profile.');
        return;
    }
    
    try {
        // Get form data
        const firstName = document.getElementById('profileName')?.value?.split(' ')[0] || '';
        const lastName = document.getElementById('profileName')?.value?.split(' ').slice(1).join(' ') || '';
        const email = document.getElementById('profileEmail')?.value || '';
        const phone = document.getElementById('profilePhone')?.value || '';
        const company = document.getElementById('profileCompany')?.value || '';
        const emailNotifications = document.getElementById('emailNotifications')?.checked || false;
        const marketingEmails = document.getElementById('marketingEmails')?.checked || false;
        
        // Validate required fields
        if (!firstName || !lastName || !email) {
            alert('Please fill in all required fields (Name and Email).');
            return;
        }
        
        console.log('Updating profile for user:', currentUserData.userID);
        
        // Show loading state
        const submitBtn = document.querySelector('#profileForm .new-ticket-btn');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Updating...';
        submitBtn.disabled = true;
        
        // Call API to update profile
        const result = await apiCall('users/profile', {
            method: 'PUT',
            body: {
                userID: currentUserData.userID,
                firstName: firstName,
                lastName: lastName,
                email: email,
                phone: phone,
                company: company,
                emailNotifications: emailNotifications,
                marketingEmails: marketingEmails
            }
        });
        
        if (result.success) {
            // Update local user data
            currentUserData = {
                ...currentUserData,
                firstName: result.user.FirstName,
                lastName: result.user.LastName,
                email: result.user.Email,
                company: result.user.Company,
                phone: result.user.Phone
            };
            
            // Update localStorage
            localStorage.setItem('currentUser', JSON.stringify(currentUserData));
            
            // Update UI
            currentUser = `${currentUserData.firstName} ${currentUserData.lastName}`;
            document.getElementById('currentUser').textContent = currentUser;
            document.getElementById('userAvatar').textContent = currentUser.charAt(0);
            
            alert('Profile updated successfully!');
            
            console.log('Profile updated successfully:', result.user);
        } else {
            throw new Error(result.message || 'Failed to update profile');
        }
        
    } catch (error) {
        console.error('Error updating profile:', error);
        alert(`Failed to update profile: ${error.message}`);
    } finally {
        // Reset button state
        const submitBtn = document.querySelector('#profileForm .new-ticket-btn');
        if (submitBtn) {
            submitBtn.textContent = 'Update Profile';
            submitBtn.disabled = false;
        }
    }
}

// Populate profile form with current user data
function populateProfileForm() {
    if (!currentUserData) return;
    
    const profileName = document.getElementById('profileName');
    const profileEmail = document.getElementById('profileEmail');
    const profilePhone = document.getElementById('profilePhone');
    const profileCompany = document.getElementById('profileCompany');
    const emailNotifications = document.getElementById('emailNotifications');
    const marketingEmails = document.getElementById('marketingEmails');
    
    if (profileName) {
        profileName.value = `${currentUserData.firstName} ${currentUserData.lastName}`;
    }
    if (profileEmail) {
        profileEmail.value = currentUserData.email || '';
    }
    if (profilePhone) {
        profilePhone.value = currentUserData.phone || '';
    }
    if (profileCompany) {
        profileCompany.value = currentUserData.company || '';
    }
    if (emailNotifications) {
        emailNotifications.checked = currentUserData.emailNotifications !== false;
    }
    if (marketingEmails) {
        marketingEmails.checked = currentUserData.marketingEmails === true;
    }
    
    console.log('Profile form populated with user data:', currentUserData);
}

// Setup profile form event listener
function setupProfileForm() {
    console.log('Setting up profile form...');
    
    const profileForm = document.getElementById('profileForm');
    if (profileForm) {
        console.log('Found profileForm, attaching event listener...');
        
        // Remove any existing event listeners by removing and re-adding the listener
        profileForm.removeEventListener('submit', handleProfileUpdate);
        
        // Add new event listener
        profileForm.addEventListener('submit', handleProfileUpdate);
        
        console.log('Profile form event listener added successfully');
    } else {
        console.error('Profile form not found');
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing with database connection...');
    
    // Check for existing authentication
    const savedToken = localStorage.getItem('authToken');
    const savedUser = localStorage.getItem('currentUser');
    
    if (savedToken && savedUser) {
        try {
            authToken = savedToken;
            currentUserData = JSON.parse(savedUser);
            currentUser = `${currentUserData.firstName} ${currentUserData.lastName}`;
            currentUserType = currentUserData.role.toLowerCase();
            
            // Auto-login with saved credentials
            document.body.className = `user-${currentUserType}`;
            document.getElementById('userRole').textContent = currentUserData.role;
            showMainApp();
            
            if (currentUserType === 'customer') {
                showPage('customerDashboard');
            } else {
                showPage('dashboard');
            }
            
            loadDashboardData();
            
            console.log('Auto-logged in with saved credentials');
        } catch (error) {
            console.error('Error with saved credentials:', error);
            localStorage.removeItem('authToken');
            localStorage.removeItem('currentUser');
        }
    } else {
        // Set focus on username field
        const usernameField = document.getElementById('username');
        if (usernameField) {
            usernameField.focus();
        }
    }
    
    // Initialize with admin view selected
    selectUserType('admin');
    
    // Add event listeners with proper error handling
    setupEventListeners();
    
    console.log('Initialization complete with database connection');
});

// Setup all event listeners
function setupEventListeners() {
    // Login form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    // Signup form
    const signupForm = document.getElementById('signupForm');
    if (signupForm) {
        signupForm.addEventListener('submit', handleSignUp);
    }

    // Profile form
    const profileForm = document.getElementById('profileForm');
    if (profileForm) {
        profileForm.addEventListener('submit', handleProfileUpdate);
    }

    // Knowledge base search
    const kbSearchBox = document.getElementById('kbSearchBox');
    if (kbSearchBox) {
        kbSearchBox.addEventListener('input', async function(e) {
            const query = e.target.value.toLowerCase();
            
            // Simple client-side search for demo
            const articles = document.querySelectorAll('.kb-articles li');
            articles.forEach(article => {
                const text = article.textContent.toLowerCase();
                if (text.includes(query) || query === '') {
                    article.style.display = 'block';
                } else {
                    article.style.display = 'none';
                }
            });
            
            // In production, you could also search the database
            if (query.length > 2) {
                try {
                    const result = await apiCall(`knowledge-base/search?searchTerm=${encodeURIComponent(query)}`);
                    if (result.success) {
                        console.log('Knowledge base search results:', result.articles);
                        // Update UI with search results
                    }
                } catch (error) {
                    console.error('Knowledge base search error:', error);
                }
            }
        });
    }

    // Password strength checker for signup
    const signupPassword = document.getElementById('signupPassword');
    if (signupPassword) {
        signupPassword.addEventListener('input', function(e) {
            checkPasswordStrength(e.target.value);
        });
    }
}

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
    // Alt + N for new ticket
    if (e.altKey && e.key === 'n') {
        e.preventDefault();
        if (document.getElementById('mainApp').style.display !== 'none') {
            if (currentUserType === 'admin' || currentUserType === 'staff') {
                openNewTicketModal();
            } else {
                handleNavigation('newTicket', null);
            }
        }
    }
    
    // Alt + D for dashboard
    if (e.altKey && e.key === 'd') {
        e.preventDefault();
        if (document.getElementById('mainApp').style.display !== 'none') {
            if (currentUserType === 'customer') {
                handleNavigation('customerDashboard', null);
            } else {
                handleNavigation('dashboard', null);
            }
        }
    }
    
    // Alt + M for my tickets
    if (e.altKey && e.key === 'm') {
        e.preventDefault();
        if (document.getElementById('mainApp').style.display !== 'none') {
            handleNavigation('myTickets', null);
        }
    }
    
    // Escape to close modal
    if (e.key === 'Escape') {
        closeNewTicketModal();
    }
});

// Auto-refresh functionality (every 30 seconds)
setInterval(async function() {
    if (document.getElementById('mainApp').style.display !== 'none' && currentUserData) {
        try {
            // Refresh dashboard stats
            await loadDashboardData();
            
        } catch (error) {
            console.error('Auto-refresh error:', error);
        }
    }
}, 30000);

// Global error handler
window.addEventListener('error', function(e) {
    console.error('Global error:', e.error);
});

// Unhandled promise rejection handler
window.addEventListener('unhandledrejection', function(e) {
    console.error('Unhandled promise rejection:', e.reason);
    e.preventDefault();
});

console.log('HelpDesk Pro with Real Database Connection loaded successfully!');

// Test function to debug submit button
function testSubmitButton() {
    console.log('=== TESTING SUBMIT BUTTON ===');
    console.log('Current page:', currentPage);
    console.log('Current user type:', currentUserType);
    console.log('Current user data:', currentUserData);
    
    const form = document.getElementById('newTicketForm');
    console.log('Form found:', !!form);
    
    if (form) {
        console.log('Form elements:');
        console.log('- Subject:', document.getElementById('ticketSubject')?.value);
        console.log('- Priority:', document.getElementById('ticketPriority')?.value);
        console.log('- Category:', document.getElementById('ticketCategory')?.value);
        console.log('- Description:', document.getElementById('ticketDescription')?.value);
        
        // Test form submission
        console.log('Testing form submission...');
        createNewTicket('newTicketForm');
    } else {
        console.error('Form not found!');
    }
}

// Make it available globally for testing
window.testSubmitButton = testSubmitButton;
window.createNewTicket = createNewTicket;
window.handleFormSubmit = handleFormSubmit;
window.handleModalFormSubmit = handleModalFormSubmit;
window.handleProfileUpdate = handleProfileUpdate;

// Test if functions are available globally
console.log('=== GLOBAL FUNCTION TEST ===');
console.log('createNewTicket available:', typeof createNewTicket);
console.log('testSubmitButton available:', typeof testSubmitButton);
console.log('handleFormSubmit available:', typeof handleFormSubmit);

// Add a simple global test function
window.simpleTest = function() {
    console.log('Simple test function works!');
    alert('Simple test function works!');
};

// Add a direct test for createNewTicket
window.testCreateTicket = function() {
    console.log('Testing createNewTicket function directly...');
    if (typeof createNewTicket === 'function') {
        console.log('createNewTicket function is available!');
        createNewTicket('newTicketForm');
    } else {
        console.error('createNewTicket function is NOT available!');
        alert('createNewTicket function is not available!');
    }
};

// Simple error handling
window.addEventListener('error', function(e) {
    console.error('JavaScript error:', e.error);
});

console.log('Script loaded successfully!');