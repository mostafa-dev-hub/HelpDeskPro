# HelpDesk Pro - Professional Ticketing System

A modern, full-stack helpdesk ticketing system built with Node.js, Express, and SQL Server. Features role-based access control, real-time ticket management, and a responsive web interface.

## Features

### Core Functionality
- **Multi-Role Support**: Admin, Staff, and Customer interfaces
- **Ticket Management**: Create, assign, update, and track support tickets
- **Real-time Dashboard**: Live statistics and ticket overviews
- **User Authentication**: Secure login with role-based permissions
- **Database Integration**: Full SQL Server backend with stored procedures

### User Roles
- **Administrator**: Full system access, user management, analytics
- **Staff/Agent**: Ticket assignment, customer support, limited admin features
- **Customer**: Submit tickets, view status, knowledge base access

### Key Features
- **Dashboard Analytics**: Real-time statistics and performance metrics
- **Ticket System**: Priority levels, categories, status tracking
- **User Management**: Customer and staff account management
- **Knowledge Base**: Self-service articles and FAQs
- **Security**: Role-based access control and data protection
- **Responsive Design**: Mobile-friendly interface

## Technology Stack

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **SQL Server** - Database with stored procedures
- **mssql** - Database connectivity

### Frontend
- **HTML5** - Semantic markup
- **CSS3** - Modern styling with gradients and animations
- **JavaScript (ES6+)** - Client-side functionality
- **Responsive Design** - Mobile-first approach

### Database
- **Microsoft SQL Server** - Primary database
- **Stored Procedures** - Business logic implementation
- **Foreign Key Constraints** - Data integrity

## Prerequisites

Before running this application, ensure you have:

- **Node.js** (v14 or higher)
- **Microsoft SQL Server** (2016 or higher)
- **SQL Server Management Studio** (for database setup)
- **Git** (for version control)

## Installation & Setup

### 1. Clone the Repository
```bash
git clone https://github.com/mostafa-dev-hub/HelpDeskPro.git
cd helpdesk-pro
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Database Setup

#### Create Database
1. Open SQL Server Management Studio
2. Connect to your SQL Server instance
3. Create a new database named `HelpDeskPro`
4. Run the following SQL script to create tables and stored procedures:

```sql
-- Create Users table
CREATE TABLE Users (
    UserID INT IDENTITY(1,1) PRIMARY KEY,
    Username NVARCHAR(50) UNIQUE NOT NULL,
    PasswordHash NVARCHAR(255) NOT NULL,
    Email NVARCHAR(100) UNIQUE NOT NULL,
    FirstName NVARCHAR(50) NOT NULL,
    LastName NVARCHAR(50) NOT NULL,
    Company NVARCHAR(100),
    Phone NVARCHAR(20),
    UserRole NVARCHAR(20) DEFAULT 'Customer',
    EmailNotifications BIT DEFAULT 1,
    CreatedDate DATETIME DEFAULT GETDATE(),
    UpdatedDate DATETIME DEFAULT GETDATE()
);

-- Create Categories table
CREATE TABLE Categories (
    CategoryID INT IDENTITY(1,1) PRIMARY KEY,
    CategoryName NVARCHAR(50) NOT NULL,
    Description NVARCHAR(255),
    IsActive BIT DEFAULT 1
);

-- Create Tickets table
CREATE TABLE Tickets (
    TicketID INT IDENTITY(1,1) PRIMARY KEY,
    TicketNumber NVARCHAR(20) UNIQUE NOT NULL,
    Subject NVARCHAR(200) NOT NULL,
    Description NVARCHAR(MAX) NOT NULL,
    Priority NVARCHAR(20) DEFAULT 'Medium',
    Status NVARCHAR(20) DEFAULT 'Open',
    CustomerID INT NOT NULL,
    AssignedToID INT,
    CategoryID INT NOT NULL,
    CreatedDate DATETIME DEFAULT GETDATE(),
    UpdatedDate DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (CustomerID) REFERENCES Users(UserID),
    FOREIGN KEY (AssignedToID) REFERENCES Users(UserID),
    FOREIGN KEY (CategoryID) REFERENCES Categories(CategoryID)
);

-- Create TicketComments table
CREATE TABLE TicketComments (
    CommentID INT IDENTITY(1,1) PRIMARY KEY,
    TicketID INT NOT NULL,
    UserID INT NOT NULL,
    Comment NVARCHAR(MAX) NOT NULL,
    IsInternal BIT DEFAULT 0,
    IsResolution BIT DEFAULT 0,
    CreatedDate DATETIME DEFAULT GETDATE(),
    UpdatedDate DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (TicketID) REFERENCES Tickets(TicketID),
    FOREIGN KEY (UserID) REFERENCES Users(UserID)
);

