# PostgreSQL SQL Requests Example

This example demonstrates how to use SQL requests with PostgreSQL databases in httpyac.

## Basic SQL Request

```http
### Query all users
SQL postgresql://username:password@localhost:5432/mydatabase

SELECT id, name, email, created_at 
FROM users 
WHERE active = true 
ORDER BY created_at DESC 
LIMIT 10;

### Alternative syntax
postgresql://username:password@localhost:5432/mydatabase

SELECT * FROM products WHERE category = 'electronics';

### SQL with environment variables
SQL postgresql://{{username}}:{{password}}@{{host}}:{{port}}/{{database}}

SELECT COUNT(*) as total_orders 
FROM orders 
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days';
```

## Response Data Access

The SQL response contains:

- `response.body` - JSON formatted query results
- `response.parsedBody` - Raw rows array for programmatic access
- `response.meta` - Query metadata (command, rowCount, fields, etc.)
- `response.headers` - Query headers (row-count, command, fields)

## Using Response Data in Other Requests

```http
### Get user count
SQL postgresql://localhost:5432/mydb

SELECT COUNT(*) as user_count FROM users;

### Reference the count in another request
GET https://api.example.com/stats
Content-Type: application/json

{
  "users": {{$sql.0.parsedBody.0.user_count}}
}
```

## Connection Options

You can specify additional PostgreSQL connection options via headers:

```http
SQL postgresql://localhost:5432/mydb
ssl: require
query_timeout: 30000

SELECT * FROM large_table LIMIT 1000;
```