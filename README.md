# Food Billing Application

A FastAPI-based application for managing food orders and billing in a restaurant or food service environment.

## Demo

Check out the application demo:
file:///home/saleem-shady/Desktop/billing_app/static/output.mp4


## Features

- Inventory management for food items
- Order creation and tracking
- Payment status management
- Order history and reporting
- Search functionality for items and orders

## Tech Stack

- **Backend**: FastAPI, SQLAlchemy, Pydantic
- **Database**: SQLite (configurable for other databases)
- **Development**: Python 3.8+

## Project Structure

```
billing_app/
├── data/                # Database and data files
├── models.py            # Database models and schema definitions
├── database.py          # Database connection and operations
├── populate_dummy_data.py  # Script to populate test data
├── main.py              # FastAPI application entry point
└── output.mp4           # Demo video
```

## Database Schema

The application uses two main tables:

- **Items**: Food items available for purchase
- **Orders**: Customer orders with payment status tracking

## Getting Started

### Prerequisites

- Python 3.8 or higher
- pip (Python package manager)

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd billing_app
   ```

2. Create a virtual environment and activate it:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

### Database Setup

The application will create the database automatically on first run. To populate it with test data:

```bash
python populate_dummy_data.py
```

### Running the Application

Start the FastAPI server:

```bash
uvicorn main:app --reload
```

The API will be available at http://localhost:8000

API documentation is available at:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## API Endpoints

- `/items`: Manage food items
- `/orders`: Manage customer orders
- `/search`: Search functionality

## Development

### Testing

Run tests with:

```bash
pytest
```

### Adding New Features

1. Create or modify models in `models.py`
2. Update database operations in `database.py`
3. Add API endpoints in `main.py`

## License

This project is licensed under the MIT License - see the LICENSE file for details.
