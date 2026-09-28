# CareerForge AI

## AI-Powered Resume & Interview Assessment Platform

CareerForge AI is an AI-powered platform designed to help students prepare for technical interviews using their resumes.

The system analyzes a student's resume, extracts relevant skills, projects, technologies, certifications, and experience, and uses this information to generate personalized interview questions.

## Features

- Student registration and login
- JWT-based authentication
- Resume upload and parsing
- PDF and DOCX resume processing
- AI-powered resume analysis
- Resume-based technical interview questions
- Project-based interview questions
- Mixed interview mode
- Easy, Medium, Hard, and Adaptive difficulty
- Multiple question counts
- Text and voice interview modes
- Global question history and duplicate-question detection
- Automatic interview timer
- Interview performance evaluation
- Detailed interview reports
- Concept-wise performance analysis
- Recommended areas for improvement
- Email verification/OTP support
- Admin functionality

## Technology Stack

### Frontend

- HTML
- CSS
- JavaScript
- Chart.js

### Backend

- Node.js
- Express.js
- JavaScript

### Database

- MongoDB
- Mongoose

### AI

- Google Generative AI

### Authentication & Security

- JWT
- bcrypt

### Resume Processing

- Multer
- Mammoth
- pdf-parse

### Email & Communication

- Nodemailer

## Project Structure

```text
CareerForge-AI/
│
├── backend/
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── services/
│   ├── scripts/
│   ├── utils/
│   ├── uploads/
│   ├── package.json
│   └── server.js
│
├── frontend/
│   ├── css/
│   ├── images/
│   ├── js/
│   ├── dashboard.html
│   ├── interview.html
│   ├── interview-setup.html
│   ├── report.html
│   ├── resume.html
│   ├── signin.html
│   └── signup.html
│
├── .gitignore
├── README.md
└── package-lock.json
