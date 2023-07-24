# Soul-Train-Backend
This is the backend of the soul train app.
## How it works
This backend server is a Node.js application that provides registration and login functionality for Soul Train App. When a user registers for an account, their information is stored securely in a database. When they log in, their credentials are checked against the database to ensure that they are valid.

The server is built using the following technologies:

* Node.js: a JavaScript runtime environment that allows us to run server-side code
* Express: a web application framework for Node.js that simplifies the process of building web servers
* MongoDB: a NoSQL database that stores user information securely
* bcrypt: a password hashing library that ensures user passwords are securely stored

The server is designed to be easily deployable on a variety of platforms, including cloud services like AWS or Google Cloud. To get started, simply clone the repository, install the dependencies, and run the server using Node.js.
```bash
npm install
npm run dev
```
Once the server is up and running, users can register for an account by providing their email address and a secure password. They will then be able to log in to the application using their email address and password. The server will handle all authentication and authorization, ensuring that only authorized users can access protected resources.
## API Description
This backend server provides a set of RESTful APIs for integrating with the frontend mobile application.
The following APIs are available:
### User Registration
API Endpoint: /auth/register

This API allows users to register for a new account by providing their name, email address and a secure password.
#### Request
```JSON
POST /auth/register
Content-Type: application/json

{
    "name": "example",
    "email": "example@example.com",
    "password": "password123"
}
```
#### Response
```JSON
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "message": "User registered successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```
### User Login
API Endpoint: /auth/login

This API allows users to log in to their account using their email address and password.
#### Request
```JSON
POST /auth/login
Content-Type: application/json

{
  "email": "example@example.com",
  "password": "password123"
}
```
#### Response
```JSON
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "message": "User logged in successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```