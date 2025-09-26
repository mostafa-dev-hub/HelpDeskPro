
const express = require('express');
const sql = require('mssql');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.')); // Serve static files from current directory

// Database configuration - Updated for your SQL Server Authentication
const dbConfig = {
    server: '127.0.0.1', // Your server name from SSMS
    database: 'HelpDeskPro',
    user: 'sa', // Your username from SSMS
    password: 'Root123$', // Replace with your actual password
    port: 1433,
    options: {
        enableArithAbort: true,
        encrypt: true, // Set to true since you have "Mandatory" encryption
        trustServerCertificate: true // Since you have "Trust Server Certificate" checked
    }
};

// Alternative: You can also use environment variables for security
// const dbConfig = {
//     server: process.env.DB_SERVER || 'MSI',
//     database: process.env.DB_DATABASE || 'HelpDeskPro',
//     user: process.env.DB_USER || 'sa',
//     password: process.env.DB_PASSWORD || 'your_password',
//     options: {
//         enableArithAbort: true,
//         encrypt: true,
//         trustServerCertificate: true
//     }
// };

// Login endpoint
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ success: false, message: 'Username and password required' });
        }
        
        const pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .input('Username', sql.NVarChar, username)
            .input('Password', sql.NVarChar, password)
            .execute('sp_AuthenticateUser');
        
        if (result.recordset.length > 0 && result.recordset[0].UserID) {
            const user = result.recordset[0];
            
            // Simple token (in production, use JWT)
            const token = Buffer.from(`${user.UserID}:${Date.now()}`).toString('base64');
            
            res.json({
                success: true,
                token,
                user: {
                    userID: user.UserID,
                    username: user.Username,
                    email: user.Email,
                    firstName: user.FirstName,
                    lastName: user.LastName,
                    role: user.UserRole,
                    company: user.Company,
                    phone: user.Phone
                }
            });
        } else {
            res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
        
        await pool.close();
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Register endpoint
app.post('/api/users/register', async (req, res) => {
    try {
        const { username, password, email, firstName, lastName, company, phone } = req.body;
        
        if (!username || !password || !email || !firstName || !lastName) {
            return res.status(400).json({ success: false, message: 'Required fields missing' });
        }
        
        const pool = await sql.connect(dbConfig);
        
        // Check if user exists
        const checkUser = await pool.request()
            .input('Username', sql.NVarChar, username)
            .input('Email', sql.NVarChar, email)
            .query('SELECT UserID FROM Users WHERE Username = @Username OR Email = @Email');
        
        if (checkUser.recordset.length > 0) {
            await pool.close();
            return res.status(400).json({ success: false, message: 'Username or email already exists' });
        }
        
        // Create new user
        const result = await pool.request()
            .input('Username', sql.NVarChar, username)
            .input('PasswordHash', sql.NVarChar, password)
            .input('Email', sql.NVarChar, email)
            .input('FirstName', sql.NVarChar, firstName)
            .input('LastName', sql.NVarChar, lastName)
            .input('Company', sql.NVarChar, company || null)
            .input('Phone', sql.NVarChar, phone || null)
            .query(`
                INSERT INTO Users (Username, PasswordHash, Email, FirstName, LastName, Company, Phone, UserRole)
                OUTPUT INSERTED.UserID, INSERTED.Username, INSERTED.Email
                VALUES (@Username, @PasswordHash, @Email, @FirstName, @LastName, @Company, @Phone, 'Customer')
            `);
        
        const newUser = result.recordset[0];
        res.json({
            success: true,
            message: 'Account created successfully',
            user: newUser
        });
        
        await pool.close();
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Create ticket endpoint
app.post('/api/tickets/create', async (req, res) => {
    try {
        const { subject, description, categoryID, priority, customerID } = req.body;
        
        if (!subject || !description) {
            return res.status(400).json({ success: false, message: 'Subject and description required' });
        }
        
        // Generate random assignment to user ID 2, 3, or 4
        const randomAssignedToID = Math.floor(Math.random() * 3) + 2; // Random number between 2 and 4
        
        console.log(`Assigning ticket to user ID: ${randomAssignedToID}`);
        
        const pool = await sql.connect(dbConfig);
        
        try {
            // Try with AssignedToID parameter first
            const result = await pool.request()
                .input('Subject', sql.NVarChar, subject)
                .input('Description', sql.NVarChar, description)
                .input('CustomerID', sql.Int, customerID || 1)
                .input('CategoryID', sql.Int, categoryID || 1)
                .input('Priority', sql.NVarChar, priority || 'Medium')
                .input('AssignedToID', sql.Int, randomAssignedToID)
                .execute('sp_CreateTicket');
            
            const newTicket = result.recordset[0];
            
            // If the stored procedure doesn't support AssignedToID, update it separately
            if (newTicket && !newTicket.AssignedToID) {
                console.log('Updating ticket assignment separately...');
                await pool.request()
                    .input('TicketID', sql.Int, newTicket.TicketID)
                    .input('AssignedToID', sql.Int, randomAssignedToID)
                    .query('UPDATE Tickets SET AssignedToID = @AssignedToID WHERE TicketID = @TicketID');
                
                // Update the returned ticket object
                newTicket.AssignedToID = randomAssignedToID;
            }
            
            res.json({ 
                success: true, 
                message: 'Ticket created successfully',
                ticket: newTicket 
            });
            
        } catch (spError) {
            console.log('Stored procedure error, trying without AssignedToID parameter...');
            
            // Fallback: Create ticket without AssignedToID, then update it
            const result = await pool.request()
                .input('Subject', sql.NVarChar, subject)
                .input('Description', sql.NVarChar, description)
                .input('CustomerID', sql.Int, customerID || 1)
                .input('CategoryID', sql.Int, categoryID || 1)
                .input('Priority', sql.NVarChar, priority || 'Medium')
                .execute('sp_CreateTicket');
            
            const newTicket = result.recordset[0];
            
            // Update the ticket with assignment
            await pool.request()
                .input('TicketID', sql.Int, newTicket.TicketID)
                .input('AssignedToID', sql.Int, randomAssignedToID)
                .query('UPDATE Tickets SET AssignedToID = @AssignedToID WHERE TicketID = @TicketID');
            
            // Update the returned ticket object
            newTicket.AssignedToID = randomAssignedToID;
            
            res.json({ 
                success: true, 
                message: 'Ticket created successfully',
                ticket: newTicket 
            });
        }
        
        await pool.close();
    } catch (error) {
        console.error('Create ticket error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get user tickets endpoint
app.get('/api/tickets/user', async (req, res) => {
    try {
        const { userID, userRole, status, pageSize = 20, pageNumber = 1 } = req.query;
        
        const pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .input('UserID', sql.Int, userID || 1)
            .input('UserRole', sql.NVarChar, userRole || 'Customer')
            .input('Status', sql.NVarChar, status || null)
            .input('PageSize', sql.Int, pageSize)
            .input('PageNumber', sql.Int, pageNumber)
            .execute('sp_GetUserTickets');
        
        res.json({ 
            success: true, 
            tickets: result.recordset 
        });
        
        await pool.close();
    } catch (error) {
        console.error('Get tickets error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Update ticket status endpoint
app.put('/api/tickets/:ticketID/status', async (req, res) => {
    try {
        const { ticketID } = req.params;
        const { newStatus, updatedBy, resolutionNotes } = req.body;
        
        if (!newStatus) {
            return res.status(400).json({ success: false, message: 'New status required' });
        }
        
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('TicketID', sql.Int, ticketID)
            .input('NewStatus', sql.NVarChar, newStatus)
            .input('UpdatedBy', sql.Int, updatedBy || 1)
            .input('ResolutionNotes', sql.NVarChar, resolutionNotes || null)
            .execute('sp_UpdateTicketStatus');
        
        res.json({ 
            success: true, 
            message: 'Ticket updated successfully' 
        });
        
        await pool.close();
    } catch (error) {
        console.error('Update ticket error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Add comment/reply endpoint
app.post('/api/tickets/:ticketID/comments', async (req, res) => {
    try {
        const { ticketID } = req.params;
        const { comment, userID, isInternal = false, isResolution = false } = req.body;
        
        if (!comment || !userID) {
            return res.status(400).json({ success: false, message: 'Comment and userID required' });
        }
        
        console.log(`Adding comment to ticket ${ticketID} by user ${userID}`);
        
        const pool = await sql.connect(dbConfig);
        
        // Insert the comment
        const result = await pool.request()
            .input('TicketID', sql.Int, ticketID)
            .input('UserID', sql.Int, userID)
            .input('Comment', sql.NVarChar, comment)
            .input('IsInternal', sql.Bit, isInternal)
            .input('IsResolution', sql.Bit, isResolution)
            .query(`
                INSERT INTO TicketComments (TicketID, UserID, Comment, IsInternal, IsResolution, CreatedDate, UpdatedDate)
                OUTPUT INSERTED.CommentID, INSERTED.CreatedDate
                VALUES (@TicketID, @UserID, @Comment, @IsInternal, @IsResolution, GETDATE(), GETDATE())
            `);
        
        const newComment = result.recordset[0];
        
        // Update the ticket's UpdatedDate
        await pool.request()
            .input('TicketID', sql.Int, ticketID)
            .query('UPDATE Tickets SET UpdatedDate = GETDATE() WHERE TicketID = @TicketID');
        
        res.json({ 
            success: true, 
            message: 'Comment added successfully',
            comment: newComment
        });
        
        await pool.close();
    } catch (error) {
        console.error('Add comment error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Update user profile endpoint
app.put('/api/users/profile', async (req, res) => {
    try {
        const { userID, firstName, lastName, email, phone, company, emailNotifications, marketingEmails } = req.body;
        
        if (!userID || !firstName || !lastName || !email) {
            return res.status(400).json({ success: false, message: 'Required fields missing' });
        }
        
        console.log(`Updating profile for user ${userID}`);
        
        const pool = await sql.connect(dbConfig);
        
        // Update the user profile
        const result = await pool.request()
            .input('UserID', sql.Int, userID)
            .input('FirstName', sql.NVarChar, firstName)
            .input('LastName', sql.NVarChar, lastName)
            .input('Email', sql.NVarChar, email)
            .input('Phone', sql.NVarChar, phone || null)
            .input('Company', sql.NVarChar, company || null)
            .input('EmailNotifications', sql.Bit, emailNotifications ? 1 : 0)
            .query(`
                UPDATE Users 
                SET FirstName = @FirstName,
                    LastName = @LastName,
                    Email = @Email,
                    Phone = @Phone,
                    Company = @Company,
                    EmailNotifications = @EmailNotifications
                WHERE UserID = @UserID
            `);
        
        // Get the updated user data
        const updatedUser = await pool.request()
            .input('UserID', sql.Int, userID)
            .query(`
                SELECT UserID, Username, Email, FirstName, LastName, Company, Phone, UserRole, EmailNotifications
                FROM Users 
                WHERE UserID = @UserID
            `);
        
        res.json({ 
            success: true, 
            message: 'Profile updated successfully',
            user: updatedUser.recordset[0]
        });
        
        await pool.close();
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Delete ticket endpoint
app.delete('/api/tickets/:ticketID', async (req, res) => {
    try {
        const { ticketID } = req.params;
        const { userID, userRole } = req.body;
        
        if (!userID) {
            return res.status(400).json({ success: false, message: 'User ID required' });
        }
        
        console.log(`Attempting to delete ticket ${ticketID} by user ${userID} (${userRole})`);
        
        const pool = await sql.connect(dbConfig);
        
        // First, check if the ticket exists and get its details
        const ticketCheck = await pool.request()
            .input('TicketID', sql.Int, ticketID)
            .query('SELECT TicketID, CustomerID, Status FROM Tickets WHERE TicketID = @TicketID');
        
        if (ticketCheck.recordset.length === 0) {
            await pool.close();
            return res.status(404).json({ success: false, message: 'Ticket not found' });
        }
        
        const ticket = ticketCheck.recordset[0];
        
        // Security check: Only allow deletion if:
        // 1. User is admin/staff, OR
        // 2. User is the customer who created the ticket AND ticket is not resolved/closed
        const canDelete = (userRole === 'Admin' || userRole === 'Staff') || 
                         (userRole === 'Customer' && ticket.CustomerID == userID && 
                          ticket.Status !== 'Resolved' && ticket.Status !== 'Closed');
        
        if (!canDelete) {
            await pool.close();
            return res.status(403).json({ 
                success: false, 
                message: 'You do not have permission to delete this ticket' 
            });
        }
        
        // Delete related comments first (foreign key constraint)
        await pool.request()
            .input('TicketID', sql.Int, ticketID)
            .query('DELETE FROM TicketComments WHERE TicketID = @TicketID');
        
        // Delete the ticket
        await pool.request()
            .input('TicketID', sql.Int, ticketID)
            .query('DELETE FROM Tickets WHERE TicketID = @TicketID');
        
        console.log(`Ticket ${ticketID} deleted successfully by user ${userID}`);
        
        res.json({ 
            success: true, 
            message: 'Ticket deleted successfully'
        });
        
        await pool.close();
    } catch (error) {
        console.error('Delete ticket error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Dashboard stats endpoint
app.get('/api/dashboard/stats', async (req, res) => {
    try {
        const { userID, userRole } = req.query;
        
        const pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .input('UserID', sql.Int, userID || 1)
            .input('UserRole', sql.NVarChar, userRole || 'Admin')
            .execute('sp_GetDashboardStats');
        
        res.json({ 
            success: true, 
            stats: result.recordset[0] 
        });
        
        await pool.close();
    } catch (error) {
        console.error('Dashboard stats error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get categories endpoint
app.get('/api/categories', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .query('SELECT CategoryID, CategoryName, Description FROM Categories WHERE IsActive = 1 ORDER BY CategoryName');
        
        res.json({ 
            success: true, 
            categories: result.recordset 
        });
        
        await pool.close();
    } catch (error) {
        console.error('Get categories error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Knowledge base search endpoint
app.get('/api/knowledge-base/search', async (req, res) => {
    try {
        const { searchTerm, categoryID } = req.query;
        
        if (!searchTerm) {
            return res.status(400).json({ success: false, message: 'Search term required' });
        }
        
        const pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .input('SearchTerm', sql.NVarChar, searchTerm)
            .input('CategoryID', sql.Int, categoryID || null)
            .execute('sp_SearchKnowledgeBase');
        
        res.json({ 
            success: true, 
            articles: result.recordset 
        });
        
        await pool.close();
    } catch (error) {
        console.error('Knowledge base search error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Serve the main HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Test endpoint
app.get('/api/test', (req, res) => {
    res.json({ 
        success: true, 
        message: 'HelpDesk Pro API is running!',
        timestamp: new Date().toISOString()
    });
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ success: false, message: 'API endpoint not found' });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 HelpDesk Pro Server running on http://localhost:${PORT}`);
    console.log(`📊 API endpoints available at http://localhost:${PORT}/api/`);
    console.log(`🌐 Web interface at http://localhost:${PORT}`);
    console.log(`🧪 Test API at http://localhost:${PORT}/api/test`);
});