-- Insert default categories
INSERT INTO Categories (CategoryName, Description) VALUES
('Technical Support', 'Hardware and software issues'),
('Billing', 'Payment and subscription questions'),
('General Inquiry', 'General questions and information'),
('Bug Report', 'Software bugs and issues'),
('Feature Request', 'New feature suggestions');

-- Insert default admin user
INSERT INTO Users (Username, PasswordHash, Email, FirstName, LastName, UserRole) VALUES
('admin', 'admin123', 'admin@helpdesk.com', 'System', 'Administrator', 'Admin');

-- Create stored procedures
CREATE PROCEDURE sp_AuthenticateUser
    @Username NVARCHAR(50),
    @Password NVARCHAR(255)
AS
BEGIN
    SELECT UserID, Username, Email, FirstName, LastName, UserRole, Company, Phone
    FROM Users 
    WHERE Username = @Username AND PasswordHash = @Password
END;

CREATE PROCEDURE sp_CreateTicket
    @Subject NVARCHAR(200),
    @Description NVARCHAR(MAX),
    @CustomerID INT,
    @CategoryID INT,
    @Priority NVARCHAR(20)
AS
BEGIN
    DECLARE @TicketNumber NVARCHAR(20)
    SET @TicketNumber = 'TKT-' + RIGHT('000000' + CAST(IDENT_CURRENT('Tickets') + 1 AS NVARCHAR), 6)
    
    INSERT INTO Tickets (TicketNumber, Subject, Description, CustomerID, CategoryID, Priority)
    VALUES (@TicketNumber, @Subject, @Description, @CustomerID, @CategoryID, @Priority)
    
    SELECT * FROM Tickets WHERE TicketID = SCOPE_IDENTITY()
END;

CREATE PROCEDURE sp_GetUserTickets
    @UserID INT,
    @UserRole NVARCHAR(20),
    @Status NVARCHAR(20) = NULL,
    @PageSize INT = 20,
    @PageNumber INT = 1
AS
BEGIN
    IF @UserRole = 'Admin'
    BEGIN
        SELECT t.*, u.FirstName + ' ' + u.LastName as CustomerName, 
               u2.FirstName + ' ' + u2.LastName as AssignedToName,
               c.CategoryName
        FROM Tickets t
        LEFT JOIN Users u ON t.CustomerID = u.UserID
        LEFT JOIN Users u2 ON t.AssignedToID = u2.UserID
        LEFT JOIN Categories c ON t.CategoryID = c.CategoryID
        WHERE (@Status IS NULL OR t.Status = @Status)
        ORDER BY t.CreatedDate DESC
        OFFSET (@PageNumber - 1) * @PageSize ROWS
        FETCH NEXT @PageSize ROWS ONLY
    END
    ELSE IF @UserRole = 'Staff'
    BEGIN
        SELECT t.*, u.FirstName + ' ' + u.LastName as CustomerName,
               u2.FirstName + ' ' + u2.LastName as AssignedToName,
               c.CategoryName
        FROM Tickets t
        LEFT JOIN Users u ON t.CustomerID = u.UserID
        LEFT JOIN Users u2 ON t.AssignedToID = u2.UserID
        LEFT JOIN Categories c ON t.CategoryID = c.CategoryID
        WHERE (t.AssignedToID = @UserID OR t.AssignedToID IS NULL)
        AND (@Status IS NULL OR t.Status = @Status)
        ORDER BY t.CreatedDate DESC
        OFFSET (@PageNumber - 1) * @PageSize ROWS
        FETCH NEXT @PageSize ROWS ONLY
    END
    ELSE
    BEGIN
        SELECT t.*, u.FirstName + ' ' + u.LastName as CustomerName,
               u2.FirstName + ' ' + u2.LastName as AssignedToName,
               c.CategoryName
        FROM Tickets t
        LEFT JOIN Users u ON t.CustomerID = u.UserID
        LEFT JOIN Users u2 ON t.AssignedToID = u2.UserID
        LEFT JOIN Categories c ON t.CategoryID = c.CategoryID
        WHERE t.CustomerID = @UserID
        AND (@Status IS NULL OR t.Status = @Status)
        ORDER BY t.CreatedDate DESC
        OFFSET (@PageNumber - 1) * @PageSize ROWS
        FETCH NEXT @PageSize ROWS ONLY
    END
END;

CREATE PROCEDURE sp_UpdateTicketStatus
    @TicketID INT,
    @NewStatus NVARCHAR(20),
    @UpdatedBy INT,
    @ResolutionNotes NVARCHAR(MAX) = NULL
AS
BEGIN
    UPDATE Tickets 
    SET Status = @NewStatus, UpdatedDate = GETDATE()
    WHERE TicketID = @TicketID
    
    IF @ResolutionNotes IS NOT NULL
    BEGIN
        INSERT INTO TicketComments (TicketID, UserID, Comment, IsInternal, IsResolution)
        VALUES (@TicketID, @UpdatedBy, @ResolutionNotes, 1, 1)
    END
END;

CREATE PROCEDURE sp_GetDashboardStats
    @UserID INT,
    @UserRole NVARCHAR(20)
AS
BEGIN
    IF @UserRole = 'Admin'
    BEGIN
        SELECT 
            (SELECT COUNT(*) FROM Tickets WHERE Status = 'Open') as OpenTickets,
            (SELECT COUNT(*) FROM Tickets WHERE Status = 'Pending') as PendingTickets,
            (SELECT COUNT(*) FROM Tickets WHERE Status = 'Resolved') as ResolvedTickets,
            (SELECT COUNT(*) FROM Tickets WHERE Status = 'Closed') as ClosedTickets,
            (SELECT COUNT(*) FROM Tickets WHERE CreatedDate >= DATEADD(day, -7, GETDATE())) as TicketsThisWeek
    END
    ELSE IF @UserRole = 'Staff'
    BEGIN
        SELECT 
            (SELECT COUNT(*) FROM Tickets WHERE AssignedToID = @UserID AND Status = 'Open') as OpenTickets,
            (SELECT COUNT(*) FROM Tickets WHERE AssignedToID = @UserID AND Status = 'Pending') as PendingTickets,
            (SELECT COUNT(*) FROM Tickets WHERE AssignedToID = @UserID AND Status = 'Resolved') as ResolvedTickets,
            (SELECT COUNT(*) FROM Tickets WHERE AssignedToID = @UserID AND Status = 'Closed') as ClosedTickets,
            (SELECT COUNT(*) FROM Tickets WHERE AssignedToID = @UserID AND CreatedDate >= DATEADD(day, -7, GETDATE())) as TicketsThisWeek
    END
    ELSE
    BEGIN
        SELECT 
            (SELECT COUNT(*) FROM Tickets WHERE CustomerID = @UserID) as TotalTickets,
            (SELECT COUNT(*) FROM Tickets WHERE CustomerID = @UserID AND Status = 'Open') as OpenTickets,
            (SELECT COUNT(*) FROM Tickets WHERE CustomerID = @UserID AND Status = 'Resolved') as ResolvedTickets,
            (SELECT COUNT(*) FROM Tickets WHERE CustomerID = @UserID AND Status = 'Closed') as ClosedTickets
    END
END;

CREATE PROCEDURE sp_SearchKnowledgeBase
    @SearchTerm NVARCHAR(100),
    @CategoryID INT = NULL
AS
BEGIN
    -- This is a placeholder for knowledge base search
    -- In a real implementation, you would have a KnowledgeBase table
    SELECT 'Sample Article' as Title, 'Sample content for ' + @SearchTerm as Content
END;
```

### 4. Configure Database Connection

Update the database configuration in `server.js`:

```javascript
const dbConfig = {
    server: 'your-server-name',        // Your SQL Server name
    database: 'HelpDeskPro',
    user: 'your-username',              // Your SQL Server username
    password: 'your-password',         // Your SQL Server password
    port: 1433,
    options: {
        enableArithAbort: true,
        encrypt: true,
        trustServerCertificate: true
    }
};
```

### 5. Start the Application

```bash
# Development mode
npm run dev

# Production mode
npm start
```

The application will be available at `http://localhost:3000`

## Default Login Credentials

### Administrator
- **Username**: `admin`
- **Password**: `admin123`

### Customer Registration
- Customers can register new accounts through the signup form
- New customers are automatically assigned the "Customer" role

## Project Structure

```
helpdesk-pro/
├── index.html          # Main HTML file
├── script.js           # Frontend JavaScript
├── styles.css          # CSS styles
├── server.js           # Node.js server
├── package.json        # Dependencies
└── README.md           # This file
```

## 🎯 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/users/register` - User registration

### Tickets
- `GET /api/tickets/user` - Get user tickets
- `POST /api/tickets/create` - Create new ticket
- `PUT /api/tickets/:id/status` - Update ticket status
- `POST /api/tickets/:id/comments` - Add comment
- `DELETE /api/tickets/:id` - Delete ticket

### Dashboard
- `GET /api/dashboard/stats` - Get dashboard statistics
- `GET /api/categories` - Get ticket categories

## Features Overview

### Admin Dashboard
- System-wide ticket overview
- User management
- Performance analytics
- Staff assignment tools

### Staff Interface
- Assigned ticket queue
- Customer communication
- Ticket status updates
- Performance tracking

### Customer Portal
- Ticket submission
- Status tracking
- Knowledge base access
- Profile management

